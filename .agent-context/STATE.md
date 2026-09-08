# HSCode 当前工作状态（由 Agent 维护，人工可读）

> 规则：只存高价值状态，不复制聊天记录。每次压缩/交接前更新本文件。
> 最后更新：2026-09-08（仓库删除事故后重建。此前位于 D:\hscode，因大小写不敏感误删，GitHub 恢复至 a9751aa + 手工重放）

## ⚠️ 2026-09-08 仓库事故记录

- 用户要求删除残留文件夹时，agent 执行 `rm -rf /d/HSCode`——**Windows 路径不区分大小写**，连同仓库 `D:\hscode` 一起删除。
- 从 GitHub 恢复到 `D:\hscode-new`（HEAD a9751aa）。原 D:\hscode 仅剩被占用的 resources（重启后可删）。
- 手工重放恢复：electron.vite.config.ts（node-stub 插件，源=D:\temp\electron-vite.config.new.ts）、logging.ts EPIPE 免疫。
- 丢失未恢复：当日 PROGRESS/LESSONS 原文件（本文件为重建版）；`.agents` 项目级技能目录。
- **教训（终身）：Windows 下 rm 一律先确认目标不存在大小写变体；删除前必须 `pwd` 核对。**
**【最高禁令】永久禁止 rm -rf/rm -r：删除一律进回收站（PowerShell Microsoft.VisualBasic DeleteDirectory SendToRecycleBin）或改名 .deleted-日期。已写入全局记忆 ~/.zcode/AGENTS.md。**

## 当前状态

- 仓库新家：`D:\hscode-new`（等旧目录解锁后可改名回 D:\hscode）
- 桌面成品：`D:\Desktop\HSCode\`（HSCode.lnk + HSCode-程序免安装版 + 安装包 + 添加模型脚本 + 使用说明）
- 未推提交：无（a9751aa 已在 GitHub；EPIPE 修复与 stub 配置已重放但**未提交**，见 git status）
- 待重打包：安装包（dist 被事故清除，需 bun install + build + package:win 后补 D:\Desktop\HSCode\安装包\）
- 模型配置：`C:\Users\13772\.config\hscode\opencode.json`（qwen-local 自部署，全局生效，未受事故影响）

## 已确认 Root Cause（勿重复调查）

1. 桌面启动必须绕过 predev：`ELECTRON_EXEC_PATH=<desktop>\node_modules\electron\dist\electron.exe` + `NODE_OPTIONS=--max-old-space-size=8192` + 直接调 `node_modules\.bin\electron-vite.exe dev`；`bun run dev` 会踩 D:\npm-global 坏 shim 与 install-electron 崩溃。
2. 渲染层生产构建会静态拉进 node-only 包（@effect/platform-node*、undici、llm protocols）→ electron.vite.config.ts 里有 hscode:renderer-node-stub 插件（\0hscode-node-stub 虚拟模块 + 314 个具名导出表）。缺导出时构建报"X is not exported"，按名字往表里加即可。
3. 主进程 EPIPE（管道断裂）已免疫：logging.ts initLogging 里 uncaughtException 吞 EPIPE。
4. Windows 路径大小写不敏感：见顶部事故记录。
5. 自部署模型接入：全局 opencode.json 加 provider（npm=@ai-sdk/openai-compatible），或桌面脚本 HSCode添加自部署模型.bat（自动从 /v1/models 发现模型）。
