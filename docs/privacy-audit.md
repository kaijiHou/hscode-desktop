# HSCode 隐私审计

> 审计对象：OpenCode 上游 `https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`。
> 审计日期：2026-08-22；最近修订：2026-08-22（Phase 1.9 Baseline Repair & Privacy Closure）。
> 目标：HSCode 普通启动不产生任何被动外联请求。

## 1. 审计结论（TL;DR）

| 项目 | 上游行为 | HSCode 处理 |
|---|---|---|
| **Sentry 崩溃/错误上报** | 条件初始化（需 `VITE_SENTRY_DSN`） | ✅ **彻底移除**（代码 + 依赖 + 构建插件 + 环境变量声明全部清除） |
| **electron-updater 自动更新** | 打包后自动检查更新 | ✅ **已禁用**（`UPDATER_ENABLED = false`，check() 短路不联网） |
| **Session Share（会话分享）** | 默认开启，上传到 `https://opncd.ai` | ✅ **硬禁用**（`disabled = true`，环境变量无法恢复；UI 命令隐藏） |
| **模型元数据拉取** | 只读拉取 `https://models.opencode.ai` 并定时刷新 | ✅ **HSCode 默认禁用**（Desktop 启动注入 `OPENCODE_DISABLE_MODELS_FETCH=true`） |
| **远程 Release Notes** | 拉取 `https://hscode.dev/changelog.json` | ✅ **已禁用**（不再请求任何远程 changelog） |
| **通知图标外链** | `https://hscode.dev/favicon-*.png` | ✅ **已移除**（通知不传远程 icon） |
| **OpenTelemetry / OTLP** | 仅配置 `OTEL_EXPORTER_OTLP_ENDPOINT` 时才发送 | ✅ **默认不启用**（保留能力，非默认遥测） |
| **Electron CrashReporter** | `uploadToServer=false` | ✅ **保留**（本地 crash dump，不上传） |
| **自动上传用户代码 / Prompt / Session** | 未发现 | — 无需处理 |

## 2. 详细发现

### 2.1 Sentry（崩溃上报）— 彻底移除

Phase 1 清除了运行时代码；Phase 1.9 补清了构建期与元数据残留：

- `packages/desktop/src/renderer/index.tsx` — 移除 `import * as Sentry` 和 `Sentry.init(...)` 块
- `packages/app/src/entry.tsx` — 移除 `import * as Sentry` 和 `Sentry.init(...)` 块
- `packages/app/src/app.tsx` — 移除 `Sentry.captureException(error)`
- `packages/app/src/pages/error.tsx` — 移除 Sentry 上报按钮
- `packages/app/vite.config.ts` — 移除 `sentryVitePlugin`、`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_RELEASE`/`VITE_SENTRY_RELEASE`、plugins 数组中的 sentry
- `packages/desktop/electron.vite.config.ts` — 移除 `const sentry = false` 残留，plugins 仅保留 appPlugin
- `packages/app/src/env.d.ts` — 移除 `VITE_SENTRY_*` 类型声明
- 依赖：根 `package.json` catalog、`packages/app/package.json`、`packages/desktop/package.json`、`bun.lock` 中的 `@sentry/solid` / `@sentry/vite-plugin` **全部移除**

当前状态：运行时代码、构建配置、package dependency、lockfile 均无 Sentry。
（`packages/ui/src/components/file-icons/sprite.svg` 中的 Sentry 是文件类型图标，非遥测。）

### 2.2 Auto Update（自动更新）— 禁用

- `packages/desktop/src/main/constants.ts`：`UPDATER_ENABLED = false`（硬编码禁用）。
- `updater-controller.ts` 中 `check()` 在 `enabled=false` 时直接短路，不调用
  `autoUpdater.checkForUpdates()`（唯一的网络请求点）；10 分钟定时器同样短路。
- 菜单"检查更新"项在 updater disabled 时置灰。

### 2.3 Session Share（会话分享）— HSCode 硬禁用

- 后端：`packages/opencode/src/share/share-next.ts` 中 `const disabled = true`。
  任何环境变量（包括 `OPENCODE_DISABLE_SHARE=false`）都无法恢复上传。
  `sync` / `create` / `remove` / `init` 全部短路，不上传 Session / Message / Part / diff / model 到 `https://opncd.ai`。
- Config：`packages/opencode/src/config/config.ts` 强制 `result.share = "disabled"`，
  UI 层 `config.share === "disabled"` 守卫生效，`/share` `/unshare` `Copy Share Link` 不显示。
