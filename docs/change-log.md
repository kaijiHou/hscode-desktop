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

## CHANGE-005：裁剪非 Desktop 包与大型无关资产

**日期**：2026-08-22

### 修改了什么
从仓库中删除与 HSCode 桌面端无关的 package 与大型资产：

- 删除的 package：`console`、`web`、`stats`、`storybook`、`slack`、`sdk-next`、
  `enterprise`、`containers`、`docs`、`function`、`httpapi-codegen`、`identity`
- 删除的大文件：`*.mp4`（共 4 个，约 42MB）、测试用大图片（`picture-5mb-base64.png`、
  `large-image.png`、`models-api.json` fixture）
- 删除的多语言 README：`README.ar.md` 等 21 个变体
- 删除的上游配置/文档：`.github/`（CI/CD）、`.husky/`、`.turbo/`、`.vscode/`、`.zed/`、
  `artifacts/`、`infra/`、`nix/`、`sdks/`、`specs/`、`perf/`、`AGENTS.md`、`CONTEXT.md`、
  `STATS.md`、`SECURITY.md`、`CONTRIBUTING.md`、`flake.*`、`sst.*`

### 为什么修改
HSCode 目标是 Desktop 自用版。裁剪非核心包可降低仓库体积与维护成本。

### 是否影响核心
不影响。保留桌面端核心依赖链：`desktop`、`app`、`ui`、`opencode`、`core`、`client`、
`schema`、`sdk`（含 `sdk/js`）、`session-ui`、`codemode`、`llm`、`plugin`、`protocol`、
`script`、`server`、`tui`、`effect-drizzle-sqlite`、`effect-sqlite-node`、`http-recorder`、
`cli`、`http-recorder`。

### 风险与修复
大规模删除可能造成 workspace / scripts / imports / build 残留引用。Phase 1.9 已修复：

- 根 `package.json`：删除 `dev:console`、`dev:stats`、`dev:storybook`、`upgrade-opentui`、
  `prepare`（husky）、`random`、`sso`、`translate:app` 死脚本；workspaces 移除
  `packages/console/*`、`packages/stats/*`、`packages/slack`，保留 `packages/*` 与 `packages/sdk/js`
- `packages/client/package.json`：移除已删的 `@opencode-ai/httpapi-codegen` devDependency
  （代码生成工具，产物 `src/generated-effect/client.ts` 已生成）
- `patches/` 目录被误删后从上游恢复（含 `@ai-sdk/openai-compatible` patch，Phase 2 依赖）
- `copy-metainfo.ts`：移除指向已删 `packages/web` 的截图 URL 与上游链接

### 如何验证
- `bun install`：成功解析 workspace（移除 16 个已删包引用，lockfile 已更新）
- `typecheck`：app / desktop / opencode / core 四包全部通过

### 验证结果
PASS

### 对应 Git Commit
- 删包主体：`a5b7685`（已推送 GitHub）
- 死脚本/workspace 修复：见 CHANGE-006 各 commit

---

## CHANGE-006：Phase 1.9 Baseline Repair & Privacy Closure

**日期**：2026-08-22

### 修改了什么
修复 Phase 1 遗留问题，使 GitHub HEAD 达到品牌完整、无被动隐私外联、数据隔离、可运行的基线。

#### 6.1 Sentry 构建期残留清理（P0）
- `packages/app/vite.config.ts`：移除 `sentryVitePlugin` import、`SENTRY_AUTH_TOKEN` /
  `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_RELEASE` / `VITE_SENTRY_RELEASE` 读取、
  `const sentry` 变量、plugins 数组中的 sentry —— 只保留 `[desktopPlugin]`
- `packages/desktop/electron.vite.config.ts`：移除 `const sentry = false` 残留，renderer
  plugins 仅保留 `[appPlugin]`
- `git grep sentry`：运行时代码 / 构建配置 / package dependency 均无 Sentry
- 原因：Phase 1 只删了依赖没删 `vite.config.ts` 的引用，导致 ① 隐私清理不完整
  ② package.json 与源码不一致 ③ build 可能失败

#### 6.2 模型元数据默认禁止联网（P1）
- `packages/desktop/src/main/index.ts`：启动时注入 `process.env.OPENCODE_DISABLE_MODELS_FETCH = "true"`
- 效果：`models-dev.ts` 的 `populate()` 与周期 refresh 短路，普通启动不请求 `models.opencode.ai`
- 保留 `OPENCODE_MODELS_PATH`（本地）/ `OPENCODE_MODELS_URL`（自定义源）能力

