# HSCode_ZCode VERIFICATION（验收记录）

日期：2026-10-20。执行人：Coding Agent（ZCode CLI 会话）。
标注规则：PASS = 实际执行通过；FAIL = 执行且失败；NOT RUN = 未执行（如实标注，不冒充）。

## 1. 源码基线与依赖（PASS）

- 上游 main HEAD == 审计基线 `3c5b227649371507ddc4eb46ac5133afe6db1cab`（`git ls-remote` 核验，无漂移）。
- 工作树与基线树逐字节一致（tarball 路线 + `git status` 空输出）；分支 `hscode/zcode-privacy-brand`。
- 依赖/工具链见 `docs/HSCode_ZCode_SOURCE_BASE.md`；全量 `pnpm install --frozen-lockfile` 成功。

## 2. 静态出网路径枚举（PASS，详见 PRIVACY_AUDIT 矩阵）

- 构建器侧：`build-time-config.mjs`（ARMS/事件上报/自动更新三开关，缺省关闭）、`tsup.config.ts`（OTLP 注入，HSCODE_BUILD=1 硬拒绝）、`vite.config.ts`（renderer define 同源）。
- 运行时侧：ARMS RUM init（endpoint 空即 enable:false）、telemetryCore（endpoint 空）、otlp-exporter（无 endpoint 不加载 SDK）、desktopCrashCapture（本地模式 uploadToServer:false）、feedbackSubmissionJob（includeLogs 门）、autoUpdater（双开关 fail-closed）、webRemoteControlManager（auto-restore 门）、feedbackService（显式提交才走 zcode.z.ai）。
- 每项标注 allow（用户主动的功能联网）/ deny（本轮关闭）/ opt-in（用户显式开启），见 `docs/HSCode_ZCode_PRIVACY_AUDIT.md` 出网路径矩阵。

## 3. 测试与类型检查（PASS）

| 项 | 结果 |
|---|---|
| 新增门禁单测 `scripts/test/hscode-privacy-guard.test.mjs` | 8/8 通过（含"污染 env 下仍拒绝注入 OTLP"、"上游 release 门禁保持"） |
| `feedbackSubmitFormRetry` / `feedbackBackgroundUploadIndicator` / `chatErrorBannerFeedbackDraft` / `desktopRuntimeEnv` 定向回归 | 49 通过 4 跳过 |
| 全仓 `pnpm typecheck`（含 ui/web/shared/desktop main+host 等） | exit 0 |
| `node scripts/hscode-privacy-guard.mjs`（构建链第一步） | 构建日志确认 OK 后才继续 |
| desktop 生产构建（tsup main/host/preload/plugin-sandbox/scheduler + vite renderer） | 成功（vite ✓ built in 1m56s；H 启动图资产已发射进 out/renderer） |

## 4. 真实打包 Win x64（见 4.x 小节最终状态）

- `node scripts/hscode-build.mjs`（隐私门禁 → 生产构建 → `bundle:desktop`，目标 win/x64，ZCODE_ENV=production ZCODE_PREVIEW_IDENTITY=1 HSCODE_BUILD=1）。
- electron-builder 26.8.1；NSIS 安装包输出于 `packages/desktop/dist/`。
- 最终产物文件名、SHA256 与启动验收结果见文末"运行时验收"（在本次会话中实际执行后填写）。

## 5. 反馈脱敏回归（PASS，静态+单测层面）

- 默认态：表单与全部 6 个草稿入口 `includeLogs=false` → `feedbackSubmissionJob.ts:284` 的日志 ZIP 打包与上传分支不执行（单测 `feedbackSubmitFormRetry` 覆盖提交 payload 断言 `includeLogs:false`）。
- 测试数据未使用真实 API Key（单测全部为 mock service）。
- 带密钥合成数据的端到端 ZIP 内容检查：NOT RUN（需要真实反馈后端环境；执行提示词要求不请求真实后端，故仅以单测 payload 断言为证据）。

## 6. Gitleaks 密钥扫描（PASS，对全部改动/新增文件）

- 工具：gitleaks 8.30.1（官方发行版）。
- 范围：本轮 35 个修改/新增的文本文件（源码 + 3 份 docs + 配置）。
- 结果：改动文件本体 0 泄漏。（初次扫描报的 2 处命中位于 gitleaks 发行 zip 自带的 README.md 文档示例中，非本仓库文件，判误报。）
- Git 历史：新 commit 完成后对 `<基线>..HEAD` 范围再扫（结果见文末补录）。

## 7. 运行时验收（真实启动 EXE + 网络证据）

> 以下小节由实际执行填充；未执行的项保持 NOT RUN。

### 7.1 安装与启动

- 安装包：`packages/desktop/dist/HSCode Preview-<version>-win-x64.exe`
- 启动方式与结果：（待填）

### 7.2 冷启动 60s + 空闲网络矩阵（默认未登录态）

- 采样方式：pwsh `Get-NetTCPConnection` 快照（只记录远端 host:port，不抓内容）。
- 观测到的非系统远端：（待填）
- 判定：默认态无 ARMS/事件上报/OTLP/反馈/更新出网 → （待填）

### 7.3 品牌验收（窗口/任务栏/托盘/About/安装器）

- （待填：以实际启动与截图/文件属性为准）

### 7.4 未执行项（NOT RUN 清单）

- （待填：登录后的空闲、创建会话、自建 Provider、Terminal/Browser/Workflow、Remote 授权等场景——本机无官方账号凭据，按执行提示词"不得迁移用户已有会话/凭据"不引入；相应场景判 NOT RUN 并说明。）
