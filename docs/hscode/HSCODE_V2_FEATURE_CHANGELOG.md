# HSCode V2 功能改动记录

最新交付边界：2026-10-22 用户已同意安全源码新分支上传；不打包。早期“不上传”记录仅是历史状态。

## F011 实际插件控制面数据根隔离（2026-10-22）

- 技术：复用 Main 的 `buildHostProcessEnv` 单一环境出口，向 Host/CLI 明确传入 HSCode 的 HOME、Windows USERPROFILE 和 ZCODE_STORAGE_DIR，清除大小写变体的遗留存储与 session DB 覆盖。仅改子进程环境，不改系统 HOME、数据库结构或迁移。
- 根因：CLI 用户配置使用 `homedir()`、插件存储使用 ZCODE_STORAGE_DIR；此前只传 ZCODE_HOME 不能约束独立的插件管理 lane。真实窗口曾把 Excalidraw 装进原版用户目录，旧空 Electron profile 测试不足以证明 CLI 隔离。
- 文件：`packages/desktop/src/main/desktopRuntimeEnv.ts`、对应 `desktopRuntimeEnv.test.ts`、既有本地 Electron/原生工具回归脚本。
- 验证：新增污染回归先红后绿；环境相关测试 33 PASS / 4 skip。最新合并针对性 17 文件 133 PASS / 4 skip。Main/Host 本地编译成功。真实 HSCode UI 安装 Excalidraw 0.3.4 后，详情根路径与真实安装目录均在本 checkout 的 `.hscode-local-data/.zcode/cli/plugins/cache/` 下；原版 C 盘安装物未删除、未迁移。隔离实机故意传入本轮合成旧 HOME/storage/session DB 路径，正常 CLI 产生的市场目录 realpath 留在 HSCode 根，旧路径没有被使用。
- 当前插件状态：Excalidraw 已在本机正确 profile 安装；最新官方目录不再含 zcode-context-insight，保留未上架状态。先前隔离安装 0.1.1 的记录仅为历史证据，不能冒充当前已安装。未开启永久模型 I/O 记录；没有发送模型请求。

## F012 原生工具真实回归补齐（2026-10-22）

- 技术：复用既有 Playwright Electron 与真实入口；在 D 盘合成中文/空格工作区，不安装测试依赖、不造 session、不执行 Git 写操作。以终端实际输出而非面板存在作为判据。
- 问题与解决：新隔离根出现合法首次偏好引导，脚本通过正常 Escape 关闭；xterm 不是旧 terminal test ID，改用实际终端结构。长路径换行和逐字输入易干扰判定，改为输入完整命令、在命令内比对 cwd 后输出拼接标记，避免把命令回显冒认为执行成功。Dev 测试通知现有 focus 刷新，且查找可见项，避免后台节流和保活隐藏 tab 误判。
- 文件：`scripts/test/hscode-native-tools-smoke.mjs`、`scripts/test/hscode-electron-smoke.mjs`、`HSCODE_NATIVE_TOOLS_VALIDATION.md`。
- 验证：最新原生回归 9/9 PASS，含中文文件读取、PowerShell 7 真执行/cwd、审查、Git、市场目录、Dev 显隐和实际 CLI 目录隔离；Git 仅验收非仓库入口，不声称验证提交/推送。真实父任务辅助对话、插件编辑保存、真实模型/OAuth 仍 NOT RUN。

## F010 按需精简精选扩展（2026-10-22）

- 用户先取消 OpenPencil、PhotoCraft，随后取消 PdfCraft；最终仅保留 Excalidraw、上下文洞察。不把插件分发物打进安装包、不增加依赖。
- 技术：收缩既有精选 ID 和缺省显示名，继续复用原市场安装/管理/卸载流程；不删除官方市场条目，也不清理用户文档。
- 文件：plugin-ui/domain/hscodePluginTools.ts、components/HscodePluginTools.tsx、模型单测及 Electron smoke 精确名单断言。
- 问题：此前安装验证只在隔离 profile 运行，不能把测试安装冒称本机已安装。实际本机状态另查；取消的项不再执行安装。
- 清理：原隔离测试中的 PdfCraft/PhotoCraft 程序缓存分别 44.1/27.6 MiB 已移入回收站，可恢复；未清空回收站，不宣称已释放磁盘空间。保留文档与插件数据，不改真实用户 profile。
- 验证：两个相关测试文件 15 项 PASS，整体 typecheck PASS，lint 0 errors / 96 既有 warnings；HSCode 本地 renderer 增量编译 PASS（3m37s），未生成安装包。旧五项测试不作为新名单验收。