#### 6.3 虚假 hscode.dev 网络依赖清除（P0/P1）
- `highlights.tsx`：禁用远程 Release Notes 拉取（`start()` 短路，不再 fetch），删除
  `CHANGELOG_URL` 常量与全部 parse 逻辑；本地 `CHANGELOG.md` 保留
- `desktop-menu.ts`：Documentation 链接改为 GitHub 仓库；Discussions 未启用，删除无效菜单；
  Feedback/Bug 链接改为 `kaijiHou/hscode-desktop/issues/new`
- `entry.tsx` / `renderer/index.tsx`：Notification 不再传远程 icon（避免 HTTP 请求）
- 原因：`hscode.dev` 是 Phase 1 人为引入的虚假域名，HSCode 没有该服务

#### 6.4 Session Share 彻底禁用（P1）
- `share-next.ts`：`const disabled = true`（硬编码，环境变量无法恢复）
- `config/config.ts`：强制 `result.share = "disabled"`，UI 层 share/unshare 命令隐藏
- 保留 `Export Session` 本地导出

#### 6.5 数据目录隔离（P0）
- `main/index.ts`：APP_IDS → `ai.hscode.desktop[.dev|.beta|]`，dev 模式 appId 同步
- `core/src/global.ts`：`const app = "opencode"` → `"hscode"`，数据目录变为
  `data/hscode` `cache/hscode` `config/hscode` `state/hscode` `tmp/hscode`
- `migrate.ts`：TAURI 迁移 id → hscode（不读原版数据）
- `background-cli.ts`：desktopStateNames → hscode
- `deep-links.ts`：`hscode://` 协议前缀 + `hscode:deep-link` 事件
- `copy-metainfo.ts`：appId / productName → HSCode，移除上游链接与截图

#### 6.6 electron-builder 配置（P1）
- APP_IDS → `ai.hscode.desktop.*`
- dev 通道 protocols：`{ name: "HSCode", schemes: ["hscode"] }`（统一 dev/beta/prod）
- publish：`owner: "kaijiHou", repo: "hscode-desktop"`
- productName：HSCode Dev / HSCode Beta / HSCode（保持不变）

#### 6.7 Desktop package metadata（P2）
- `packages/desktop/package.json`：homepage → `https://github.com/kaijiHou/hscode-desktop`，
  author → `{ "name": "HSCode" }`（不添加假邮箱）

### 是否影响原功能
不影响核心 Agent / Session / Provider / tool calling。`@ai-sdk/openai-compatible` 保留，
Phase 2 接 llama.cpp / Qwen 依赖它。

### 如何验证
- `bun install`：workspace 解析成功（移除已删包引用，lockfile 更新）
- `typecheck`：`packages/app`、`packages/desktop`、`packages/opencode`、`packages/core` 全部 PASS
- `electron-vite dev`：Electron 窗口正常启动，sidecar 连接，onboarding 进入
- 隐私扫描：`git grep` 确认 sentry/opncd.ai/hscode.dev 无被动引用

### 验证结果
PASS

### 对应 Git Commit
Phase 1.9 实际新增 **7 个 commit**（自起始基线 `982fcc5` 之后）：

```
b09a0c6 fix(privacy): remove remaining Sentry build integration
c97ce7f fix(privacy): disable passive remote metadata and release requests
57f7251 fix(privacy): hard-disable session sharing in HSCode
39e4827 fix(branding): isolate HSCode app data and runtime paths
b5ca371 fix(branding): correct desktop metadata and repository links
4a5eca6 chore(repo): clean dead workspace scripts after package pruning
8543275 docs: record Phase 1.9 repair and privacy closure
```

若把 Phase 1.9 起始基线 `982fcc5`（docs: update repo URL）一起显示，列表共 8 条；
Phase 1.9 自身新增为 7 commits。

---

## 全局遗留问题汇总（Phase 1.9 后）

1. 设置组件（`packages/app/src/components/settings/*`、`dialog-connect-provider.tsx`）中仍残留
   `opencode.ai` 外链（Zen 宣传、docs 链接），均为用户主动点击的 ExternalLink，非被动外联——可后续处理。
2. Windows 环境 `core.symlinks=false`：60 个符号链接需通过 `scripts/hscode-materialize-symlinks.sh` 实体化。
3. Dev 启动需 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR bundle 含 37MB sidecar）。
4. `electron-builder.config.ts` 引用 `script/sign-windows.ps1`（CI 签名脚本），`script/` 目录已被裁剪，
   仅在 GitHub Actions Windows 签名时需要，本地打包无碍。
5. 早期本地细粒度 commit（fc1b8d5 等）在首次公开 push 时被 squash；当前以 GitHub 可追溯 commit 为准。

---

## CHANGE-007：Phase 2A — Baseline Verification + Native Network Inspector MVP

