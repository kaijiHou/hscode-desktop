# HSCode 工具中心

## 范围与不变量

- 只在 `IS_HSCODE_BUILD` 下把侧栏“新标签页”显示为工具中心；ZCode 原有 Launcher 结构和入口顺序保持不变。
- 文件、浏览器、终端、审查、辅助对话、开发者工具继续由当前可见性条件决定。Git 通过 `handleOpenGit` 的既有路径打开；插件市场继续记录返回 tab，再调用 `handleOpenPluginMarket`。
- 插件列表与生命周期归 `plugin-ui`。工具中心只传递当前 workspace/session、搜索词和本地用户偏好；草稿态传 `sessionId: null`，不得伪造会话或另建插件 tab/安装路径。

## 唯一状态所有者

`hscode-tool-center` 模块的 renderer 偏好存储是置顶、隐藏、顺序与“显示隐藏项”的唯一 owner。唯一持久化记录为 HSCode 专属 localStorage key；记录只含版本号、受限长度的入口 ID 数组和布尔值，不写入插件清单、描述、资源或其它插件内容。React 组件只订阅并投影该状态。

```text
入口操作 → 校验/限额 → localStorage 成功写入 → 本窗口快照 → 同窗口订阅者
                                      └→ 其它窗口 storage 事件 → 校验 → 快照
```

损坏或超限记录读作默认值但不自动覆盖；写入失败保留旧快照；收到无效跨窗口值时忽略。最后一个订阅者卸载时丢弃内存缓存，下一次首次订阅会从 localStorage 重新读事实。原生 `storage` 事件 `key === null` 表示清空 localStorage，将快照恢复为默认值。所有读写异常均在存储边界捕获。最多保存 128 个 ID/列表、单 ID 最长 256 字符、序列化内容不超过 16 KiB。

## 交互与验收

- 内置工具、精选扩展、其它已安装 UI 插件分区；搜索、置顶、组内排序、隐藏和恢复均使用稳定入口 ID。插件 UI 通过 `onOrderChange(ids)` 交回完整的当前可见顺序；偏好 owner 校验、保存并保留此次列表以外的隐藏/未展示 ID。旧 `onMove(id,direction)` 只兼容已有持久顺序，不猜测默认顺序。存储失败通过 aria-live 状态文案提示且不发布快照。键盘通过原生输入框和按钮完成操作，窄栏单列，颜色与字号使用 DESIGN 语义 token。
- 插件状态、surface 解析、安装/启用、沙箱检查与打开动作由 `HscodePluginTools` 和现有 plugin-ui 服务决定；未创建任务时显示创建任务引导，不显示可伪打开状态。普通 MCP/Skill 不进入 UI 插件区。
- 测试覆盖原 Launcher 条件、HSCode 专属偏好校验/尺寸/失败与窗口同步，以及 Git、市场回调调用链；ZCode 构建下新增 HSCode 入口不可见。