从 2026-10-21 本轮开始持续追加，每项功能记录目的、技术、问题、涉及文件和真实验证结果。此前改动见 `HSCODE_V2_IMPLEMENTATION_REPORT.md`。不生成安装包；发布按顶部最新边界执行。

## F001 默认免登录、本地工作区与自定义接入

- 目的：本地使用不强制绑定智谱账号，保留用户主动授权。
- 技术：现有构建标志、Root 登录原因状态、OAuth 取消/attempt 机制、设置导航和原 Provider 模板/表单，无新服务端、无新依赖。
- 问题：上游同时用 providerFamilyDomain 和可用模型作为启动登录条件，简单关闭首页仍会在退出或凭据过期时重现；自定义入口藏在“新增”后。分别处理自动触发源，明确保留手动授权。
- 文件：`packages/ui/src/Root.tsx`、`lib/rootStartupGate.ts`、`WelcomeScreen.tsx`、`settings/ModelProviderSection.tsx`、`settings/model-provider-section/ProviderTemplatePicker.tsx`。
- 验证：合并后的针对性 9 文件 74 项通过；隔离 Electron 首次/重启直接进入、可选登录返回、自定义原表单均 PASS。真实 OAuth/模型请求未验收；最终并行新增功能整合后继续复查。

## F002 启动错误及自动化文案品牌

- 技术：中英文 locale value 按构建模式显示 HSCode；不改数据库 schema、迁移、等待或失败处理。
- 问题：启动断连、超时和运行时不兼容提示及保持唤醒说明仍写 ZCode。截图诊断 ID `ef947f96-a7f7-46c7-9d38-a0528925ad7a` 暂未在本地对应日志检出，不能据此宣称已修复其进程故障。
- 文件：`packages/ui/src/i18n/locales/zh-CN.ts`、`en-US.ts`。
- 验证：本轮类型检查与隔离真实冷启动通过。原截图进程断连未复现，不能写作已确认修复。

## F003 首页四个快捷卡片

- 目的：按用户图 2 的图标上置、文字下置卡片样式，与原版 chips 区分；不减少原功能。
- 技术：复用 React/Lucide/原 Popover 与点击回调，CSS Grid 响应式布局和语义颜色，不新增依赖。
- 问题：原推荐槽位固定 h-8，直接增大按钮会溢出或裁切；卡片样式与槽位高度必须一起调整。原版与办公列表保留。
- 文件：`packages/ui/src/v4/ConversationDraftSuggestedPrompts.tsx`、`ConversationDraftSuggestedPromptsContainer.tsx`。
- 验证：原推荐组件和容器回归包括在 9 文件 74 项 PASS 内；真实 Electron 卡片截图已核对。随后新增窄屏两列/宽屏四列与整体居中几何断言，由独立子智能体执行。

## F004 首页背景照片

- 目的：在外观设置中选择/替换/移除本机照片，仅草稿首页显示。
- 技术：浏览器 File/Image/Canvas API、本机 localStorage、React useSyncExternalStore、同窗口事件与跨窗口 storage 订阅；无需原生插件或图片处理依赖。
- 问题与约束：限制输入体积、像素与结果大小；重编码消除原图元数据；存储配额失败保留旧值；迟到解码不得覆盖新选择；禁止远程 URL/SVG，避免额外网络和脚本内容。照片不得进入日志、源码、Git 或模型上下文。
- 文件：`packages/ui/src/home-appearance/`（新受控模块）、`settingsCodePreview.tsx`、`v4/SessionPane.tsx`。
- 验证：本模块 8 项单测 PASS，覆盖非法 URL/SVG/体积、配额保留旧值、移除同步、迟到解码与跨窗口事件；隔离 Electron 实际 PNG 导入→JPEG、非法文件保护、重启持久化和移除均 PASS。未上传用户照片；实测仅使用合成图片。

