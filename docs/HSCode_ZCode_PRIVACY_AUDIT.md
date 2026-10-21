# HSCode_ZCode PRIVACY AUDIT（隐私整改审计报告）

审计对象：`hscode/zcode-privacy-brand` 分支（基线 zai-org/ZCode `3c5b227649371507ddc4eb46ac5133afe6db1cab`）
审计方式：源码级静态审计（file:line 均已人工核对）+ 构建期门禁单测；运行时网络证据见 `HSCode_ZCode_VERIFICATION.md`。
日期：2026-10-20

## 总原则

- 不把"有联网代码"等同于"已泄露"：逐条区分 功能必需联网（模型 API、登录、插件商店、Browser、用户主动的远控）与 非必要无感出网（遥测、OTLP、崩溃上传、默认附日志的反馈、自动更新、自动重连 Relay）。
- 上游已有的 fail-closed 开关一律保留复用，不删 SDK、不重写底层；HSCode 侧只加"显式关闭 + 可测试门禁"。
- 所有改动最小侵入、可回滚、便于后续 upstream merge。

## 出网路径矩阵（默认态结论）

| # | 类别 | 入口 → 目的地 | 上游默认 | HSCode 整改 | 默认态 |
|---|---|---|---|---|---|
| A1 | ARMS RUM 遥测 | `appARMSBootstrap.ts:163-167` `enable: ZCODE_ARMS_RUM_ENDPOINT !== ""` | 无配置即关 | 构建期强制空串 + 门禁断言；不改 SDK | **关闭** |
| A2 | 数仓事件上报 | `telemetryCore.ts:21` endpoint 来自 `ZCODE_TELEMETRY_REPORT_ENDPOINT` | 无配置即关 | 同上 | **关闭** |
| A3 | 自动更新轮询 | `index.ts:2208` `initAutoUpdater({enabled: flavor==="production" && ZCODE_AUTO_UPDATE_ENABLED})`；disabled 时 `autoUpdater.ts:1608` fail-closed | 构建期 `ZCODE_AUTO_UPDATE_ENABLED=false` | `ZCODE_AUTO_UPDATE=0` + 门禁断言；HSCode 只构建 preview flavor（托盘更新入口仅 production 显示，见 G） | **关闭** |
| B1 | 打包 Agent OTLP 注入 | `tsup.config.ts resolveBuildPackagedAgentTelemetryEnv`（CI release 强制要求 OTLP） | 本地构建返回 `{}` | **HSCODE_BUILD=1 时无条件返回 `{}`**（即使环境变量被污染也拒绝注入），上游门禁行为原样保留 | **关闭** |
| B2 | CLI OTLP SDK | `bootstrap.ts:124`：无 OTLP endpoint 即不加载 SDK | 无 endpoint 即关 | B1 保证产物无 endpoint；`ZCODE_TELEMETRY_RUNTIME_DISTRIBUTION` 保持 `unknown`（非 packaged） | **关闭** |
| C1 | 崩溃上传（ARMS crash collector） | `appARMSBootstrap.ts` collectors `crash: true` | ARMS 启用时收集 | **改为 `crash: false`**（硬编码，即使将来误配 ARMS endpoint 也不传崩溃） | **关闭** |
| C2 | 本地 crashReporter | `appCrashCaptureBootstrap.ts:6` `initializeCrashCapture(logger, true)`=不启动本地 reporter | ARMS 接管 | **改为 `false`**：本地 crashReporter 启动，`uploadToServer:false` + 无效占位 submitURL（`desktopCrashCapture.ts:20,372-382`），dump 只留 `~/.zcode/v2/crash/` 隔离目录 | **本地保留，远端关闭** |
| D1 | 反馈默认附日志 | `FeedbackSubmitForm.tsx:105,125` `?? true` | **默认 true** | **全部改 `?? false`**；6 个创建草稿的入口（helpMenuActions/ChatErrorBanner/task-row/TaskListItem/WorkspaceHeaderSections/SessionSubscriptionErrorPanel）同步改 `includeLogs: false` | **关闭（用户显式勾选才传）** |
| D2 | 反馈上传通道 | `feedbackSubmissionJob.ts:284` 仅 `includeLogs===true` 才打包上传日志 ZIP；目标 OSS 凭证由 `zcode.z.ai/api/v1` 签发 | 显式行为 | 通道保留（用户勾选后仍可用主动反馈）；未勾选时 ZIP 与上传路径不执行 | **opt-in 保留** |
| E1 | Provider 端点改写 | `endpoint-routing-edition/index.ts` → 静态网关：仅精确匹配 `open.bigmodel.cn:443/api/anthropic/v1/messages`、`api.z.ai:443/api/anthropic/v1/messages` 两个官方 Coding Plan 端点改写到当前 origin 的 `/api/v1/ultra*`；其它 URL 一律直连（`official-coding-plan-gateway.ts:8-30`） | 官方计划端点走官方网关 | **保留**：只影响 Z.AI/BigModel 官方订阅端点（合法网关场景）；用户自建 Provider（OpenAI-compatible/llama.cpp/自定义 baseURL）不匹配规则，**最终 Host 即用户设定地址**；身份头 `X-ZCode-Authorization` 仅发往 `/api/v1/ultra*` 路径族 | 用户自建 Provider 不改写 |
| F1 | 远控自动重连 Relay | `webRemoteControlManager.ts` `restorePreviouslyEnabled`（启动/登录后读持久化上下文自动 `start()` 连 `wss://zcode.z.ai/api/v1/remote/ws2`） | **自动重连** | **默认禁止**：`ZCODE_REMOTE_AUTO_RESTORE !== "1"` 直接 return（不再自动连 Relay）；用户在 UI 主动启动远控不受影响；显式 opt-in 开关保留 | **关闭（opt-in）** |
| F2 | 远控功能门禁 | `createWebRemoteControlFeatureGate(enabled=true)` | 功能启用 | 保留（用户主动扫码配对后才连 Relay；QR-ready 持久化仅本地存储） | 功能可用，不自动出网 |
| G1 | 托盘"检查更新" | `desktopTray.ts:102-110` 仅 `ZCODE_PRODUCT_FLAVOR==="production"` 显示 | production 显示 | HSCode 只构建 **preview** flavor（`ZCODE_PREVIEW_IDENTITY=1`）→ 入口不渲染；自动更新另受 A3 双重关闭 | **关闭** |
| H1 | Electron 数据与业务数据 | `desktopRuntimeEnv.ts:65-86` 的 Electron userData/sessionData 使用 `HSCode Preview`；业务路径由 `services/src/paths.ts` 与 `desktopDataBaseDirBootstrap.ts` 决定 | Preview 业务数据与正式版共用 | **仅 Electron userData/sessionData 已隔离**；业务会话、配置、模型凭据仍可能从同一 `.zcode` 数据根读取，不能称为完整隔离 | **部分完成，业务数据隔离未完成** |
| H2 | 协议 deep link | `electron-builder.config.js` schemes `["zcode"]` | 最后注册的应用成为默认处理程序 | 保留 `zcode://`（官方登录/远控回调依赖），会与正式 ZCode 争用默认处理程序；AUMID 隔离不能消除该冲突 | **存在并装回调冲突风险** |

