# HSCode 隐私审计

> 审计对象：OpenCode 上游 `https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`。
> 审计日期：2026-08-22。目标：在套皮为 HSCode 前，识别所有对外网络行为并做隐私清理。

## 1. 审计结论（TL;DR）

| 项目 | 上游行为 | HSCode 处理 |
|---|---|---|
| **Sentry 崩溃/错误上报** | 条件初始化（需 `VITE_SENTRY_DSN`） | ✅ **已移除**（渲染入口 + app 入口 + 错误页按钮 + vite 上传插件） |
| **electron-updater 自动更新** | 打包后自动检查更新 | ✅ **已禁用**（`UPDATER_ENABLED = false`） |
| **Session Share（会话分享）** | 默认开启，上传到 `https://opncd.ai` | ✅ **默认禁用**（改 `OPENCODE_DISABLE_SHARE` 判断逻辑） |
| **模型元数据拉取** | 只读拉取 `https://models.opencode.ai`（公开模型名/定价） | ⚠️ **保留**（不上传用户数据，可用环境变量覆盖） |
| **自动上传用户代码 / Prompt / Session** | 未发现 | — 无需处理 |

## 2. 详细发现

### 2.1 Sentry（崩溃上报）— 已移除

上游存在以下 Sentry 接入点，HSCode 全部移除：

- `packages/desktop/src/renderer/index.tsx` — `Sentry.init({...})`（渲染进程，需 `VITE_SENTRY_DSN`）
- `packages/app/src/entry.tsx` — `Sentry.init({...})`（app 入口）
- `packages/app/src/app.tsx` — `ErrorBoundary` fallback 中 `Sentry.captureException(error)`
- `packages/app/src/pages/error.tsx` — 错误页"上报"按钮（`Sentry.isEnabled` / `captureException`）
- `packages/desktop/electron.vite.config.ts` — `sentryVitePlugin`（构建时上传 sourcemap 到 Sentry）

**清理方式**：移除初始化代码、移除 `@sentry/solid` import、移除错误页上报按钮、将
`sentryVitePlugin` 替换为 `false`（不再上传 sourcemap）。相关 `@sentry/*` 依赖保留在
lockfile 中但不再被引用，不影响隐私。

### 2.2 Auto Update（自动更新）— 已禁用

- `packages/desktop/src/main/constants.ts` 原逻辑：
  `UPDATER_ENABLED = app.isPackaged && CHANNEL !== "dev"`
- HSCode 改为：`UPDATER_ENABLED = false`（硬编码禁用，不连接上游更新服务）。
- 相关 `updater*.ts` 文件保留但不会被激活。

### 2.3 Session Share（会话分享）— 默认禁用

- 上传逻辑：`packages/opencode/src/share/share-next.ts`
- 上传目标：`https://opncd.ai`（可被 `enterprise.url` 覆盖）
- 上游开关：`OPENCODE_DISABLE_SHARE === "true" | "1"` 才禁用（默认开启）
- HSCode 改为：**默认禁用**，仅当显式设置 `OPENCODE_DISABLE_SHARE=false` 才启用。

### 2.4 模型元数据（models.opencode.ai）— 保留（只读）

- `packages/core/src/models-dev.ts` 从 `https://models.opencode.ai/api.json` 拉取模型列表。
- 内容：模型名、定价等**公开元数据**；**不上传**用户代码 / Prompt / Session。
- 可通过 `OPENCODE_MODELS_URL`（换源）或 `OPENCODE_MODELS_PATH`（本地文件）覆盖。
- 判定：非隐私风险，保留以维持模型列表功能。

### 2.5 GitHub 集成（api.opencode.ai）— 保留（仅用户主动）

- `packages/opencode/src/cli/cmd/github.handler.ts` 使用 `https://api.opencode.ai`。
- 仅在用户主动连接 GitHub 集成功能时触发，非被动遥测。保留。

## 3. 对外域名扫描结果

全仓扫描 `packages/core/src/` 与 `packages/opencode/src/` 中的 `https://` 域名（排除测试/示例）：

| 域名 | 次数 | 说明 |
|---|---|---|
| `opencode.ai` | 30 | 品牌/文档链接（套皮时逐步替换） |
| `github.com` | 26 | 开源链接 |
| `v5.ai-sdk.dev` | 15 | AI SDK 文档引用 |
| `api.openai.com` / `platform.openai.com` | 6/3 | OpenAI provider（用户配置后主动调用） |
| `opncd.ai` | 3 | Session Share 上传（已默认禁用） |
| `models.opencode.ai` | 2 | 模型元数据（只读，保留） |
| `api.opencode.ai` | 2 | GitHub 集成（仅主动） |
| `googleapis.com` / `gitlab.com` / `chatgpt.com` / `x.ai` 等 | 少量 | 各 LLM provider 端点（用户配置后主动调用） |

> 说明：LLM provider 端点（OpenAI/Anthropic/xAI/Google 等）是用户主动配置后才调用，
> 属于正常功能，不在"被动遥测"清理范围内。

## 4. 未覆盖 / 遗留

- 套皮阶段仍残留部分 `opencode.ai` 品牌链接（设置组件等），将在后续品牌替换中处理。
- `@sentry/*` 依赖仍在 `bun.lock` / `package.json` 中（未引用），如需彻底移除可在后续阶段清理 `package.json`。
