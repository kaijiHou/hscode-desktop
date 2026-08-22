# Changelog

HSCode 是基于 [OpenCode](https://github.com/anomalyco/opencode) 的自用修改版。
详细变更记录见 [docs/change-log.md](docs/change-log.md)。

## [Unreleased]

### Changed

- 品牌套皮：应用名、deep-link 协议（`hscode://`）、打包产物名、本地存储 key、
  菜单外链等从 OpenCode 改为 HSCode。

### Privacy

- 移除 Sentry 崩溃/错误上报（渲染入口、app 入口、错误页上报按钮、构建期 sourcemap 上传）。
- 禁用自动更新（`UPDATER_ENABLED = false`）。
- 默认禁用 Session Share（会话不再上传到 `opncd.ai`；可用 `OPENCODE_DISABLE_SHARE=false` 恢复）。

## 上游基线

- 上游仓库：`https://github.com/anomalyco/opencode`
- 分支：`dev`
- Commit：`e00890c67261a435cee6409366a68999a93393fd`
- 详见 [docs/upstream-baseline.md](docs/upstream-baseline.md)
