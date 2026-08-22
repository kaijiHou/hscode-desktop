# HSCode 变更记录（Change Log）

> 本文档详细记录每一次对 OpenCode 上游的修改。格式：修改了什么 / 为什么 / 涉及文件 /
> 是否影响原功能 / 如何验证 / 验证结果 / 遗留问题 / 对应 Git Commit。
> 上游：`https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`。

---

## CHANGE-001：品牌套皮（OpenCode → HSCode）

**日期**：2026-08-22

### 修改了什么
将用户可见的应用名称、deep-link 协议、打包产物名、存储 key、外链等从 `OpenCode` 品牌替换为 `HSCode`。

### 为什么修改
第一阶段目标：把 OpenCode 套皮成自用的 HSCode，不改核心逻辑。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/desktop/src/main/index.ts` | `APP_NAMES` 三档改为 `HSCode Dev/Beta/HSCode`；`app.setName` 非打包态改 `HSCode Dev`；deep-link 协议 `opencode://` → `hscode://`；`setAsDefaultProtocolClient("hscode")` |
| `packages/desktop/electron-builder.config.ts` | `artifactName` 改 `hscode-desktop-${os}-${arch}.${ext}`；`productName`/`packageName` 等改 HSCode/hscode 变体 |
| `packages/desktop/src/renderer/index.tsx` | deep-link 事件名改 `hscode:deep-link`；窗口 last-active-url 存储 key 改 `hscode.desktop.window.${windowID}.last-active-url`；icon/favicon 改 hscode；语言存储 key 改 `hscode.global.dat` |
| `packages/app/src/desktop-menu.ts` | 文档/支持/反馈/issue 链接改为 `https://hscode.dev/docs`、`https://github.com/kaijiHou/hscode/...` |
| `packages/app/src/entry.tsx` | `DEFAULT_SERVER_URL_KEY` 改 `hscode.settings.dat:defaultServerUrl`；icon 改 hscode |
| `packages/app/src/context/highlights.tsx` | `CHANGELOG_URL` 改 `https://hscode.dev/changelog.json` |

### 是否影响原功能
不影响核心逻辑。仅替换字符串常量（名称、协议、存储 key、外链）。存储 key 变更会导致
首次运行时读不到旧 `opencode.*` 的本地存储（视为全新应用，符合套皮预期）。

### 如何验证 / 验证结果
- 静态检查：`grep` 确认上述位置已无 `opencode://` / `OpenCode` 品牌字样。
- 运行验证：**已验证**。`bun run electron-vite dev` 启动成功，Electron 窗口正常显示，onboarding 完成，sidecar 正常退出。
- 验证结果：**通过**。

### 遗留问题
- 设置组件（`packages/app/src/components/settings/*`）中仍残留部分 `opencode.ai` 外链（不影响核心功能，后续阶段处理）。

### 对应 Git Commit
`2ef3134`（已提交）

---

## CHANGE-002：隐私清理 —— 移除 Sentry 崩溃上报

**日期**：2026-08-22

### 修改了什么
移除所有 Sentry（`@sentry/solid`）初始化、错误上报调用、错误页"上报"按钮，以及构建期的
Sentry sourcemap 上传插件。

### 为什么修改
用户要求"所有涉及隐私的内容全关掉"。Sentry 会向外部服务器上报崩溃日志和用户环境信息。

### 涉及文件

**代码层面（6 个文件）：**

| 文件 | 改动 |
|---|---|
| `packages/desktop/src/renderer/index.tsx` | 移除 `import * as Sentry` 和 `Sentry.init(...)` 块 |
| `packages/app/src/entry.tsx` | 移除 `import * as Sentry` 和 `Sentry.init(...)` 块 |
| `packages/app/src/app.tsx` | ErrorBoundary 中移除 `Sentry.captureException(error)` |
| `packages/app/src/pages/error.tsx` | 移除 Sentry 上报按钮（`<Show when={Sentry.isEnabled}>` 区块） |
| `packages/desktop/electron.vite.config.ts` | 移除 `import { sentryVitePlugin }`；`const sentry = false` |
| `packages/app/src/env.d.ts` | 移除 `VITE_SENTRY_DSN`、`VITE_SENTRY_ENVIRONMENT`、`VITE_SENTRY_RELEASE` 类型声明 |

**依赖清理（3 个 package.json + bun.lock）：**