## 后续每项功能必填

按下一个未使用功能编号追加：日期与需求、技术/状态唯一所有者、修改文件、实际遇到的问题和解决依据、测试命令及结果、未验收事项。不能把“计划验证”写成“已通过”。

## F005 首页整体垂直居中

- 需求：卡片加高后首页偏下，问候、输入框和四卡片整体移到屏幕中部。
- 技术：现有 ConversationTimeline 草稿布局分支，CSS Flex 自然高度居中；仅 HSCode 桌面生效，无 JS 测量和偏移常量。
- 根因：上游明确用 `before:basis-[29dvh]` 使输入框不受下方推荐高度影响；改为大卡片后这条旧规则仍固定顶部留白，整组重心下移。应按总内容高度居中，而非给卡片施加负 margin。
- 文件：`packages/ui/src/v4/ConversationTimeline.tsx`。
- 验证：独立回归子智能体实测 860px 双列与 1200px 四列，整组内容中心与视口中心偏差小于 4px 的几何断言 PASS；深浅主题截图核对通过。该回归共 15/15 Electron 场景 PASS。

## F006 Windows 托盘 H 图标

- 需求：用户右下角隐藏图标区仍显示 Z。
- 技术：现有 Electron Tray 路径解析器按 HSCode 构建选择既有 ICO；创建及未读角标恢复复用同一函数，不创建另一套托盘。
- 根因：打包 extraResources 已配置 H，但本地未打包路径仍硬编码 `build/icon.ico`，所以本地运行和角标恢复都读取原版 Z；不是单纯的系统图标缓存问题。
- 文件：`packages/desktop/src/main/desktopTray.ts`、`packages/desktop/test/desktopTray.test.ts`。
- 验证：托盘路径和传入构造器参数单测、原未读角标合成/恢复回归通过（连同时间线回归合计 3 文件 10 项 PASS）；独立回归再次通过。本地主进程已编译，用户窗口曾重启成功，随后日志明确记录用户 `tray-quit` 退出；没有用 computer-use 检查系统托盘像素，不宣称截图级验收。`scripts/hscode.mjs` 抽出既有哈希记录为 `recordHscodeBuild`，避免增量编译后误用旧身份标记。

## F007 首页卡片悬停、按下与选中反馈

- 需求：用户无法从卡片外观判断鼠标悬停与点击是否生效。
- 技术：局部 CSS 分类色亮边/阴影、独立 translate/scale 轻量交互，React 局部选中展示状态、aria-pressed；保留原动作 owner 和 callback。
- 问题：旧色差很小，且原 waterfall 动画以 both 保留 transform/clip-path，直接添加 transform 悬停易被动画覆盖并裁掉阴影。HSCode 卡片独立交互类，不改官方 chips 动画。
- 语义：标记仅为“已选择”，不假称异步插件或任务成功；减少动画时保留静态反馈。
- 文件：`packages/ui/src/v4/ConversationDraftSuggestedPrompts.tsx`、`styles.css`、对应单测；双语选中标签由工具中心分支统一补充。
- 验证：推荐组件对应 8 项单测 PASS，包含点击回调、选中状态及禁用不接受点击；2026-10-22 重新编译后，隔离 Electron 实测 hover 色边/上浮、点击 aria-pressed 和选中标签、reduced-motion 关闭位移均 PASS。仅选择反馈，不伪装异步任务成功。

## F008 右侧新标签页工具中心与本机入口偏好

