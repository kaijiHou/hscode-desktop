# HSCode V2 实施与验收报告

日期：2026-10-21；增量核验 2026-10-22。本报告随实施更新；未运行的项目不代表通过。

## 2026-10-22 最终源码交付核验

用户已明确同意安全源码新分支上传，不带上游历史、不修改线上现有分支；不生成安装包。下面较早的 NOT PUSHED/仅本地段落是历史阶段，不代表新的发布策略。

用户随后要求去掉首页大 H：只移除草稿首页水印，应用图标、托盘与冷启动 H 保留。增量 3 文件 11 项测试、最新完整 Electron 18/18 通过；证据 `.agent-context/electron-smoke-no-home-watermark/result.json`，技术与问题记录 F013。真实窗口已在无运行任务/非空草稿时安全刷新。该改动同步同一安全源码分支，不引入上游历史。

- 本地 Main/Host 和 renderer 编译已成功；未运行 electron-builder，没有制作或安装 EXE。
- 最新针对性 Vitest：17 文件，133 PASS / 4 skip；构建环境 Node tests 8/8 PASS。整体 typecheck PASS；lint 0 errors / 96 既有 warnings；架构检查 0 violations。
- 最新完整 Electron 回归：18/18 PASS，证据 `.agent-context/electron-smoke-20261022-storage-final/result.json`。包括冷启动静态 H、免登录、书签/导航/Cookie/重启、多窗口持久化、自定义模型表单、背景照片、卡片交互/大小屏、两精选工具中心、偏好重启与可选 collector 陷阱 0 请求。
- 最新原生能力回归：9/9 PASS，证据 `.agent-context/native-tools-validation/runs/2026-10-22T08-23-15-500Z-Dimfcu/result.json`，细节见 `HSCODE_NATIVE_TOOLS_VALIDATION.md`。中文空格文件读取、PowerShell 7 真执行/cwd、Git/审查入口、实际市场目录、Dev 显隐和 CLI 实际目录隔离均通过。
- 隔离结论修正：旧测试只证明 Electron userData，不能证明独立插件 lane 的 CLI HOME/storage。真实安装暴露了 C 盘原版目录问题；Main 环境出口已修正并补污染回归。真实窗口重新安装 Excalidraw 0.3.4，详情和实际文件均在本 checkout 的 `.hscode-local-data/.zcode/cli/plugins/cache/` 下；原版 C 盘安装物未删除或迁移。
- Context Insight：较早的 0.1.1 隔离安装成功是历史观测；本次刷新官方目录已无此项，未强装、未冒充已安装。最终精选名单仍严格是 Excalidraw 与 Context Insight，未上架状态明确显示。取消的 UI 设计/PhotoCraft/PdfCraft 不再安装或内置打包。
- 限制：无真实账号/Key，没有跑模型、真实 OAuth、插件业务编辑保存/完整生命周期或真实父任务辅助对话；Git 回归仅验证原生入口，不声称验证仓库写入。没有把这些 NOT RUN 写作全部通过。
- 发布只使用当前安全树的新根提交，保留必要许可证、源码、锁文件和公共构建配置；真实 profile、密钥、聊天、数据库、照片、日志、缓存与构建产物均不进入发布树。可疑上游历史不携带，原本地开发历史保留，原线上 master/Preview 不改。

最终安全扫描结果与发布定位由交付摘要给出；本报告不保存秘密值或原始敏感报告。

## 较早增量状态（本地运行阶段，历史）

