# HSCode V2 最小补丁规格

## 2026-10-22 收尾与发布边界

用户最新要求：首页问候语后方的淡色大 H 水印直接移除，不用其他图形替代，不改整体居中、问候语、输入框或自定义背景。应用图标、系统托盘与冷启动 H 保留；官方 ZCode 构建的原水印不变。

用户已明确同意：完成本地回归后，以 `codex/` 新分支上传最新安全源码，不携带上游祖先历史；不改远端现有分支和默认分支，不生成安装包。下文早期“仅本地 / 不上传”是当时阶段状态，以本节为准。源码保留必要许可证、依赖锁文件和编译配置；不上传个人配置、会话、照片、缓存或测试 profile。

当前官方目录可能撤下精选插件。没有可信条目时显示未上架，不能把历史安装成功等同当前可安装，也不能用未核验的直链替代目录。启动无配置的首次偏好引导可以正常关闭；不是账户登录或数据库门禁，不从原版用户配置填充答案。

## 2026-10-22 最新精选范围

用户取消 OpenPencil/UI 设计、PhotoCraft，随后取消 PdfCraft。当前精选与后续安装验证只保留 Excalidraw、上下文洞察。下文五项为历史设计，以本节最新范围为准；插件不内置进应用安装包，不增加运行时分发体积。

## 边界与基线

基于官方 ZCode main `3c5b227649371507ddc4eb46ac5133afe6db1cab`（3.16.2），本地分支 `feature/hscode-v2`。
旧 Preview `e3cd6ab8043c17d072c1e579b3938dc45fa40872` 是审查参考，不合并孤立根历史，不覆盖上游文件树。
仅本地提交，NOT PUSHED；不更改远程默认分支、旧工作树、真实用户数据或原版安装。
禁止修改数据库 schema、SQL、迁移 checksum、步骤、时序、重试与状态协议。

## 身份与隐私

- 2026-10-22 实装核验发现：CLI 并不读取 `ZCODE_HOME` 作为配置/插件根，配置文件默认通过 `homedir()` 查找，存储读取 `ZCODE_STORAGE_DIR`。Main→Host 必须同时绑定子进程 `HOME`/Windows `USERPROFILE` 到已选择的 HSCode 数据根，并显式下发 `ZCODE_STORAGE_DIR=<数据根>/.zcode`，移除继承的 session DB 覆盖；不能只隔离 Electron 或写入无效环境键。仅改变子进程环境，不改系统 HOME、不改数据库 schema/迁移。原 ZCode 构建保持原值。需用真实 CLI 目录路径回归，不以空 profile 首页截图代替。

- 显式构建开关 `HSCODE_BUILD=1` 决定 HSCode 品牌；未开启时保留官方身份与营销行为。
- 编译 define `__HSCODE_BUILD__` 供 shared/UI/Main 使用；非 HSCode 构建缺省为 `false`。安装身份为 appId `ai.hscode.zcode.v2`、productName `HSCode V2`，官方 production/preview 身份不变。
- 新 HSCode 的 profile/业务根默认为 `home/.hscode-v2`，其中继续使用 `.zcode` 子目录；`HSCODE_HOME` 可显式指定测试/开发根。Main、Host、Agent、bootstrap settings 与凭据使用一致的 profile/业务根规则；用户在 HSCode settings 中主动选择的数据根仍优先。不得修改系统 `HOME`。
- 不自动导入、迁移或读取原版 ZCode/旧 Preview/HSCode V1 数据。禁止从继承的 ZCODE_HOME/ZCODE_DATA_BASE_DIR 意外选回旧根。
- 本机开发/隔离验收可显式 `HSCODE_SKIP_SYSTEM_INTEGRATION=1`，跳过协议 handler 与 Explorer/Finder 注册，避免测试覆盖已安装应用的系统集成。仅 HSCode 模式识别此变量；不据此宣称 OAuth 回跳已验收。`zcode://` 的后台兼容与并存仍须单独审查。
- Windows Explorer 的 HSCode 右键菜单使用独立 `HSCodeV2.OpenInHSCode` 注册表 key 和本地化标签；官方 `ZCode.OpenInZCode` key 与文案保持不变。HSCode 构建选用独立图标资源，未启用时仍使用官方资产；本轮只接入 Windows 图标。
- HSCode 构建强制关闭 ARMS/RUM、事件遥测、自动更新、Agent/桌面 OTLP 与远程 crash 上传；运行时不得因 shell 环境重新开启。保留本地 crash dump 与用户明确选择的反馈行为。
- HSCode 反馈表单新建与恢复无明确选择的旧草稿均默认不附带日志；显式 true/false 选择原样保留。官方构建保持默认开启，提示文案随模式准确说明默认值。
- 已授权模型请求、OAuth 和必要远程能力保留；自定义 Endpoint 不经新增代理。编译期设置、运行时初始化、实际联网须分别验收。

## 界面

### 本地免登录与自定义模型