- 来源：2026-10-21 新完整方案；由并行 Luna/xhigh 工作项实现，主智能体负责最终整合。
- 目的：按内置/精选/其他已安装分组，复用原生 Git 和插件市场入口；提供搜索、置顶、排序、隐藏与恢复，不删原能力或放宽可见性权限。
- 技术与边界：原 Side Pane/tab owner 与既有 handlers；新受控工具中心组件和本地入口 ID 偏好，不保存插件内容、不建安装后台；插件列表作为独立投影消费父偏好，禁止反向依赖形成环。
- 状态：实施中；具体文件、问题与验证随集成结果追加，当前不宣称工具中心已可用。
- 2026-10-22 集成：`tool-center/`、`app-shell/AnimatedSidePanePanel.tsx` / `WorkspaceShellLayout.tsx` / model、双语 locale 和 architecture-policy。偏好使用唯一 `useSyncExternalStore` owner，写入失败保留旧值并提示；最后订阅者退出后清缓存，重新挂载读取本机事实；窄栏控制另排一行，避免挤掉名称。Git/市场沿用原 handler，插件列表由公开入口注入，不形成循环。
- 问题与核验：整合类型检查发现可选 `onOpenPluginUi` 不能直接交给必需回调、数组交换需对应边界后的非空类型；已修正而非添加假回调。首轮 48 项、补目录刷新后 49 项针对性单测 PASS，整体 typecheck PASS；新版界面编译/原生面板验收进行中。
- 实机增量：新版 renderer 编译 PASS，独立工具中心 smoke 4/4 PASS，包括五精选/无伪造会话、搜索、置顶隐藏与真实重启后原始 ID 偏好一致、显示恢复，以及原生 Git/市场面板。测试先遇到收起侧栏/隐藏保活 tab 的定位问题和重启后立即 count 断言失败；改为正常展开、限定可见列表、对比重启前后实际存储并等待状态，旧失败证据保留，不归因为已确认的生产存储故障。原文件/终端/审查/Dev 可见性由既有回归单测覆盖，不假称全部已手动逐项操作。
- 最终合并回归：2026-10-22 完整 Electron smoke 18/18 PASS，同时覆盖 F007、原书签/背景照片和本工具中心，输出 `.agent-context/electron-smoke-20261022-final/`。本轮不打包、不上传；真实模型/OAuth、各插件业务编辑/导出与完整生命周期仍 NOT RUN。

## F009 精选五个与动态已安装 UI 插件

- 精确范围：excalidraw、zcode-context-insight、pdfcraft、openpencil、photocraft；明确排除 Jupyter Notebook。
- 技术：沿用真实 marketplace、插件管理 store、有效 ui.surfaces 与原 plugin-ui bridge/sandbox/session 生命周期；不以后台推荐名单替代固定策展范围，不复制插件全仓/编辑器。
- 风险处理：无会话只引导，不造 ID；未安装/禁用/缺能力分别提示，安装须可见且经用户操作；旧上下文迟到结果不得打开新会话。Context Insight 不默认开启完整永久模型 I/O 保留。
- 来源与验证：单独审查各实际 manifest、许可证、依赖及发布物，隔离 profile 安装与真实打开结果记录在 `HSCODE_UI_PLUGIN_MATRIX.md`。未实测项均 NOT RUN，不能把目录存在当作已安装或可运行。
- 状态：并行实施与来源审查中；待集成后补充文件、真实遇到的问题和验证结果。
- 2026-10-22 集成：`plugin-ui/components/HscodePluginTools.tsx`、`domain/hscodePluginTools.ts`、`adapters/usePluginUiSurfaces.ts`、公开 `index.ts`、原共享行组件。主精选入口 ID 安装前后稳定；附加 surface ID 唯一；更多菜单提供偏好及可选更新，更新不阻止旧版真实可用界面打开。请求上下文对象隔离 A→B→A、bridge 替换与卸载的迟到结果；无会话不生成 session。
- 实际问题：首启 seed 官方目录只有旧内置项，未经刷新不能判断 CDN 插件不存在；复用原官方目录节流刷新，只更新目录不安装。OpenPencil 未上架明确显示该状态。旧 domain 测试不符合根 Vitest include，已只移动到 `packages/ui/test/hscodePluginToolModel.test.ts`；不能将此前未发现测试计为通过。
- 验证：模型 9 项 + 组件 6 项（含原动作调用、免伪造会话、迟到结果与官方目录刷新）纳入 7 文件 49 项 PASS。隔离 CLI 试装结果由矩阵独立记录，不与组件 mock 测试混为实装/编辑验收。