- 当前仍为 `feature/hscode-v2` / HEAD `3c5b227649371507ddc4eb46ac5133afe6db1cab`；再次只读核对官方 main 与旧 Preview SHA 均未改变。现有未提交补丁保留，NOT PUSHED，未宣称产生本地新提交。
- 按用户要求取消安装包构建。本阶段只编译本地 Main/renderer 并运行隔离 Electron；旧不完整 dist 不是交付物。
- 默认免登录进入、可选上游授权、自定义模型入口、双语启动/自动化文案、首页四卡片与本机背景照片均已实施，详细技术/问题索引见 `HSCODE_V2_FEATURE_CHANGELOG.md` 的 F001–F006。
- 用户反馈首页偏下后，基于原 `29dvh` 顶部占位根因改为 HSCode 草稿整组自然居中；独立回归验证宽/窄窗口整组中心偏差小于 4px。未使用负位移裁切内容。
- 用户反馈托盘仍为 Z 后，修正未打包 Windows 资源路径；Tray 创建和角标恢复共用 H 解析器。单测通过，原生窗口已成功重启；没有通过 computer-use 验证系统托盘像素。
- 本轮合并针对性测试 9 文件 74 项 PASS；中心/托盘/时间线 3 文件 10 项 PASS；独立 Luna/xhigh 再跑 6 文件 43 项 PASS、15/15 Electron 场景 PASS。各测试集合有重叠，不能相加当独立覆盖数。
- 最新本地 Main/renderer 编译与类型检查 PASS；独立架构检查 0 violations、lint 0 errors / 96 既有 warnings。真实 OAuth、真实模型、Agent Browser Use 完整任务、安装包升级均 NOT RUN。
- 凭据扫描增量：当前 unstaged diff 约 36.19 KB 与新背景模块约 14.60 KB，Gitleaks 脱敏扫描均 exit 0 / no leaks。此范围不替代下文记录的历史风险结论。
- 2026-10-22 用户限制最多 2 个子智能体，项目 AGENTS 已记录；主负责集成，工具中心及插件验证子任务均已关闭，当前没有运行的子智能体。
- F007 已重新完成 renderer 编译；隔离 Electron 实测悬停 border/translate、点击 aria-pressed 与“已选择”、reduced-motion 均通过，不将其等同于异步插件执行成功。
- 工具中心和精选入口已接线，相关 7 文件 49 项单测、整体 typecheck 与架构 0 违规通过；最终 lint 96 既有 warnings / 0 errors。独立工具中心 Electron smoke 4/4 PASS，最终合并 smoke **18/18 PASS**（含 F007、新工具中心、重启前后实际偏好一致、原生 Git/市场、原书签/背景照片和 collector 0）；结果位于 `.agent-context/electron-smoke-20261022-final/result.json`，截图已核对。单独/合并集合重叠，不相加计覆盖。
- 四个已发布插件在全新 D 盘 profile 中实际刷新目录、安装、启用和 MCP 静态界面资源读取 PASS；无模型请求、无业务工具调用。OpenPencil 官方市场未上架，没有下载安装；插件编辑/导出/全生命周期 UI 不由此推定 PASS。详见插件矩阵。Jupyter Notebook 明确不在范围内。
- 2026-10-22 安全增量：tracked diff（排除含历史疑似 token 删除行的那份旧文档）394.20 KB、untracked 文本源码 152.14 KB，脱敏扫描均 exit 0 / no leaks。本地 renderer 129.21 MB 扫描 exit 1 有 4 个候选，已核对为压缩代码的 authenticated 判断、编辑器 anchor.key 和 FourKeyMap 表达式及其 sourcemap 重复项，不是凭据字面值；不能报告工具零命中。没有扫描/复制真实开发 profile，Git 忽略已确认。历史风险仍按下文保留；未上传。

## 首轮只读核查（A–F）

### A. Git 与环境

- 官方 main：`3c5b227649371507ddc4eb46ac5133afe6db1cab`，通过实际 ls-remote 核对，version 3.16.2、pnpm 10.33.2。
- 本地旧工作树原 HEAD：`350309903aae6ab3cc87e1b97b8182108f6d0b20`，分支 `hscode/zcode-privacy-brand`，核查时干净。
- 旧远端 Preview：`e3cd6ab8043c17d072c1e579b3938dc45fa40872`，单根快照；master 仍为 `e012402e24b07c4e055fffcb263728891f8d589f`。本轮不改动它们。
- 既有 origin 为官方 `https://github.com/zai-org/ZCode.git`，并非用户仓库；没有更改 remote 或执行 push。
- 隔离本地工作树 `D:\hscode-v2`、分支 `feature/hscode-v2` 从官方 main 创建，保留官方 Git 祖先；与旧工作树共享 Git 对象库而非工作区改动。
- Windows；默认 shell 上的 Node 是 20.12.1，不满足要求。本轮显式使用既有 D 盘 Node 24.22.0；pnpm 10.33.2。