- HSCode 首次启动、无 Provider、退出账号及账号过期后默认进入本地工作区，不强制显示 WelcomeScreen；仍等待真实的数据准备与设置同步，不跳过数据库门禁。
- Root 继续独占登录页打开原因；仅用户点击登录或明确的受保护能力请求打开可选授权页。不制造用户、令牌或登录成功信号；原版 ZCode 行为不变。
- 可选授权页可返回工作区，也可直达现有模型设置。离开时取消当前 OAuth 等待并结束关联 attempt，不能把取消当作成功。
- 模型设置提供明显的“自定义接入”入口，复用现有供应商模板/表单与保存命令，配置名称、接口地址、API Key 和模型；不把自定义服务包装成 Z.ai 套餐，不新增账户后端或依赖。
- 缺少模型仍不能发送真实模型请求，但不得阻止本地文件、浏览器、设置等功能。自动化保持唤醒及启动错误中的产品名随构建品牌变化。

```text
首次启动/退出/凭据过期 → Root 登录页原因（唯一 UI owner）→ HSCode 保留本地工作区
手动登录/受保护能力 → Root → 现有 OAuth owner → 真正授权结果
自定义接入 → 原模型设置/模板 → 原 Provider 保存命令 → 原 Registry 投影
```

验收：隔离空 profile 冷启动和重启均无需跳过登录；可选登录可返回并直达模型设置；自定义模板进入原配置表单；原版登录门禁单测保留。没有真实账号或 Key 时不宣称 OAuth/模型调用验收通过。本轮不生成安装包、不上传 GitHub。

### 首页卡片与本地背景照片（2026-10-21）

- HSCode 编程模式新任务页原有周报总结、报错修复、PPT 制作、闲时任务入口改为图标在上、标题在下的卡片，保留 Client Scenes 数据、prompt 填入、插件确认及自动化导航。原版 chips 与办公推荐列表不变；窄屏两列，宽屏四列，不截断必要操作。
- 外观页新增首页背景照片选择、预览与移除，仅 HSCode 可见。只影响草稿首页，聊天、代码和设置不铺照片；背景不可接收鼠标事件，主题遮罩保障文字可读。
- 使用浏览器本地文件选择器，允许 PNG/JPEG/WebP，原文件最多 10 MiB；解码后最长边压至 1600，重编码 JPEG 清除 EXIF 等原始元数据，持久化结果最多 2 MiB。拒绝 SVG、远程 URL、损坏/过大图片。
- 持久化唯一所有者为当前应用 profile 的 localStorage（独立 HSCode key）；React 只订阅投影，同窗口通知和原生 storage 事件同步；不发送给 Host、Agent、云服务或 Git。读取无效值退回默认，写入失败保留旧照片并提示。选择/移除遵守 latest-wins，迟到解码不能覆盖新操作。

```text
外观文件选择 → 本地解码/缩小/重编码 → localStorage 原子 setItem
                                              ↓ 本窗口事件 / 跨窗口 storage
                                     首页背景与设置预览投影
```

验收：四卡片点击仍走原回调，大小屏与深浅主题；选择/替换/移除/重启持久化，非法格式和配额失败不破坏原值；照片不出网。每项功能的技术、问题与真实验证结果追加到 `HSCODE_V2_FEATURE_CHANGELOG.md`，不记录密钥和用户照片。

### 首页整体居中与托盘品牌补齐

- HSCode 桌面草稿首页按问候语、输入框、提示及卡片总高度整体垂直居中，不再保留上游按 29dvh 固定预留顶部空间的策略。低高度窗口可自然滚动，禁止负位移导致上方内容被裁切。原版布局、聊天滚动和手机远控布局不变。
- HSCode 本地 Windows Tray 创建及未读恢复底图均使用既有 `build/hscode/icon.ico`；原版 `build/icon.ico` 保留。打包路径仍由已有 extraResources 的 H 资源映射提供，不生成安装包。必须检查实际传给 Electron Tray 的资源与未读状态切换，不把资源文件存在当成已显示正确。

### 首页卡片交互反馈

- HSCode 四个推荐卡片提供可辨识的悬停亮边/轻微上浮、按下反馈、键盘焦点和选中标记。减少动画偏好下取消位移动效，仍保留边框/选中反馈。
- 点击后“已选择”只表示用户选择了该入口，不等价于插件安装、生成任务或模型调用成功；继续复用原 callback 与真实插件进度/错误。禁用卡片不能写选中状态。原版 chips 不变。

### 右侧新标签页工具中心（2026-10-21 新附件）

