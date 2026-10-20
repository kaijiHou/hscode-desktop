# HSCode Preview 品牌资源与验证

本目录存本次用户提供的新 H 原图、可复现的图标生成/本机构建环境脚本和品牌阶段的验证报告。不要放安装包、node_modules、日志、真实会话或账号密钥；本机产物放 `../.local/`，上游编译产物使用原有 dist/out 目录。

基线：`https://github.com/anomalyco/opencode` 的 `v2`，完整提交 `4617210822bdbb31e5749751afbfb4584ccedac8`。
品牌分支：`hscode/oc2-brand-preview`；仅向 `kaijiHou/hscode-desktop` 推送此分支。
按用户要求，该分支只保留一条最新源码快照，不上传官方历史；上游 SHA 作为来源记录保留，LICENSE 等法律归属不变。
旧 `D:\HSCode-Project\source` 只用于参考，本轮不修改、不移植功能。

新图原始附件：`D:\Temp\codex-clipboard-0fff486a-a562-46ed-b048-78f95e89b0c6.png`。
可追踪原图：`hscode-logo-source.png`，必须保持原始字节不变。

## 本机直接运行

在 PowerShell 7 中执行 `pwsh -NoProfile -ExecutionPolicy Bypass -File D:\hscode-opencode2\branding\run-preview.ps1`。
此入口运行已有 `out` 编译结果与本地 Electron，不需要安装包，不执行重新构建。预览数据位于 `D:\hscode-opencode2\.local\data`，不混用 V1 数据。修改源码后需先重新编译才会反映在此入口中。
启动入口不向 Preview 传递本机 `API_KEY` / `*_API_KEY` 环境变量，不修改系统或用户级环境变量。后来在 Preview 中手动配置的凭据仍需在 Preview 中单独移除。