### B. 旧补丁比对

旧 Preview 相对官方共 60 个文件差异，已审阅变更清单。已有反馈日志初始/草稿缺省 false、Agent 打包 OTLP gate、独立 Electron Preview 名称、H 素材可借鉴；不能误判成尚未实现。
不合并旧快照，不把其文件树整体覆盖官方。新分支仅重做经过核对的隔离、隐私、品牌和书签补丁，避免旧报告及无关样式改动混入。

### C. 初步风险

| 级别      | 核查发现                                                                               | 处理边界                                                                                                |
| --------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| P0 待复核 | 上游设计文档 OAuth 响应 token 字面值无法仅凭公开示例确定是否为真实值，历史扫描命中两条 | 当前新分支示例改为明确占位符；历史仍保留，不推送、不擅自改写远程历史；若原作者确认是真实凭据需吊销/轮换 |
| P1        | 旧 Preview 只隔离 Electron，业务配置、会话、模型凭据、设备遥测标识默认仍共用 `.zcode`  | 新分支在身份/启动路径层隔离，不改数据库迁移，不读旧数据                                                 |
| P1        | 旧构建 gate 不等于运行时总禁用；外部 OTLP 环境与 skip-build 旧产物可能绕过预期         | 核对编译 define、运行期继承和产物，不把静态检查写成零网络上传                                           |
| P1        | 旧 `zcode://` callback 协议共用                                                        | 不以改 Provider/OAuth 常量冒充修复，需独立核对注册与后端兼容；尚未验收                                  |
| P2        | 用户可见文案、社区入口、营销入口与品牌不一致，旧部分测试仍断言官方名称                 | 显式 HSCode 模式最小修改，官方模式保留                                                                  |

### D. Secrets 扫描范围

- 补齐原 partial clone 缺失的 3,160 个对象；随后 `git rev-list --objects --all --missing=print` 缺失数为 0，仓库非 shallow。
- Gitleaks 8.30.1：`git --redact=100 --log-opts=--all`，覆盖本地所有可达 refs（含官方已抓取分支与旧 Preview 根快照）。9 个可达提交，工具报告 8 个有差异的提交，约 291.97 MB，22.2 秒。
- 原始工具 exit 1，163 条候选，不能报告“工具零命中”。95 条清单摘要/上游 Git ref、4 条测试 provider 标识、62 条核对上下文的 fixture/协议字段/文档命名空间；2 条是上述同一文档示例 token 的历史命中，无法确认真实有效性，不联网试用。
- `.env.development`/production/example 的链接和 OAuth Client ID 属公共配置；E2E API Key 为空，CLI 模板是占位符，npmrc 为公共 registry。没有读取或复制用户真实模型配置。
- 不涵盖 GitHub 上旧 master/V1 全部历史、未抓取的远端隐藏 refs 或真实用户目录。构建产物和运行时网络须另列证据；不得笼统宣称全覆盖或绝对安全。
- 原始脱敏报告仅留本机忽略目录，不提交；不会把密钥值、Cookie、会话、数据库、配置或浏览器资料写入此报告。

### E. 最小实施顺序与文件面

1. 规格先行，明确 HSCode 开关、隔离根和唯一状态所有者。
2. `shared/env`、build-time-config、desktop identity/runtime/early bootstrap、services paths/settings：品牌/数据根/遥测门控与测试。
3. 中英文 locale、现有 Logo/About/社区/营销组件：只改显示与入口，不改数据库流程或 Launcher。
4. 共享书签契约 → Main 独立 JSON 服务 → 安全 IPC/preload/platform → UI hook/星标/管理 → 既有标签导航。
5. 针对性测试、typecheck/lint/架构检查、隔离 Windows/Electron 验证、产物和网络审查，最后本地提交。

