# HSCode 运行经验与踩坑记录（跨会话记忆，2026-09-08 事故后重建）

> 原版毁于 09-08 仓库误删事故；本版按当日记忆重写，条目有损但核心保全。

## L1 桌面端启动方式（不要用 `bun run dev`）
- 正确启动（当前仓库根=`D:\HSCode-Project\source`）：
  ```bash
  cd D:\HSCode-Project\source\packages\desktop
  ELECTRON_EXEC_PATH="D:\HSCode-Project\source\packages\desktop\node_modules\electron\dist\electron.exe" \
  NODE_OPTIONS=--max-old-space-size=8192 \
  ./node_modules/.bin/electron-vite.exe dev
  ```
- 原因：predev 的 install-electron 必挂（@electron/get ESM 错）；脚本内 `bun` 踩 D:\npm-global 坏 shim；Node 默认 2GB 堆打 33MB sidecar 包 OOM；electron 包缺 path.txt 需 ELECTRON_EXEC_PATH 指到已装二进制。
- 注意：`bun run <script>` 一律换成直接调底层命令（bun run 会经 PATH 再找一次 bun）。

## L2 应用真正读取的配置 ≠ 仓库里的配置
- 桌面端默认项目目录是 `C:\Users\13772\Documents\Default Project`（日志 `creating instance directory=...` 可证）。仓库根的 opencode.json 只在 CLI 以仓库为工作区时生效。
- 桌面 App 全局配置：`C:\Users\13772\.config\hscode\opencode.json`（+ .jsonc）。改 provider 改这里。
- 确认方法：`~/.local/share/hscode/log/opencode.log` 当前 run 的 `loading path=...`。

## L3 @ai-sdk/anthropic 的 baseURL 必须自带 `/v1`
- sidecar 打包的 ai-sdk/anthropic 只在 baseURL 后拼 `/messages`。
- 方舟对不存在路径返回 401 "API key missing or invalid" 而非 404——报 401 先查 URL 路径。

## L4 API Key 的正确位置：auth 存储，别依赖环境变量
- `{env:VAR}` 缺失时替换为空串（variable.ts:37），空串 ≠ undefined，会挡住 auth 兜底（provider.ts:1756）。
- Key 正确写法：`C:\Users\13772\.local\share\hscode\auth.json`，格式 `{"<providerID>":{"type":"api","key":"..."}}`；或直接明文进 config（注意 gitignore）。

## L5 `enabled_providers` 会禁掉未列出的所有 provider
- 配置写了 enabled_providers 后，未列出的（如 opencode-go 免费模型）全部消失。

## L6 排障工具箱
- sidecar 产物可独立运行：`ELECTRON_RUN_AS_NODE=1 electron.exe probe.mjs`（import out/main/chunks/node-*.js 的 Server.listen 起同款服务器），可查 /config、发真实消息。
- 抓请求头：本地 echo 服务器 + 临时改 baseURL。
- `bun ./packages/opencode/src/index.ts debug config` 打印仓库视角解析配置（注意与桌面 App 项目上下文不同，见 L2）。
- **Bash 工具沙箱拦 127.0.0.1 回环**：测本地服务须 dangerouslyDisableSandbox；Git Bash curl 发中文会编码损坏，用 python urllib 发 UTF-8。
- **Windows 路径大小写不敏感**：`rm -rf /d/XYZ` 会命中 `/d/xyz`（09-08 事故根源，见 STATE.md）。
- **Bash 工具的 heredoc 会吃一层反斜杠转义**：python 补丁里的 `\n`、`\0` 到手可能变成真实换行/NUL——补丁脚本一律用 Write 工具写文件、字符串用 chr() 构造，禁止经 bash heredoc 传转义序列。

## L7 已验证无效/误导的假设
- "Unauthorized" = key 错 → 不一定，路径错也报这个（L3）。
- 模型自报身份不可靠：系统提示按消息携带，会话中途换过模型会累积多个身份声明（换模型=开新会话）。
- dsh 的 reasoningEfforts 不声明就没有思考档位；llama.cpp/Qwen 模板认 `chat_template_kwargs.{enable_thinking,thinking_budget}`，不认 reasoning_effort。

## L8 方舟 Coding Plan 真实规格（实测）
- deepseek-v4-flash 上下文实测 1M（服务端硬限 1048566 input；300K/600K 接受、1.06M 拒绝）。glm-5.3-flash 1M。
- deepseek-v4-flash 纯文本；走 Anthropic 协议默认开思考，max_tokens 过小回 500。
- OpenAI 兼容通道 `/api/coding/v3`；Anthropic 通道 `/api/coding`（SDK 用时补 /v1）。

## L9 Bun / Node 环境根因（固定，不再重复排查）
- 项目构建统一使用 `D:\bun-bin\bun.exe` Bun `1.4.0`；根 `package.json` 已同步为 `bun@1.4.0`。`D:\npm-global` 下的 shim 曾指向缺失文件，且 Bun `1.3.14` 会生成旧的 `init_auth2()` 自等待 bundle。
- `D:\HSCode-Project\source\scripts\package-win.ps1` 会先锁 Bun 版本、把其目录置于 PATH 首位、检查旧 `D:\hscode-new` junction，再构建和打包；不执行 `bun install`，不触发 predev 的 Electron 下载。
- 构建必须保留 `NODE_OPTIONS=--max-old-space-size=8192`；默认 Node 20.12.1 缺 `node:sqlite`，不能拿它做 bundle 导入验收。使用 Bun 契约检查 + 实际 Electron 冷启动。

## L10 发布安全边界
- 发布脚本只从 `source` 生成两个交付物：安装版和包含完整 `win-unpacked` 的免安装 ZIP；同步前会检查 `app.asar`、55 个 locales、WinDivert DLL/SYS/license，并把旧包移动到 `backups\releases`。
- 不把源码、`node_modules`、Bun、Node、Electron、测试、抓包调试文件单独发给普通用户；用户包内必须保留业务运行所需的终端、网络抓包、native 模块、驱动和许可证。
- `D:\hscode` 只有旧 app.asar，不是源码；当前被 ZCode PID 6152 锁定。关闭 ZCode 后再用 PowerShell 7 回收站操作，绝不强删。