**日期**：2026-08-24

### 目标
1. 为 Phase 1.9 关键隐私/隔离修改补齐真正自动化测试（Part A）。
2. 新增 HSCode 原生抓包功能 Network Inspector（Part B，Windows 第一版）。

### Part A — Phase 1.9 Verification Closure

**新增/修改**：
- `packages/opencode/test/share/share-next.test.ts`：改写为 HSCode disabled 语义——
  create/remove 零 HTTP 请求、diff 事件不同步、`OPENCODE_DISABLE_SHARE=false` 无法恢复上传（8 PASS）
- `packages/opencode/test/config/config.test.ts`：autoshare 断言更正（share 强制 disabled）
- `packages/core/src/global-path-isolation.test.ts`（新增）：data/cache/config/state/tmp 全 hscode 命名空间（7 PASS）
- `packages/desktop/src/main/app-identity.ts` + test（新增）：APP_IDS 抽为可测纯模块
  （dev/beta/prod → ai.hscode.desktop.*，极小重构，main 行为不变）（5 PASS）
- `packages/app/src/context/highlights.tsx` + test（新增）：抽 `createHighlights` 工厂，
  真实 start 逻辑 0 远程 fetch（2 PASS）
- Test B（models 被动拉取禁用）由既有 `packages/core/test/models.test.ts` 覆盖
  （preload 全局 `OPENCODE_DISABLE_MODELS_FETCH=true`，9 PASS）

**测试结果**：62 PASS / 0 FAIL / 0 SKIPPED。无 skip/todo/空值兜底/核心 mock；
仅 HTTP 边界用计数 fake。

### Part B — Network Inspector（Windows MVP）

**新增文件**：
```
packages/desktop/src/main/network/parser.ts          包解析（IPv4/IPv6/TCP/UDP/ICMP/HTTP/HEX）
packages/desktop/src/main/network/filter.ts          HSCode filter → WinDivert filter 映射 + 校验
packages/desktop/src/main/network/native.ts          koffi FFI 封装 WinDivert（open/recv/shutdown/close）
packages/desktop/src/main/network/capture-worker.ts  worker_threads 抓包循环（不阻塞 main）
packages/desktop/src/main/network/capture-service-core.ts  状态机 + ring buffer + detail cache
packages/desktop/src/main/network/capture-service.ts       协调层（生命周期/广播）
packages/desktop/src/main/network/network-ipc.ts     IPC 注册（start/stop/clear/get-*）
packages/desktop/src/preload/types.ts + index.ts     NetworkAPI preload 桥
packages/app/src/components/network/network-panel.tsx    抓包 UI（列表/详情/HEX/ASCII）
packages/app/src/components/network/network-host.tsx     命令面板入口（network.toggle）
packages/desktop/resources/win/WinDivert.dll         官方 2.2.2-A x64 二进制
packages/desktop/resources/win/WinDivert64.sys       （LGPLv3/GPLv2 双许可）
packages/desktop/resources/win/WinDivert-LICENSE.txt
docs/network-inspector-architecture.md               架构文档
scripts/native-smoke-test.cjs                        原生边界 smoke（错误映射验证）
scripts/native-capture-test.cjs/.bat                 真抓包验证（管理员）
```

**修改**：`packages/desktop/src/main/index.ts`（注册 Network IPC）、`packages/app/src/app.tsx`
（挂载 NetworkInspectorHost）、`packages/desktop/package.json`（koffi devDep）。

**架构决策**：
- WinDivert 2.2.2 官方预构建（LGPL v3 / GPL v2 双许可，可随个人项目集成）
- koffi 3.1.6 FFI（prebuilt 零编译）替代 C++ N-API addon（本机无 MSVC）与
  npm `windivert` 1.0.2（2015 年 9 年未维护）
- 抓包循环在 worker_threads，不阻塞 Electron main event loop
- Native 错误结构化：ADMIN_REQUIRED / DLL_NOT_FOUND / DRIVER_MISSING / RECV_FAILED
- Renderer 不持有 native handle，只走 IPC（可序列化 payload）
- ring buffer 上限 5000、detail cache 上限 500（超限丢最旧）

**权限行为**：`WinDivertOpen()` 需管理员。非管理员 → ADMIN_REQUIRED 明确提示
（真实驱动验证：error 5 ACCESS_DENIED），不 crash；DLL 缺失 → "engine unavailable"。

**HTTP MVP 边界**：单包完整请求头识别（GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS +
path + version + Host）。不承诺完整 TCP 流重组：
> HTTP parser currently detects complete request headers contained in one
> captured TCP payload. TCP stream reassembly is planned for a later phase.