### F. 验收条件

- 具备 Windows、Node24、pnpm、现有 Electron 41.0.3；新工作树离线安装复用 2,169 缓存包，下载数 0，未重新安装系统环境。
- Electron dist 以 D 盘目录连接复用旧工程依赖运行时，不修改旧源码/用户数据；TEMP/TMP 与本轮缓存指向 D 盘忽略目录。
- C 盘首查仅约 84 MiB，随后可用空间降至 0；D 盘仍约 50 GiB。此时不能承诺 C 盘安装验收，且 Windows/其他应用仍可能自行写 C 盘。本轮未扩大授权清理 C 盘或停止正式 ZCode。
- 没有独立测试账号或真实站点 Cookie/模型调用的已完成证据。需要隔离非敏感配置验证；没有账号的场景标 NOT RUN。

## 实施与测试状态

### 测试隔离事故与修正

初轮设置服务测试曾因编译标记/module cache 与继承 home 覆盖未隔离，误在 `%USERPROFILE%/.hscode-v2/.zcode/v2/setting.json` 创建 1,609 字节测试设置。该文件与新目录创建时间均属于本轮（2026-10-21 15:32:00），不是原版 `%USERPROFILE%/.zcode`。
已核对元数据并原样移动到 D 盘本机忽略的事故归档，前后 SHA256 一致；未读真实 ZCode 配置、未删旧目录、未覆盖目标。随后修复测试模块缓存恢复，并让设置服务夹具同时固定普通和 HSCode 专用 profile，防止继承终端覆盖。初轮失败不计通过，后续单独列实测结果。

## 已实现与保留边界

- 实现：HSCode 编译身份、独立 profile/业务根、Main→Host→Agent 路径传递、默认关闭可选采集、反馈日志主动选择、H 品牌、联系作者、营销入口隐藏、本地收藏夹。
- 未改变：数据库 schema/SQL/checksum/迁移步骤与时序、原浏览器内核/Cookie partition、Provider 名称与 OAuth 常量、原有工作流/Launcher 条件。
- 不自动导入旧数据；旧 `D:\hscode-zcode` 工作树 HEAD 仍为 `350309903aae6ab3cc87e1b97b8182108f6d0b20`，复查工作区干净。
- 原版 ZCode 构建保持原 appId、品牌、默认反馈行为和营销入口。通过显式构建开关选择差异，不全局替换内部 `zcode` 标识。
- 仍待独立验收：真实账号 OAuth/模型调用、Agent Browser Use 实际任务、安装/卸载/升级、`zcode://` 与原版并存的注册策略。当前不得据此宣称可正式发布。

## 修改文件与按钮链路