## 测试证据（静态/单测）

- `scripts/test/hscode-privacy-guard.test.mjs`（已注册进根 vitest include，8/8 通过）：
  - 门禁对 4 个 endpoint 变量非空、`ZCODE_AUTO_UPDATE=1`、私有默认文件存在、缺 `HSCODE_BUILD=1` 均判 FAIL；
  - `resolveBuildPackagedAgentTelemetryEnv` 在 `HSCODE_BUILD=1` 时对已配置的 OTLP endpoint/headers 仍返回 `{}`（拒绝注入）；
  - 无 `HSCODE_BUILD` 时上游 CI release 门禁（throw）保持原样——未为通过检查而削弱上游语义。
- 定向回归：`feedbackSubmitFormRetry`（5）、`feedbackBackgroundUploadIndicator`（8）、`chatErrorBannerFeedbackDraft`（4）、`desktopRuntimeEnv`（36）全部通过（含更新后的默认值断言）。
- 全仓 `pnpm typecheck` 通过（exit 0）。
- 构建门禁：`node scripts/hscode-privacy-guard.mjs` 在 `scripts/hscode-build.mjs` 第一步强制执行，任一违规即中止构建。

## 未关闭的风险（如实记录）

1. **运行时网络证据**：本文件只含静态与单测证据；冷启动/空闲/会话等场景的真实抓包矩阵见 VERIFICATION 文档（以其实际 PASS/NOT RUN 为准）。
2. **E1 保留的官方网关改写**：Z.AI/BigModel 官方订阅用户走 `/api/v1/ultra*` 网关是其订阅能力的一部分，HSCode 未截断；若用户要求"绝对零改写"，可将 `endpoint-routing-edition/index.ts` 的工厂改为返回 `{ routed: false }`（单点改动，已记录于 BRANDING_MAP 同目录决策）。
3. **`zcode://` 协议与 `zcode.z.ai` 反馈 API**：登录 OAuth 与主动反馈（用户显式操作）仍依赖官方端点，属功能必需联网；未做拦截。
4. **ssh2 原生绑定缺失**：不影响隐私，仅记录环境事实。
5. **2026-10-21 复核：业务数据未隔离**：`desktopDataBaseDirBootstrap.ts` 仍读取 `.zcode/v2/setting.json`；`packages/services/src/paths.ts` 的配置、任务和 CLI 目录仍基于 `.zcode`；`desktopRuntimeEnv.ts` 还明确保留共享业务数据根。本次上传审核未修改这些运行逻辑，不能用 Electron userData 名称变化证明会话和模型凭据隔离。
6. **2026-10-21 复核：协议处理程序共用**：`electron-builder.config.js` 明确说明两个应用最后注册者成为默认 handler。此前“不会产生劫持面”的表述不成立，已更正；后续需要设计兼容官方登录回调的独立协议策略并实测。