**真实验证（管理员权限）**：
```
capture open OK
UDP 127.0.0.1:52532→42896 payload="hello-hscode-udp"     ✔
TCP GET /hscode-network-test HTTP/1.1 Host:               ✔（HTTP 识别）
recv count: 142, seen: {tcp:137, udp:5, http:6} → PASS
```
非管理员 smoke：`WinDivertOpen=-1, GetLastError=5 → ADMIN_REQUIRED` ✔

### 已知问题
1. 抓包会话需管理员权限（普通启动提示重开为管理员）
2. IPv6 地址压缩为 best-effort；过滤器仅限 IPv4 地址形式
3. `scripts/native-capture-test.cjs` 为本地验证脚本，不进 release
4. electron-builder 打包需将 resources/win 纳入 extraResources（未验证打包流程）

### 对应 Git Commit
见 Phase 2A 各 commit（test/docs/parser/native/service/ipc/ui）。

## 全局待提交清单（截至 Phase 1.9）

CHANGE-005/006 完成后，剩余待提交：
- 本轮全部修复代码（见各 commit）
- `docs/` 更新（privacy-audit、change-log、handoff、architecture-notes、CHANGELOG、README）


---

## CHANGE-008 — Network UI Integration & Visible Branding Closure（Phase 2A.1）

**日期**：2026-08-26

### 背景
Phase 2A 的 Network Inspector 底层实现已提交，但用户真实启动后暴露两个严重可用性问题：
1. 完全找不到进入 Network Inspector 的入口（仅藏在 Command Palette）。
2. 主界面/首页背景仍是巨大的 OpenCode 字样，HSCode 品牌未完成。

本轮不再扩展协议能力（不做 TCP Stream / HTTPS / Qwen），只收尾：
- #Network Inspector 正式 UI 接入
- #HSCode 用户可见品牌收尾

### Added
- **Network bottom panel tab**：`view().network` 全局状态（与 terminal 互斥），
  session header 工具栏新增 `Network` 按钮，New/Legacy 布局均渲染 `NetworkPanel`。
- **View 菜单入口**：`desktop-menu.ts` View 菜单新增 `Network Inspector` → `network.toggle`。
- `command.network.toggle` / `desktop.menu.toggleNetwork` i18n（en/zh/zht/desktop-native）。
- `network` / `network-active` 图标（`packages/ui/src/components/icon.tsx`）。
- 品牌组件 `HSCodeWordmark` / `HSCodeLogo` / `HSCodeSplash`
  （`packages/app/src/components/brand/hscode-logo.tsx`，CSS wordmark，主题变量，aria-label）。
- `docs/branding-audit.md` 可见品牌审计表。

### Modified
- `NetworkPanel` 从 full-screen `position: fixed` overlay → `relative w-full h-full`
  的 bottom tool panel content，由父级（session layout）控制尺寸。
- `network.toggle` 命令从 overlay host 移到 session command provider
  （`use-session-commands.tsx`），操作统一 `view().network`；`NetworkInspectorHost`
  改为零 context 空组件（修复 "Layout context must be used within a context provider" 崩溃）。
- Legacy Home / Error 页 `OpenCode Logo` → `HSCodeSplash`（大号 HSCode 水印）。
- Error 页 feedback 外链 `opencode.ai/desktop-feedback` → HSCode GitHub issues。
- Windows 应用菜单标题 `OpenCode` → `HSCode`。
- `packages/app/tsconfig.json` + 根 `tsconfig.json`：`jsx` 由 `preserve` → `react-jsx`
  （`jsxImportSource: solid-js`），使 bun test 能编译 Solid JSX 测试。

### Deleted
- 旧 Network full-screen overlay 行为（`network-panel.tsx` 的 fixed 定位）。
- `network-host.tsx` 原先的 command + view 依赖（改为零 context 空组件）。

### 测试（真实，无 skip/todo/mock）
- **Network UI tests**（`network-panel.test.tsx`）：UI-1 panel 工具栏/无 fixed、
  UI-4 命令统一入口 + host 零 context、UI-5 View 菜单 + i18n、terminal-network 互斥。**7 PASS**
- **Brand tests**（`hscode-logo.test.tsx`）：Brand-1/2/3 HSCode wordmark、aria-label、
  无 OpenCode wordmark、legacy-home/error 已替换。**6 PASS**
- Highlights 回归 + 其余，app 侧合计 **16 PASS / 0 FAIL**。
- desktop network + app-identity 回归：**36 PASS / 0 FAIL**。

### 验证
- 真实 dev 启动：窗口标题 HSCode、sidecar 连接、loading 完成。
- 首次启动发现的 host context 崩溃已修复并加回归测试。
