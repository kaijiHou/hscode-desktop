# HSCode 当前运行与发布手册

最后更新：2026-09-09（发布流程固化）

## 机器分工

- 当前电脑是开发机：源码、调试、构建、发布都在这里完成。
- 当前电脑不需要安装 C 盘版 HSCode；开发版快捷方式在 `D:\Desktop\脚本\hscode`。
- 给其他用户的是发布包，不发送源码、`node_modules`、Bun、Node 或 Electron 开发环境。
- `Dev` 版必须保留，用于当前开发机验收；正式用户包另行用 production channel 构建。

## 当前目录布局

- 源码：`D:\HSCode-Project\source`
- 用户发布包：`D:\HSCode-Project\releases`
- 保护备份：`D:\HSCode-Project\backups`
- 离线 Agent Skill 包：`D:\HSCode-Project\offline-agent`
- 旧桌面发布目录归档：`D:\HSCode-Project\archive\desktop-old`
- 开发/模型脚本与快捷方式：`D:\Desktop\脚本\hscode`
- `D:\hscode` 是事故后遗留的旧 `resources` 目录，不是当前源码；已确认只有旧 `app.asar`，但当前被 ZCode 进程 PID 6152 锁定，关闭 ZCode 后再送入回收站。

## 当前电脑怎么运行

日常直接使用已经打包的 Dev 版：

`D:\HSCode-Project\source\packages\desktop\dist\win-unpacked\HSCode Dev.exe`

开发调试用：双击

`D:\Desktop\脚本\hscode\启动 HSCode 开发版（源码调试）.lnk`

这个快捷方式实际调用源码中的 `启动开发版.cmd`。管理员网络抓包入口是同目录的 `HSCode-管理员启动.bat`，模型添加入口是 `HSCode添加自部署模型.bat`。

源码开发的可靠底层命令（不要改回 package script 的 predev 路径）：

```text
cd /d D:\HSCode-Project\source\packages\desktop
set OPENCODE_CHANNEL=dev
set ELECTRON_EXEC_PATH=D:\HSCode-Project\source\packages\desktop\node_modules\electron\dist\electron.exe
set NODE_OPTIONS=--max-old-space-size=8192
set PATH=D:\bun-bin;%PATH%
node_modules\.bin\electron-vite.exe dev
```

以后发布用户包只运行这一条（必须 PowerShell 7）：

```text
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File D:\HSCode-Project\source\scripts\package-win.ps1
```

脚本固定 Bun 1.4.0，复用现有依赖和本地 CLI，不执行 `bun install`，不走会触发 Electron 下载的 `predev`，并在同步前检查 bundle 导出、55 个 locales、WinDivert 三件套和真实 Electron 冷启动。

## 给其他用户什么

安装版：

`D:\HSCode-Project\releases\HSCode-Dev-安装版-win-x64.exe`

用户双击安装即可，不需要 Node、Bun 或 Electron；安装到 C 盘是正常行为。

免安装版：

`D:\HSCode-Project\releases\HSCode-Dev-免安装版-win-x64.zip`

ZIP 内必须是完整的 `win-unpacked` 文件夹，用户解压后双击 `HSCode Dev.exe`。不能只发送 EXE，也不能删除同目录 DLL、`resources` 或 `locales`。

当前两个包是 Windows x64 Dev 验收包，已由提交 `da8f45a` 重新构建并通过冷启动：安装版 SHA256 `B529470081BF52609EDD9F5A84CA16D0BB3B03D4650056434A3391440DA73D76`，免安装 ZIP SHA256 `6B9ED492F72FB571AAD600F6285AF8779D76D4468971019773E74577FCC76AC8`。交付普通用户前如需正式品牌，应另行构建 production channel，不能把 Dev 名称当成正式版。

## 本轮打包流程

1. 先创建 Git tag 或完整 Git bundle。
2. 运行 `scripts/package-win.ps1`；它复用本地 Bun、依赖、Electron 和 CLI，不联网安装。
3. 本地源码构建；保留源码 map 供开发，但发布包排除 `out/**/*.map`。
4. Windows 包只保留 Windows 原生运行时，保留语言、主题、驱动、许可证、WinDivert 和实际需要的 Windows native 模块。
5. 验证 bundle 导出、安装包、完整免安装目录、55 个 locales、WinDivert 三件套和真实 Electron 冷启动。
6. 旧交付文件先移动到 `backups\releases\<timestamp>`，新安装版和完整 `win-unpacked` ZIP 再同步到 `releases`。

## 已踩坑与固定规避

- Windows 路径不区分大小写：`D:\hscode` 与 `D:\HSCode` 是同一个目录。任何移动/删除前先核对真实路径；绝不使用 `rm -rf`、`rm -r`、`git clean` 或硬重置。
- 删除只进回收站；项目整理只用移动，不用覆盖式清理。
- `bun run dev:desktop` 会进入 `predev`，自动执行 Electron 下载并触发 `@electron/get` 的 `ERR_REQUIRE_ESM`；开发启动必须直接调用 `electron-vite.exe dev`。
- Bun 根因已收敛：项目 packageManager 与成功 bundle 构建统一为 Bun `1.4.0`，唯一固定路径是 `D:\bun-bin\bun.exe`；`D:\npm-global\bun.ps1` 的 shim 不再参与构建。
- Bun `1.3.14` 会生成带 `init_auth2()` 自等待的旧 bundle 形态；不要在本项目构建中混用 1.3.14。脚本会先验版本，错了直接停止。
- 机器默认 Node 20.12.1 不提供 `node:sqlite`；bundle 契约检查使用锁定的 Bun，真实运行由 Electron 冷启动检查覆盖。不要用默认 Node 20 代替 Electron 运行时验收。
- Electron 包有时缺 `path.txt` 或二进制元数据；设置 `ELECTRON_EXEC_PATH` 指向桌面依赖中的 `electron.exe`。
- 主进程构建可能被 Node 默认 2GB 堆限制；使用 `NODE_OPTIONS=--max-old-space-size=8192`。
- 免安装版不能移动单个 EXE；整个目录是一个整体。
- WinDivert 缺失会导致网络抓包报 `WinDivert.dll not found`；打包后必须检查 `resources/win/WinDivert.dll`、`.sys` 和许可证仍在且哈希匹配。
- 安装版/免安装版只替换程序，不应删除用户数据；项目、对话、设置和个人 Skill 属于用户数据。
- C 盘安装目录和 C 盘用户数据是两回事：删除当前开发机安装版时只移除程序/快捷方式，不能顺手删 `AppData`。
- 构建脚本失败时不重跑 `bun install --force`；先看 Bun 版本、旧 junction、Electron 可执行文件和缓存。盲目重装曾损坏 `hxml.mjs` 并触发 tree-sitter/env-paths 安装脚本问题。

## 文件与变更纪律

- 以后新增发布包放 `D:\HSCode-Project\releases`。
- 以后构建源码只在 `D:\HSCode-Project\source`。
- 旧包、旧资源、临时恢复物只能移动到 `archive`，不能直接删除。
- 每次发布必须记录 SHA256、构建提交、包类型、运行验收结果和已知限制。
- 当前发布基线：提交 `da8f45a3945492e6f5e4a373532b10217721a760`，Bun `1.4.0`，Electron `42.3.3`，Windows x64，55 个 locales。