- 仅 HSCode 改为分区工具中心：原生文件/浏览器/终端/审查/符合条件的辅助对话/Dev，再接现有 Git 和插件市场 handler；不创建第二套 side pane/tab owner。原版和远程/手机可见性边界保留。
- 精选名单严格为 Excalidraw、Context Insight、PdfCraft、OpenPencil、PhotoCraft；其他 UI 插件按真实安装清单和有效 surfaces 动态列出。Jupyter Notebook 不在范围内。
- 进入页面可以读取已有市场/安装状态，但不静默下载、启用或提权。未安装、已禁用、无会话、缺沙箱、远程不支持、加载和错误须各自准确显示。先复核真实来源/manifest/依赖并隔离验证，不用固定配置冒充可运行证据。
- 所有打开仍走现有插件 bridge/useOpenPluginUi 和 session/workspace lease；不伪造会话 ID、不复制插件编辑器/MCP 服务，不改主数据库、浏览器 Cookie 分区或 Agent I/O 默认保留策略。
- 搜索、置顶、排序、隐藏与恢复使用 HSCode 本机专属偏好，仅保存入口 ID，不保存插件内容、会话、令牌或照片。父工具中心持有偏好事实，子列表只消费投影与发命令，避免 plugin-ui 与工具中心循环依赖。
- 细化实施设计分别见 `HSCODE_TOOL_CENTER_SPEC.md`、`HSCODE_PLUGIN_TOOLS_SPEC.md`；版本/来源/许可证及真实 Windows 结果见 `HSCODE_UI_PLUGIN_MATRIX.md`。安装包验收仍按用户明确要求 NOT RUN，不生成安装包。

冷启动 HTML 必须在首次解析时已含 HSCode 品牌属性、标题与 H 图片 src，不等待模块脚本/React 才将 Z 切换成 H。构建期 HTML transform 决定品牌；关闭 HSCode 构建时原样保留官方启动壳。初始化页、侧栏及首页同步使用 H，但不改变数据库启动业务逻辑。

数据库启动只改翻译 value；锁冲突采用中性“其他正在访问该数据库的应用或 CLI 进程”。
首页 placeholder 显示 HSCode；淡 H 仅影响中央品牌图。中英文同步。
HSCode 模式隐藏升级营销与邀请奖励入口，不隐藏安全/强制兼容升级，不删除账户能力。
社群改为联系作者，复用平台外链打开 `https://kaiplay.me/#/`；About 显示 HSCode 与 H。
保持右侧 Launcher 的文件、浏览器、终端、审查、辅助对话与原有条件。网站只是用户自建收藏，不新增 CLI/扩展/云书签。

## 收藏夹 V1：状态与事件

```text
Toolbar/管理面板 → hook → IPlatformService 的受控书签端口
                               ↓ 可信 app renderer IPC（拒绝 guest/子 frame）
                     Main BookmarkService（唯一事实所有者）
                               ↓ 串行队列：读取 → 校验 → 原子写入
                     独立 userData/bookmarks-v1.json
                               ↓ revision 快照及已有安全 IPC 变更通知
                     各窗口只持有展示投影；较旧 revision 不回写

点击收藏 → 再次校验 URL → 现有当前 webview 导航/既有新标签打开通道
真实导航/重定向/前进后退事件 → currentUrl → 规范化比较 → 星标
```

- 只存 version、id/title/url、必要时间戳；本地无账号无云。重启持久化。
- 主进程串行增删改查，多窗口不直接读写 JSON。成功持久化后才发布变更；写失败不更新事实状态。
- 统一 new URL 规范化：协议/主机大小写和默认端口按 URL 标准；保留路径大小写、非根尾斜线与 fragment，按规范化完整 URL 去重。
- 仅允许 http/https；拒绝内嵌 username/password。读、写、实际导航都校验，不信任 renderer/磁盘数据。
- token/access_token/api_key/signature/auth 等敏感 query 告警；用户可取消、显式保存原 URL 或自行编辑，绝不静默删除参数。异常与日志不含原 URL。
- 损坏或无效 JSON 不静默清空/覆盖原文件；返回可操作错误并保留原件。临时文件同目录写入并安全替换，失败不损坏原件。
- `@zcode/shared/browser-bookmarks` 导出 `BookmarkPort`、`BookmarkSnapshot`、`BookmarkInput`、`Bookmark`、`normalizeBookmarkUrl` 与 `hasSensitiveBookmarkQuery`。Main 的 `BookmarkService(filePath)` 实现该端口，JSON 为 `{version:1, revision, bookmarks}`；书签仅含 `id/title/url/createdAt/updatedAt`，授权确认不落盘。
- Main 保存命令和磁盘读取均独立校验标题不超过 200 字符、URL 不超过 8192 字符、ID 不超过 128 字符；不得把 renderer 限制当作信任边界。
- 无 `id` 的新建遇到规范化重复 URL 时返回原快照，不改已有标题、不增加 revision 或发变更事件；带 `id` 的编辑若与其他书签 URL 重复则拒绝。revision 只在成功持久化实际变更后递增并通知。
- 地址栏右侧星标基于真实 currentUrl，不跟随未提交输入。收藏列表可搜索、新增、编辑、确认删除，并可当前标签/已有新标签机制打开。
- 不自动抓 favicon；使用通用图标。关闭/切换标签不影响 Cookie 分区或 Agent Browser Use。

## 必须验证

URL 危险协议与凭据、敏感参数确认、规范化去重、CRUD/搜索、多窗口顺序与 stale revision、重启、损坏文件、权限与写入/替换失败、真实导航星标同步与多标签。
类型检查、lint、架构门禁、针对性 Vitest 与 Electron 交互回归；真实账号登录/模型请求及安装验收未做必须标为 NOT RUN，不推断通过。
