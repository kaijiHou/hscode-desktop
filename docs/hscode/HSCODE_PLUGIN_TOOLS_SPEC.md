# HSCode UI 插件工具列表规格

## 2026-10-22 最新范围覆盖

用户随后再次取消 PdfCraft。最终固定精选仅为 Excalidraw、zcode-context-insight；PdfCraft 不安装、不预置精选、不打入应用包。若本机已经安装，通过原管理流程卸载，保留文档/插件数据；隔离验证历史不冒充实际安装状态。

用户取消 OpenPencil（UI 设计）与 PhotoCraft。当前固定精选仅为 Excalidraw、zcode-context-insight、PdfCraft，沿用原安装/启用/打开流程；这两项不再提供精选入口，不影响用户另行通过完整市场管理插件。用户明确授权将保留的三个安装到本机实际 HSCode profile，非只装入隔离测试 profile；不改模型配置、不造会话、不启用完整 I/O 保留。下文五项描述为此前设计历史，以本节三项为准。

## 范围

在 `packages/ui/src/plugin-ui/` 增加可供 HSCode 工具中心使用的独立 `HscodePluginTools`。本组件显示固定五个精选插件和当前工作区已安装、清单声明有效 `ui.surfaces` 的其他插件。Jupyter Notebook 不属于精选，也不加入动态 UI 插件入口。

五个精选 plugin name 严格为 `excalidraw`、`zcode-context-insight`、`pdfcraft`、`openpencil`、`photocraft`。精选名单只定义策展身份和缺少清单展示名时的双语名称，不定义安装状态、版本可用性或实际 surface。

## 事实来源与状态所有者

- `IPluginManagementService` 经现有 `useScopedPluginManagementStore` 加载工作区 marketplace、可用目录、安装记录和 `ZCodePluginInfo`。`buildStoreItems` 是列表展示用的联合投影；已安装插件的实际 `info.uiSurfaces` 优先于目录中的 `componentTypes`。
- 当前可打开的 surface 只来自 `IPluginUiBridgeService.listSurfaces({ workspacePath, workspaceIdentity })`。打开前再次按 `pluginId + surfaceId` 查找并校验，不能仅因 marketplace listing、推荐项或 manifest 中有 surface 就称为可打开。
- 安装、启用、更新沿用插件市场既有管理流程。未安装精选项点击后通过 `requestPluginStoreOpen({ pluginId, returnScopeKey: "user" })` 打开官方插件详情；本组件不直接安装、不下载插件，也不另建授权/权限流程。
- 首次进入工具中心复用现有官方目录节流刷新（`claimMarketplaceAutoRefresh` + store 原动作），不刷新个人来源、不安装 ZIP；否则初次启动的 bundled seed 目录不含 CDN 精选，会把实际已发布项误标为未上架。目录失败按既有 store 错误态提示，不改变已安装插件的可用事实。
- 工作区级安装状态由现有插件管理 store 持有；会话级打开仍由 `onOpenPluginUi` 和现有 Plugin UI 生命周期拥有。本组件不写持久化偏好。
- 固定 curated ID 不依赖 `uiPluginRecommendations`，也不向父工具中心导入实现。置顶、隐藏、显示隐藏项、排序和搜索由 props 输入、回调交还父组件。

## 展示与交互

- 有 marketplace 数据时，五个精选项匹配官方市场 `zcode-plugins-official` 的实际条目；固定双语名称用于缺少 manifest 展示名的回退，不硬编码版本。缺少目录条目时仍可显示精选说明，但不显示为已安装或可打开。
- 已安装插件的实际 `info.uiSurfaces` 决定 surface 名称和 ID；已启用的动态插件须同时出现在 bridge 返回的当前有效 surface 中才可打开。每个 surface 的 UI ID 由 plugin ID 与 surface ID 唯一组合。
- 精选插件有多个有效 surface 时按真实 surface 分行；尚未安装、缺少有效清单或清单没有 surface 时以精选插件占位行呈现。
- 状态动作：未安装 → 官方市场详情；已安装但禁用 → 官方插件管理详情；已安装且启用、无 session → “创建任务后使用”；远程/Web/无插件沙箱 → “不支持”；surface 查询中 → loading；有效当前 surface 且有 session → 打开。安装、禁用、缺少 surface、市场数据缺失或过期均不能伪装为可打开。
- `query` 为空时显示全部；否则按本地化显示名、描述、plugin ID 和来源筛选。`hiddenIds` 默认隐藏；`showHidden` 为真时可见并提供显示入口。置顶与 `orderIds` 仅作为传入顺序的投影，不在此模块持久化。
- 未创建正式会话时允许展示精选/已安装项目和状态说明，但不调用 `onOpenPluginUi`、不生成 task/session ID。

## 异步与边界

- 精选主入口使用稳定的 plugin name ID，安装前后不丢置顶/隐藏偏好；附加 surface 使用 pluginId + surfaceId。官方市场成功加载但没有条目时明确“官方市场暂未上架”，不能伪称运行环境不支持。
- 已安装且有效的 surface 有可选更新时仍允许打开，更新只由更多菜单导航原市场流程。打开请求持有包含 bridge/service 实例及 workspace 路径/身份/session 的上下文对象，A→B→A 或 bridge 替换也不得接受旧结果。

- 插件目录请求以 workspace identity（缺省回退 workspace path）绑定；surface 请求另绑定 session 与 remote session。切换工作区/会话或卸载组件后，迟到的目录、surface、打开结果不得回写或打开新上下文。
- 每次打开使用 bridge 刚返回的 `pluginId`、`id`、`server`、`resourceUri`、`availability` 和标题，按现有 `documentViewerInstance`、`OpenPluginUiSideTabRequest` 组装请求；远程 workspace、Web/手机和无 `pluginSandbox` 继续不可用。
- `PluginUiLauncherItems`、`useRecommendedUiPlugins` 和官方推荐入口保持原样，继续服务 ZCode 原行为。
- `HscodePluginToolsProps` 继承 `PluginUiLauncherItemsProps`，其 `sessionId` 允许 `null`，增加 `query`、`pinnedIds`、`hiddenIds`、`orderIds`、`showHidden`、`onTogglePinned`、`onToggleHidden`、`onOrderChange` 和兼容回调 `onMove`。移动时按过滤后当前完整可见插件 ID 列表相邻交换，并将交换后的完整列表交给 `onOrderChange`；未保存过顺序时同样只移动一位。移动不得跨精选/已安装分组或置顶/未置顶边界。提供 `onOrderChange` 时不调用 `onMove`，否则保留旧 `onMove(id, direction)` 行为。

## 验收

1. 精选项恰为五个指定 plugin name，不包含 Jupyter；匹配当前官方 marketplace 和安装 store，而不是推荐配置。
2. 安装态来自 store，surface 来自已安装 manifest/桥接清单；未安装精选项不能打开，点击只进入官方详情。
3. 禁用、无 session、无沙箱、远程和 Web 状态均不能误报为可打开；session/workspace 切换后旧 surface 结果不能触发新 session 打开。
4. 其他已安装有效 UI 插件按每个真实 surface 动态展示，ID 包含 plugin 与 surface；同插件多 surface 不冲突。
5. 搜索、隐藏、显示隐藏、置顶和移动只读取/调用 props，不依赖或写入父工具中心偏好存储；移动回调收到当前完整可见 ID 顺序且每次相邻交换一位，遵守分组和置顶边界。
6. 保留原 `PluginUiLauncherItems`、安装管理流程、沙箱和 Plugin UI 生命周期语义。
