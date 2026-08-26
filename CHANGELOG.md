# Changelog

HSCode 是基于 [OpenCode](https://github.com/anomalyco/opencode) 的自用修改版。
详细变更记录见 [docs/change-log.md](docs/change-log.md)。

## [Unreleased]

### Added（Phase 2A）

- 实验性 Windows Network Inspector（命令面板 "Network Inspector" 打开）
  - TCP/UDP 包捕获（WinDivert 2.2.2 引擎，管理员权限）
  - 包过滤（`tcp` / `udp` / `tcp.port == 22122` / `src.ip == ...` / `dst.ip == ...`）
  - 实时包列表 + 详情（Overview / Payload / HEX / ASCII）
  - 明文 HTTP/1.x 请求单包识别（GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS）
- Phase 1.9 隐私/隔离回归测试（share 硬禁用、models 被动拉取禁用、数据路径隔离、App ID、highlights 无远程拉取）

### Changed（Phase 1.9）

- Sentry 构建期插件与残留常量彻底移除
- models.opencode.ai 默认禁用被动拉取
- Session Share 硬禁用（环境变量无法恢复上传）
- 文档/审计同步真实网络语义

## [Unreleased]

### Changed（Phase 1.9 Baseline Repair & Privacy Closure）

- 品牌：窗口标题、webmanifest、favicon 标题 → HSCode；帮助菜单链接 → GitHub 仓库；
  Discussions 未启用，无效菜单已删。
- 数据隔离：Electron App ID → `ai.hscode.desktop[*]`；core 数据目录 →
  `data|cache|config|state|tmp/hscode`，与原版 OpenCode 完全隔离。
- 仓库裁剪：删除 12 个非 Desktop 包与大型资产（CHANGE-005），清理死脚本与
  workspace 引用。
- electron-builder：appId / protocol（`hscode://`）/ publish repo 修正；
  desktop package metadata → HSCode。

### Privacy

- **Sentry 彻底移除**：代码 + 依赖（`@sentry/solid`、`@sentry/vite-plugin`）+
  构建插件（`vite.config.ts` / `electron.vite.config.ts`）+ `VITE_SENTRY_*` 声明。
- **Session Share 硬禁用**：`disabled = true`，环境变量无法恢复；UI 命令隐藏。
- **models.opencode.ai 默认禁用**：普通启动不请求（保留本地/自定义源加载能力）。
- **远程 Release Notes 禁用**：不再请求任何远程 changelog。
- 自动更新禁用（`UPDATER_ENABLED = false`）。
- OpenTelemetry 默认不启用；Electron CrashReporter 本地保存不上传。

## 上游基线

- 上游仓库：`https://github.com/anomalyco/opencode`
- 分支：`dev`
- Commit：`e00890c67261a435cee6409366a68999a93393fd`
- 详见 [docs/upstream-baseline.md](docs/upstream-baseline.md)
## [CHANGE-023] — 2026-08-26

### Fixed
- Network: dev WinDivert resources path (packages/desktop/resources via unified `networkResourcesDir()`)
- Network: native bridge init errors no longer silently swallowed; renderer shows real root cause (Chinese mapping included)
- Network UI: Start/Stop/Clear buttons now theme-aware ButtonV2 (light-theme contrast fixed)
- Network: capture-worker bundled as separate entry + static import (dev runtime no longer crashes with MODULE_NOT_FOUND)
- Network: koffi GetLastError prototype form (`int __stdcall GetLastError()`), real win32 error codes surfaced

### Verified
- First real live capture closure in admin-mode dev: capturing → 1910 packets → target match (10.199.194.75:8080) → stop → clear
- desktop network tests 71 PASS / 0 FAIL; app network tests 10 PASS / 0 FAIL; typecheck exit=0 both packages