| 功能            | 主要文件/入口                                                                                                                                                                                 | 单一所有者与行为                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 构建身份/隐私   | `scripts/build-time-config.mjs`、`scripts/hscode.mjs`、desktop `tsup.config.ts` / `vite.config.ts`、`scripts/desktop-product-identity.mjs`                                                    | `HSCODE_BUILD=1` → 编译 `__HSCODE_BUILD__`；appId `ai.hscode.zcode.v2`、产品名 `HSCode V2`，关闭可选上报/自动更新      |
| 路径隔离        | services `paths.ts` / `settingService.ts`、Main `desktopDataBaseDirBootstrap.ts` / `desktopRuntimeEnv.ts` / `index.ts`                                                                        | 最早 bootstrap 确定 profile 与用户明确选择的业务根；Main 传给 Host/Agent；不信任继承的旧 ZCODE 根                      |
| 启动/首页品牌   | renderer `index.html`、UI `root/RootStartupLoading.tsx` / `WelcomeScreen.tsx` / `App.tsx` / `v4/ConversationDraftEmptyState.tsx` / `components/mobile-ui/ZCodeAppLogo.tsx`、双语 locale       | HTML 首帧静态品牌 → 纯视觉初始化图标 → 登录页/侧栏 H → 首页淡 H；仅局部图形变化，无全页 opacity                        |
| 菜单/About      | shared `desktopMenu.ts` / `helpAppConfig.ts`、Main `desktopCommandHandlers.ts` / `about.ts` / `aboutWindow.ts`                                                                                | 原菜单命令 → 原 shell/platform 外链 → `https://kaiplay.me/#/`；About 名称/图标同步                                     |
| 营销            | UI `Root.tsx`、`MarketingTouchProvider.tsx`、`WorkspaceSidebarFooter*.tsx`、`ChatErrorBanner.tsx`                                                                                             | 保留 Provider/context，Root 传 `enabled=false` 阻止营销 runtime；隐藏套餐推销/邀请入口，不屏蔽强制兼容更新             |
| 反馈日志        | `feedback/FeedbackSubmitForm.tsx` 和双语提示                                                                                                                                                  | 初始与恢复无明确值的草稿默认 false；显式用户选择保留；官方默认不变                                                     |
| 收藏契约/持久化 | shared `browser-bookmarks/contract.ts`、Main `bookmarks/bookmarkService.ts`、`desktopBrowserDataIpc.ts`                                                                                       | `BookmarkService` 是唯一事实所有者，串行读写、安全临时文件替换，成功后广播 revision；损坏/失败不清空原文件             |
| 收藏 UI         | `browser-bookmarks/BrowserBookmarksControl.tsx` / `useBookmarks.ts` / `bookmarkProjection.ts`                                                                                                 | 真实 currentUrl → 规范化 → 星标；管理按钮 → 搜索/新增/编辑/确认删除；敏感 query 保存需明确勾选                         |
| 收藏桥接/打开   | shared `platform.ts` / `channels.ts`、client `globals.d.ts`、desktop preload / `desktopPlatform.ts`、`UnifiedBrowserView.tsx` / `AnimatedSidePanePanel.tsx` / `BrowserUseSidePaneContent.tsx` | UI → usePlatform → 受控 IPC → Main；打开当前页复用 openUrl，新标签复用父级 onOpenBrowserUrl；guest/子 frame 无读写权限 |

```text
真实导航事件 → currentUrl → 星标展示
点击收藏 → hook → preload IPC → Main 校验/串行队列 → 原子持久化
                                             └─ revision 快照 → 各窗口投影
点击列表 → 校验 URL → 原有当前标签/新标签通道 → 同一个 webview 实现
```

书签限制：HTTP/HTTPS，拒绝嵌入凭据；标题≤200、URL≤8192、ID≤128，Main 和磁盘读入均校验。规范化保留路径大小写、非根尾斜线和 fragment。无账号、无云、无 favicon 批量请求、不保存网页内容或 Cookie。

### Launcher 后续扩展

继续在 `AnimatedSidePanePanel.tsx` 的 `openTabLauncherItemById` 及 `animatedSidePanePanelModel.ts` 的 `resolveOpenTabLauncherItemIds` 扩展既有 item，事件由 `useAppPanels.ts` 处理。保持 workspace identity、条件可见性、办公模式及原有生命周期；不要另外创建标签状态或浏览器。任意网站通过收藏新增，不增加固定网站卡片。

## 数据隔离路径矩阵

下表为默认解析规则，未读取用户原版配置实值。`U` 为系统用户目录，`P` 为新 HSCode profile（默认 `U/.hscode-v2` 或显式 `HSCODE_HOME`），`B` 为用户在新 HSCode 设置中主动选择的业务根（未选择时等于 P）。