- 保留 `Export Session` 本地导出能力。

### 2.4 模型元数据（models.opencode.ai）— HSCode 默认禁用

- `packages/core/src/models-dev.ts` 从 `https://models.opencode.ai/api.json` 拉取模型列表并每 60 分钟刷新。
- HSCode Desktop 启动时（`packages/desktop/src/main/index.ts`）注入
  `process.env.OPENCODE_DISABLE_MODELS_FETCH = "true"`，sidecar 继承后：
  - `populate()` 短路返回 `{}`，不产生 fetch；
  - 周期 refresh 定时器不启动。
- 保留用户手动加载能力：`OPENCODE_MODELS_PATH`（本地文件）/ `OPENCODE_MODELS_URL`（自定义源）仍生效。
- 记录：HSCode 默认禁用模型元数据联网；后续 Phase 2 由自定义 Provider 提供模型配置。

### 2.5 远程 Release Notes — 禁用

- `packages/app/src/context/highlights.tsx`：不再请求任何远程 changelog（`start()` 直接标记已读并返回）。
- `CHANGELOG_URL` 常量已删除；本地 `CHANGELOG.md` 保留。

### 2.6 hscode.dev — 无依赖

HSCode 没有 hscode.dev 服务。Phase 1 曾把 `opencode.ai` URL 简单替换为 `hscode.dev`，Phase 1.9 已全部清除：

- 通知图标（`entry.tsx`、`renderer/index.tsx`）：不再传远程 icon。
- 帮助菜单 Documentation：改为 GitHub 仓库页；Discussions 未启用，菜单已删。
- 远程 changelog：已禁用（见 2.5）。
- 剩余 `hscode-dev` 仅出现在 Linux rpm 包名（`electron-builder.config.ts`），非网络依赖。

### 2.7 OpenTelemetry / OTLP — 默认不启用

- 位置：`packages/core/src/observability/otlp.ts`。
- 行为：只有用户主动配置 `OTEL_EXPORTER_OTLP_ENDPOINT` 时才发送日志/traces；默认 `undefined`，不上传。
- 判定：非默认遥测，保留（Phase 2 排查模型问题时可能用到）。

### 2.8 Electron CrashReporter — 本地保存，不上传

- 位置：`packages/desktop/src/main/logging.ts`：`crashReporter.start({ uploadToServer: false })`。
- 行为：本地 crash dump；`uploadToServer=false`，不会自动上传。保留。

### 2.9 GitHub 集成（api.opencode.ai）— 仅用户主动

- `packages/opencode/src/cli/cmd/github.handler.ts` 使用 `https://api.opencode.ai`。
- 仅在用户主动连接 GitHub 集成功能时触发，非被动遥测。保留。

## 3. 被动外联状态（普通启动）

| 域名 | Phase 1.9 后普通启动是否请求 | 触发条件 | 是否用户主动 | 传输内容 | 是否保留 |
|---|---|---|---|---|---|
| `sentry.io`（含 @sentry 全家桶） | **否（0 请求）** | — | — | — | 已移除 |
| `opncd.ai`（Session Share） | **否（0 请求）** | 硬禁用，无法触发 | — | — | 已禁用 |
| `models.opencode.ai` | **否（0 请求）** | HSCode 默认注入禁用 flag | — | 模型元数据（只读） | 默认禁用，可本地加载 |
| `hscode.dev` | **否（0 请求）** | — | — | — | 已移除 |
| `opencode.ai` | 仅用户点击 UI 外链 | 用户点击 ExternalLink | ✅ | — | 保留（品牌链接逐步处理） |
| `api.opencode.ai` | 仅用户主动 GitHub 集成 | 用户操作 | ✅ | GitHub OAuth | 保留 |
| LLM provider（openai/anthropic/x.ai/google/models.dev 等） | 仅用户配置后调用 | 用户配置 API key | ✅ | 模型请求 | 保留（Phase 2 用自定义 OpenAI Compatible） |

## 4. 数据目录隔离

HSCode 与原版 OpenCode 完全隔离：

- Electron App ID：`ai.hscode.desktop[.dev|.beta]`（原 `ai.opencode.desktop.*`）
- Electron userData：`%APPDATA%/ai.hscode.desktop.dev` 等
- Core 数据目录：`data/hscode`、`cache/hscode`、`config/hscode`、`state/hscode`、`tmp/hscode`
  （`packages/core/src/global.ts` 中 `const app = "hscode"`）
- Tauri 迁移、背景 CLI 状态检测等均改用 hscode 命名空间，不读取原版 OpenCode 数据。