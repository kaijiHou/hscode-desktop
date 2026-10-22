# HSCode 原生能力回归验证

入口：scripts/test/hscode-native-tools-smoke.mjs。它复用仓库已有的 Node + Playwright Electron 启动方式，仅使用当前本地 HSCode 构建，不构建、不打包，也不安装新依赖。

## 执行

先用 PowerShell 7 查看用法；此命令不会创建目录、profile 或启动 Electron：

    & 'D:/node24-full/node-v24.22.0-win-x64/node.exe' scripts/test/hscode-native-tools-smoke.mjs --help

只有主协调确认错峰后才执行完整回归：

    & 'D:/node24-full/node-v24.22.0-win-x64/node.exe' scripts/test/hscode-native-tools-smoke.mjs --run

没有显式传入 --run 时不会启动 Electron。完整运行前只核对本地 HSCode build identity；不会触发构建。profile、合成 workspace、截图、run.log 和 result.json 全部保存在 D:/hscode-v2/.agent-context/native-tools-validation/runs/ 的新建目录中，失败时保留现场。

## 覆盖范围

| 场景       | 实际操作与判据                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文件入口   | 用应用已有的 --open-workspace 启动入口打开本轮新建的中文空格目录；文件面板列出一个中文空格文件和一个空目录，打开文件后读取到脚本写入的唯一标记。         |
| 终端       | 从工具中心打开集成终端，运行只读 PowerShell 7 命令；必须同时看到命令标记和 fixture 的实际 cwd。                                                          |
| 审查 / Git | 分别点击两个真实入口并确认原生 Git 面板打开。fixture 不初始化 Git，脚本不运行写操作；此场景只验证入口与面板路由，不声称验证仓库变更展示或 Git 写入。     |
| 插件市场   | 通过正常入口打开市场面板，不安装、不启用插件。目录可用、不可用或未解析会分别写入结果；网络受限时不会把面板打开误报成目录加载成功。                       |
| Dev 条件   | 在本轮隔离 profile 中切换 developer-tools 本地偏好，验证默认隐藏、启用后入口和面板出现、关闭后入口隐藏。                                                 |
| 辅助对话   | 在没有真实 task/session 的隔离 profile 中验证入口隐藏。正向可见路径记为 NOT RUN；脚本不伪造 session，不调用 task/session 创建服务，也不发送模型 prompt。 |

脚本剔除继承环境中的凭据变量，并把 HSCode、ZCode、Electron、应用数据和缓存目录重定向到本轮隔离 profile。临时目录按机器约定使用 D:/hscode-v2/.agent-context/temp。它不读取 .hscode-local-data，不访问用户工作区，不控制或关闭其他 Electron 窗口。

Git 子进程的发现边界限制在本轮 run 目录，并关闭可选索引刷新写入，避免向父级 checkout 探测或写入 Git 元数据。

## 最新执行结果（2026-10-22）

最新 run：`.agent-context/native-tools-validation/runs/2026-10-22T08-23-15-500Z-Dimfcu/`，9/9 步通过，总状态 PASS_WITH_LIMITATIONS，市场目录 AVAILABLE；没有模型 prompt、插件安装或 Git 写操作。

额外通过生产调用链验证插件目录：只给测试进程传入本轮合成的旧 HOME/storage/session DB 污染值，Main 必须覆盖。市场入口触发原 Host/CLI 后，其实际生成的 known_marketplaces.json 与 marketplace.json 的 realpath 均位于 HSCode 根；合成旧根与旧 DB 文件没有被使用。没有以预创建的空目录冒充 CLI 写入证据，也没有修改真实 C 盘数据。未写配置时 config.json 可以合法不存在，不人为造文件作为“通过”证据。

此前失败现场均保留：旧 test ID、偏好引导、终端逐字输入/长路径和隐藏保活项造成测试误判；另曾尝试自定义 CLI 追踪入口，被正常存储准备门禁拒绝，已撤除该追踪方案，最终复用未修改的 CLI。最新输出通过正常 PowerShell 7 命令在内部比较 cwd 后产生拼接标记，不把命令回显当成功。

首次引导通过既有 Escape 正常关闭；Dev 本地偏好修改后通知既有 focus 刷新逻辑，不放宽生产可见性。辅助对话真实任务正向路径、Git 仓库变更展示/写入、插件编辑保存以及真实模型/OAuth 仍 NOT RUN。