| 数据                | 原版 ZCode 默认                               | 旧 Preview 已审查规则             | 新 HSCode V2                                                                |
| ------------------- | --------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| 业务根              | U，可受原设置/通用环境覆盖                    | 与 production 共用原业务根        | B，不继承旧通用根                                                           |
| 设置                | `U/.zcode/v2/setting.json`                    | 旧业务根下同一设置作用域          | `P/.zcode/v2/setting.json`                                                  |
| 凭据                | `U/.zcode/v2/credentials.json`                | 旧业务根下 `.zcode/v2`            | `B/.zcode/v2/credentials.json`                                              |
| 任务索引/会话       | `U/.zcode/v2/tasks-index.sqlite`、`sessions/` | 旧业务根下 `.zcode/v2`            | `B/.zcode/v2/tasks-index.sqlite`、`sessions/`                               |
| Electron userData   | `%APPDATA%/ZCode`（dev/preview 名称依运行态） | `%APPDATA%/HSCode Preview`        | `P/electron/userData`                                                       |
| 浏览器 session/缓存 | 原 Electron sessionData                       | Preview Electron sessionData 独立 | `P/electron/sessionData`，partition 名仍为 `persist:zcode-embedded-browser` |
| 收藏                | 无本轮独立服务                                | 无本轮独立服务                    | `P/electron/userData/bookmarks-v1.json`                                     |
| 日志/local crash    | 原业务根下 `.zcode/v2`                        | 业务根共享风险                    | `B/.zcode/v2/logs`、`crash/live` / `crash/archive`                          |

测试 profile、APPDATA、LOCALAPPDATA、TEMP 均显式指向 D 盘；普通本地启动入口默认使用 checkout 内 `.hscode-local-data`，这是持久数据，不是可自动清理的缓存。发布包直接启动仍按上述 P 默认规则，不承诺系统/第三方组件完全不写 C。

## 真机发现与回归修正

1. ARMS 未初始化后，原启动链仍调用 `setConfig`，报 `Config not initialized`，导致首窗未创建。Main 仅在非 HSCode 模式配置 SDK/注册周期采集；HSCode 本地 crash capture 保留。真实窗口后续启动通过。
2. 反馈缺省值曾未从上游切换，已补齐 HSCode 初始/草稿 opt-in 和双模式测试。
3. 首次 UI 比对发现登录/初始化/侧栏/首页仍有独立 Z 资产，已分别改为 H；Provider Logo 保留。用户复测发现 HTML 首帧仍闪 Z，进一步改为构建期 HTML transform 静态指定品牌，不依赖模块加载后切图。
4. 初轮 E2E 在 guest 未 attach 或尚在加载时调用原生方法/点击返回，出现未 ready 与 ERR_ABORTED。测试改为等待真实 guest 完成加载，未改浏览器业务导航。
5. 匿名跳过登录不等于已登录；重启测试须再次走原“使用 API key→跳过”入口，再从已注册应用窗口读书签。未放宽 IPC 授权，也未写入假凭据。

## 验证记录

不同批次有重叠，不把以下数字相加成所谓全量测试数。原始日志仅在本机 `.agent-context`。

