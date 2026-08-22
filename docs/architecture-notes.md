# HSCode 架构笔记（基于 OpenCode）

> 本文档记录 HSCode 所基于的 OpenCode 上游代码库的核心架构，供后续魔改参考。
> 上游：`https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`。

## 1. Monorepo 结构

OpenCode 是一个 Bun workspace monorepo，核心包在 `packages/` 下：

| 包 | 作用 |
|---|---|
| `core` | 核心库：config、database、models、provider、event、share 表结构等 |
| `opencode` | CLI 主程序：agent、session、share、control-plane、server 等 |
| `desktop` | **Electron 桌面壳**（HSCode 套皮主战场） |
| `app` | SolidJS 前端应用（渲染层），被 desktop 和 web 复用 |
| `ui` | 共享 UI 组件库 |
| `client` / `sdk` / `sdk-next` | 客户端 SDK |
| `console` | 控制台相关 |
| `web` | Web 版入口 |
| `tui` | 终端 UI |
| `docs` / `storybook` | 文档/组件演示 |

根 `package.json` 的 `workspaces` 覆盖 `packages/*`、`packages/console/*`、`packages/stats/*`、`packages/sdk/js`、`packages/slack`。

## 2. Desktop（Electron 壳）

`packages/desktop/` 结构：

- `src/main/` — Electron 主进程
  - `index.ts` — 入口，定义 `APP_NAMES`、deep-link 协议、`setAsDefaultProtocolClient`（HSCode 已改）
  - `constants.ts` — `UPDATER_ENABLED`、channel 等（HSCode 已禁用自动更新）
  - `updater.ts` / `updater-controller.ts` / `updater-subscriptions.ts` — electron-updater 逻辑
  - `server.ts` / `sidecar.ts` — 本地 sidecar 服务
  - `window-registry.ts` / `windows.ts` / `window-state.ts` — 窗口管理
  - `ipc.ts` / `menu.ts` / `desktop-menu-actions.ts` — IPC 与菜单
- `src/renderer/` — 渲染进程（加载 `@opencode-ai/app`）
  - `index.tsx` — 渲染入口，含 Sentry 初始化（HSCode 已移除）
- `electron.vite.config.ts` — electron-vite 构建配置（HSCode 已移除 Sentry 上传插件）
- `electron-builder.config.ts` — 打包配置（HSCode 已改产物名/包名）

关键 scripts（`packages/desktop/package.json`）：
- `dev` → `electron-vite dev`（开发）
- `build` → `electron-vite build`
- `package` → `electron-builder --config electron-builder.config.ts`
- `predev` → `bun ./scripts/predev.ts`（会执行 Electron postinstall）

**注意**：desktop 依赖 `electron@42.3.3`。Electron 二进制通过 npm postinstall 下载，放在
`node_modules/.bun/electron@42.3.3*/node_modules/electron/dist/`。

## 3. App（SolidJS 前端）

`packages/app/src/`：
- `entry.tsx` — 应用入口，含 Sentry 初始化（HSCode 已移除）
- `app.tsx` — 根组件，`ErrorBoundary` 里曾调用 `Sentry.captureException`（HSCode 已移除）
- `pages/error.tsx` — 错误页，曾有"上报到 Sentry"按钮（HSCode 已移除）
- `desktop-menu.ts` — 桌面菜单项定义（文档/支持/反馈链接，HSCode 已改）
- `context/highlights.tsx` — `CHANGELOG_URL`（HSCode 已改）
- `context/` — 各种 context（platform、language 等）

## 4. Share（会话分享）

真正的上传逻辑在 `packages/opencode/src/share/share-next.ts`：
- 上传目标：`https://opncd.ai`（可通过 `enterprise.url` 覆盖）
- 开关：环境变量 `OPENCODE_DISABLE_SHARE`
- **HSCode 已改为默认禁用**（除非显式设 `OPENCODE_DISABLE_SHARE=false`）

数据库表：`packages/core/src/share/sql.ts` 定义 `SessionShareTable`。

## 5. 模型元数据

`packages/core/src/models-dev.ts`：
- 默认从 `https://models.opencode.ai/api.json` 拉取模型元数据（模型名/定价等公开信息）
- 可用环境变量 `OPENCODE_MODELS_URL` 覆盖、`OPENCODE_MODELS_PATH` 指向本地文件
- **只读拉取，不上传用户数据**，保留（详见隐私审计）

## 6. 外部域名一览

见 `docs/privacy-audit.md`。
