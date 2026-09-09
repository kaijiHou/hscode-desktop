# HSCode 当前工作状态（由 Agent 维护，人工可读）

> 规则：只存高价值状态，不复制聊天记录。每次压缩/交接前更新本文件。
> 最后更新：2026-09-09（发布流程固化；仓库删除事故后的恢复状态仍保留）

## ⚠️ 2026-09-08 仓库事故记录

- 用户要求删除残留文件夹时，agent 执行 `rm -rf /d/HSCode`——**Windows 路径不区分大小写**，连同仓库 `D:\hscode` 一起删除。
- 从 GitHub 恢复到 `D:\hscode-new`（HEAD a9751aa）。原 D:\hscode 仅剩被占用的 resources（重启后可删）。
- 手工重放恢复：electron.vite.config.ts（node-stub 插件，源=D:\temp\electron-vite.config.new.ts）、logging.ts EPIPE 免疫。
- 丢失未恢复：当日 PROGRESS/LESSONS 原文件（本文件为重建版）；`.agents` 项目级技能目录。
- **教训（终身）：Windows 下 rm 一律先确认目标不存在大小写变体；删除前必须 `pwd` 核对。**
**【最高禁令】永久禁止 rm -rf/rm -r：删除一律进回收站（PowerShell Microsoft.VisualBasic DeleteDirectory SendToRecycleBin）或改名 .deleted-日期。已写入全局记忆 ~/.zcode/AGENTS.md。**

## 当前状态（2026-09-09 更新）

- 仓库新家：`D:\HSCode-Project\source`
- 用户发布包：`D:\HSCode-Project\releases`（Dev 安装版 + 完整免安装 ZIP）
- 保护备份：`D:\HSCode-Project\backups`
- 离线 Skill 包：`D:\HSCode-Project\offline-agent`
- 旧桌面发布目录：已移动到 `D:\HSCode-Project\archive\desktop-old`
- 开发启动快捷方式：`D:\Desktop\脚本\hscode`
- `D:\hscode\resources\app.asar` 已确认是旧残留，不含源码和用户数据；回收站移动被 ZCode PID 6152 锁定，关闭 ZCode 后再执行。
- 本轮发布脚本、Bun 版本固定和环境文档已提交到 `15a691f` 并推送 GitHub 分支 `recovery/fresh-clone-server-start`。
- 当前发布脚本：`D:\HSCode-Project\source\scripts\package-win.ps1`；已固定 Bun 1.4.0、8GB heap、无联网安装、无 predev 下载。
- 最新发布已完成：安装版和完整免安装 ZIP 已同步到 `D:\HSCode-Project\releases`，真实 Electron 冷启动 PASS，55 locales、WinDivert DLL/SYS/license PASS。
- 模型配置：`C:\Users\13772\.config\hscode\opencode.json`（qwen-local 自部署，全局生效，未受事故影响）

## 已确认 Root Cause（勿重复调查）

1. 桌面启动必须绕过 predev：`ELECTRON_EXEC_PATH=<desktop>\node_modules\electron\dist\electron.exe` + `NODE_OPTIONS=--max-old-space-size=8192` + 直接调 `node_modules\.bin\electron-vite.exe dev`；`bun run dev` 会踩 D:\npm-global 坏 shim 与 install-electron 崩溃。
2. 渲染层生产构建会静态拉进 node-only 包（@effect/platform-node*、undici、llm protocols）→ electron.vite.config.ts 里有 hscode:renderer-node-stub 插件（\0hscode-node-stub 虚拟模块 + 314 个具名导出表）。缺导出时构建报"X is not exported"，按名字往表里加即可。
3. 主进程 EPIPE（管道断裂）已免疫：logging.ts initLogging 里 uncaughtException 吞 EPIPE。
4. Windows 路径大小写不敏感：见顶部事故记录。
5. 自部署模型接入：全局 opencode.json 加 provider（npm=@ai-sdk/openai-compatible），或桌面脚本 HSCode添加自部署模型.bat（自动从 /v1/models 发现模型）。
6. Bun 版本漂移是反复失败的主因之一：`1.3.14` 与 `1.4.0` 不能混用；当前唯一构建基线是 `D:\bun-bin\bun.exe` 1.4.0。默认 Node 20 也不能做 bundle 导入检查，因为缺 `node:sqlite`。