| 文件 | 改动 |
|---|---|
| `package.json`（根） | catalog 中移除 `@sentry/solid`、`@sentry/vite-plugin` |
| `packages/app/package.json` | devDependencies 移除 `@sentry/solid`、`@sentry/vite-plugin` |
| `packages/desktop/package.json` | devDependencies 移除 `@sentry/solid`、`@sentry/vite-plugin` |
| `bun.lock` | 同步更新（移除 Sentry 锁条目） |

### 是否影响原功能
不影响运行时功能。移除的是错误上报和 sourcemap 上传，不改变应用行为。

### 如何验证 / 验证结果
- typecheck：`tsgo -b` 在 app、desktop、opencode 三个包全部通过。
- 静态扫描：`grep -rn "sentry" packages/` 仅剩注释和 CSS 误报（`scrollbar`）。
- node_modules 确认：`@sentry` 目录已不存在。
- 验证结果：**通过**。

### 遗留问题
无。

### 对应 Git Commit
- 代码层面：`fc1b8d5`（已提交）
- 依赖清理：`f443752`（已提交）

---

## CHANGE-003：隐私清理 —— 禁用自动更新（electron-updater）

**日期**：2026-08-22

### 修改了什么
`packages/desktop/src/main/constants.ts` 中 `UPDATER_ENABLED` 从
`app.isPackaged && CHANNEL !== "dev"` 硬编码改为 `false`。

### 为什么修改
用户要求"所有涉及隐私的内容全关掉"。自动更新会连接上游服务器检查/下载更新。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/desktop/src/main/constants.ts` | `UPDATER_ENABLED = false`（注释说明：不连接上游更新服务） |

### 是否影响原功能
不影响运行。`updater-controller.ts` 中 `check()` 方法在 `enabled=false` 时直接短路，
不会调用 `autoUpdater.checkForUpdates()`（唯一的网络请求点）。菜单项也会被 disabled。

### 如何验证 / 验证结果
- 代码审查：确认 `check()` / `start()` / 10 分钟定时器均在 `enabled=false` 时短路。
- 运行验证：`bun run electron-vite dev` 启动成功，日志显示 `auto updater configured` 但无网络请求。
- 验证结果：**通过**。

### 遗留问题
无。

### 对应 Git Commit
`be81563`（已提交）

---

## CHANGE-004：隐私清理 —— 默认禁用 Session Share（会话分享）

**日期**：2026-08-22

### 修改了什么
`packages/opencode/src/share/share-next.ts` 中 disabled 判断从
`process.env["OPENCODE_DISABLE_SHARE"] === "true" || === "1"`
改为 `process.env["OPENCODE_DISABLE_SHARE"] !== "false"`。
即：默认禁用，只有显式设为 `false` 才启用。

### 为什么修改
用户要求"所有涉及隐私的内容全关掉"。上游默认开启分享，会将会话上传到 `https://opncd.ai`。

### 涉及文件

| 文件 | 改动 |
|---|---|
| `packages/opencode/src/share/share-next.ts` | disabled 逻辑反转（默认禁用） |

### 是否影响原功能
影响：session 分享功能默认关闭。如需恢复，设环境变量 `OPENCODE_DISABLE_SHARE=false`。

### 如何验证 / 验证结果
- typecheck：通过。
- 静态检查：确认逻辑反转正确（`!== "false"` = 默认 true/disabled）。
- 验证结果：**通过**。

### 遗留问题
无。

### 对应 Git Commit
`3686da1`（已提交）

---

## 全局遗留问题汇总

1. 设置组件（`packages/app/src/components/settings/*`）中仍残留部分 `opencode.ai` 外链——后续阶段处理。
2. `packages/core/src/models-dev.ts` 拉取公开模型元数据（`models.opencode.ai`），已保留并在隐私文档中说明。
3. `api.opencode.ai` 仅在用户主动 GitHub 集成时使用，已保留并在隐私文档中说明。
4. Windows 环境 `core.symlinks=false` 导致 60 个符号链接被检出为文本文件——已通过 `scripts/hscode-materialize-symlinks.sh` 脚本实体化，仅本地生效不提交。
5. Dev 启动需 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR bundle 含 37MB sidecar）。

## 全局待提交清单（截至本记录）

所有 CHANGE-001~004 已提交。剩余待提交：
- `docs/` 目录（upstream-baseline、architecture-notes、privacy-audit、change-log、handoff）
- `CHANGELOG.md`、`README.md`
- `.gitignore`（新增 `models-api.json`）
- `scripts/hscode-materialize-symlinks.sh`