| 检查/命令                                                | 实际结果                                                                                                                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`（最终 UI/冷启动补丁后）                 | PASS，exit 0                                                                                                                                                                      |
| `pnpm lint`                                              | PASS，0 errors / 96 warnings；保留上游警告，不冒充零警告                                                                                                                          |
| `pnpm architecture:check --changed`                      | PASS，0 violations；营销 Provider 已登记到现有受管模块，无新增豁免                                                                                                                |
| 浏览器/Launcher 生命周期/数据库显示定向回归              | PASS，10 files / 146 tests                                                                                                                                                        |
| 设置/路径/身份隔离定向回归                               | PASS，5 files / 99 passed / 4 skipped；事故 C 盘测试文件未再生成                                                                                                                  |
| URL 与 JSON 存储回归                                     | PASS，4 files / 23 tests                                                                                                                                                          |
| 反馈与收藏 UI 补充回归                                   | PASS，3 files / 22 tests                                                                                                                                                          |
| 营销/品牌/Explorer 补充回归                              | PASS，5 files / 40 tests                                                                                                                                                          |
| 初始化图标/数据库展示/错误提示回归                       | PASS，5 files / 19 tests                                                                                                                                                          |
| build-time-config / hscode-env / sqlite-schema-contract  | PASS，16 tests；未改 schema 或迁移文件                                                                                                                                            |
| renderer 配置/静态冷启动品牌                             | PASS，7 passed / 1 upstream Windows skipped                                                                                                                                       |
| `prepare:runtime-assets`、完整 HSCode production build   | PASS；当前 checkout 重建 Agent/插件/搜索工具，未只复制旧 CLI                                                                                                                      |
| Windows Electron 实机（Playwright，无 computer-use）     | PASS，10 步：静态冷启动 H、独立身份/资料、无 key 进入、星标、重定向前进后退、并发 JSON 保存、管理器新标签、Cookie partition、真实重启保存、注入可选 collector 后 0 次测试端点请求 |
| 静态冷启动拦截应用模块仍显示 H                           | PASS，静态品牌为 H，Z display=none；图片已加载，截图已核对                                                                                                                        |
| Windows unpacked/installer                               | 已按用户要求取消打包；本轮仅本地界面编译/运行。不完整旧 dist 不是交付物，安装/卸载/升级 NOT RUN                                                                                   |
| 真实模型请求/OAuth/第三方站点登录/Agent Browser Use 任务 | NOT RUN，没有独立测试账号或模型 key；保留原实现不等于实机验收通过                                                                                                                 |

运行时网络证据范围：观察附着后 renderer 请求的 method/origin/path，不保存 query、body 或 headers；本机 collector 陷阱用于发现继承环境重新开启可选导出的行为。不是全面启动期/Node 子进程抓包，也不证明所有外连为零。上游必要的启动配置/OAuth Provider 等业务网络没有被无差别封锁。

## 当前源码安全复查

将待提交索引导出到忽略目录，用 Gitleaks 8.30.1 扫描完整当前文件树：约 156.56 MB、75.8 秒，exit 1 / 62 候选。29 条为第三方清单 hash/ref，33 条为已复核的测试夹具/协议命名空间/测试 provider ID，不能把工具结果写成零命中。后续新增补丁还需 staged 复扫；构建物结论单独记录。

真实用户模型设置、Cookie、会话、数据库、原始诊断与测试 profile 未进入索引；`.agent-context`、`.hscode-local-data`、node_modules、out/dist 均不提交。上游历史疑似 token 风险仍在，本轮不发布/推送，不擅自改写历史。

## 本地运行与交付边界

使用 Node 24 与 pnpm 10.33.2，在源码根目录执行 `pnpm start:hscode`。要重新构建用 `pnpm build:hscode`，热开发用 `pnpm dev:hscode`。入口检查构建身份及 main SHA256，拒绝把普通 ZCode 的旧输出当作 HSCode 启动。

用户远端/原版安装未修改。最终本地 commit 与 Windows 构建结果在收尾记录中补齐；当前 NOT PUSHED。

## 后续同步办法与 TODO

1. 目前 origin 指向官方仓库，执行 `git fetch origin` 只读抓取，先核对上游 SHA 和变更范围；不要直接覆盖工作树。
2. 在单独干净工作树评估 upstream/main 与本分支差异。合并/处理冲突后重跑身份、路径、反馈、收藏与数据库显示回归、typecheck/lint/architecture，以及真实 Electron 与打包测试。
3. 保留 H 资产和显式 HSCode gate；Provider、协议 ID 和数据库迁移沿用上游。新增 Launcher 项继续使用原入口，不复制状态机。
4. TODO/P1：`zcode://` 共用仍可能由最后安装者接管；本轮通过 HSCode-only skip-system-integration 保证本机开发/测试不改系统注册，不把它当成发布解决方案。
5. TODO/P0待复核：历史设计文档疑似凭据由原提供方确认并在必要时轮换；当前替换占位符不能消除旧历史风险。
6. TODO：给正式升级流程补安装/回滚/卸载和真实账号测试。只有补齐这些验收并另获用户推送授权，才考虑发布。
