# HSCode_ZCode BRANDING MAP（H 品牌替换映射表）

基线：zai-org/ZCode `3c5b2276`；分支 `hscode/zcode-privacy-brand`。日期：2026-10-20。
原则：仅替换 ZCode **应用自身**的可见 Logo/字标/应用身份；**不改** Z.AI、OpenAI、BigModel、GitHub 等 Provider 标识；
不重排 UI 布局；`@zcode/*` 包名、Wire 协议、DB schema、CLI 路径不改名。

## 一、应用身份

| 项 | 上游 ZCode（production） | 上游 Preview | HSCode Preview（本分支 preview flavor） |
|---|---|---|---|
| appId / AUMID（打包态） | `dev.zcode.app` | `dev.zcode.app.preview` | `ai.hscode.zcode.preview` |
| productName | `ZCode` | `ZCode Preview` | `HSCode Preview` |
| linux 可执行名/包名 | `zcode` | `zcode-preview` | `hscode-preview` |
| 运行时应用名 / userData / 单实例锁 | `ZCode` → `%APPDATA%\ZCode` | `ZCode Preview` | `HSCode Preview` → `%APPDATA%\HSCode Preview` |
| 版权 | ZCode | ZCode | `武汉环声海洋科技有限公司 (houkaiji)`，注明基于 ZCode（Apache-2.0） |

- 修改点：`packages/desktop/scripts/desktop-product-identity.mjs`（PREVIEW_IDENTITY 常量，production 分支保持上游原值）；
  `packages/desktop/src/main/desktopRuntimeEnv.ts:65-73`（preview 运行名）。
- electron-builder：`win.icon` 显式声明 `build/icon.ico`；安装器发布者来自 `extraMetadata.author`，值为武汉环声海洋科技有限公司 (houkaiji)，electron-builder 26.x 不支持 `nsis.publisherName`，不得添加该字段；
  `copyright` 字段含上游 Apache-2.0 归属；extraMetadata.author 改为 houkaiji（email 保留上游 dev@ 以免破坏 fpm 校验语义）。
- 协议 deep link `zcode://` 保留（官方登录/远控回调功能必需）。

## 二、图标资产（packages/desktop/build/，全部替换为 H 派生图）

| 文件 | 用途 | 来源 |
|---|---|---|
| icon.ico | Windows 应用/任务栏/Alt+Tab/托盘 | 资源包（H） |
| icon_installer.ico | NSIS 安装/卸载界面 | 资源包（H） |
| icon.icns / icon_installer.icns | macOS（本机不打包，同步替换） | 资源包（H） |
| icon.png | 通用/About 窗口 OS 图标 | 资源包（H） |
| icon_windows.png | Windows 窗口图标（`index.ts:313-320`） | 资源包（H） |
| icon_installer.png | 上游存在、资源包缺失 → 由原图 1024 派生 | Pillow 生成 |
| icons/16–512.png | Linux/系统尺寸 | 资源包（H） |
| icons/1024x1024.png | 上游存在、资源包缺失 → 由原图派生 | Pillow 生成 |

原图保留：交付包 `branding/hscode-logo-source.png`（未做任何修改，仅派生）。
生成脚本（一次性开发辅助，本机临时目录，未入库、不进入交付链路）：Pillow 从原图派生。

## 三、应用内 UI 品牌（全部为"应用自身"品牌面）

| 位置 | 上游 | HSCode 替换 |
|---|---|---|
| 启动壳（React 加载前） | `packages/desktop/src/renderer/index.html` 内联 Z SVG + 标题 `ZCode` | 整贴 `hscode-app-logo.png` 瓦片 + 标题 `HSCode Preview`；动画/边框/壳结构不变 |
| React 启动/引导徽章 | `packages/ui/src/root/RootStartupLoading.tsx` `ZCodeStartupLogoBadge/ZCodeStartupLogo` 内联 Z SVG | 组件内整贴 H 瓦片；保留尺寸体系（titlebar 20px/default 96px）、呼吸动画（CSS keyframes `hscode-logo-breathe`，节奏与原 SVG `<animate>` 一致：3s 起、1.8s 周期）、a11y 与 data 属性；旧导出名保留为别名，调用方零改动 |
| 标题栏左上角 | `WindowsTopLeftLogo.tsx`（复用徽章） | 自动生效；aria-label `ZCode`→`HSCode Preview` |
| 移动/远控应用 Logo | `ZCodeAppLogo.tsx` 引用 `provider-icons/logo-zai.svg`（双重身份） | 改引 `@/assets/branding/hscode-app-logo.png`；`logo-zai.svg` 文件保留，继续作为 Z.AI Provider 标识（`oauthProviderIcon.tsx` 等） |
| App.tsx 应用 logo prop | 引用 `logo-zai.svg` | 改引 H 资源（当前消费方已弃用该 prop，仍同步替换避免回归） |
| 空状态问候 Logo | `v4/ConversationDraftEmptyState.tsx` 浅色线框 Z + 深色 `Z.svg` | 统一为 H 瓦片图（保留 `data-v4-draft-logo` 钩子） |
| 欢迎页/引导页 | `ZCodeAboutLogo`（Z glyph，WelcomeScreen/Onboarding） | H 瓦片图 |
| 高速通道分享卡词标 | `ZCodeWordmarkLogo`（"ZCode" SVG 字标） | 文本词标 `HSCode Preview`（css 宽度改 auto） |
| About 窗口 | 内联 Z SVG；名称 `ZCode Desktop App`；版权 `© year ZCode` | 图标改 icon.png data URI（CSP img-src data:）；名称 `HSCode Preview`；版权含武汉环声海洋科技有限公司(houkaiji)+上游署名（中/英两套文案） |
| 托盘 | tooltip `ZCode`；菜单 `打开 ZCode`；production 才有"检查更新" | tooltip/菜单 `HSCode Preview`（中/英）；preview flavor 无更新入口 |
| Web 登录页 | `copy.brand: "ZCode"` | `HSCode Preview`（zh/en） |
| Web 远控页头 | `ZCodeAppLogo + "ZCode"` 文本 | Logo 经组件自动生效 + 文本 `HSCode Preview` |
| Web favicon | 32px data URI（Z 图） | 32px H data URI（原图派生） |

## 四、明确不替换的部分

- `packages/ui/src/assets/provider-icons/logo-zai.svg`、`logo-bigmodel.svg` 等 Provider 标识（`oauthProviderIcon.tsx`、`ProviderLogo.tsx` 继续使用）。
- `assets/Z.svg` 文件本体保留（上游文件，替换引用后暂无引用方；不删以减小 diff）。
- `assets/cloud-content/weekend-plan-hero.html`：云内容素材，仓库内无引用方，非应用品牌面 → 不动。
- `@zcode/*` 包名、`zcode://` 协议、i18n key（如 `tray.menu.openZCode`）、`data-app-logo="zcode"` E2E 钩子值：保留，降低 upstream merge 冲突面。
- LICENSE（Apache-2.0）、NOTICE.md、THIRD-PARTY-NOTICES.md：原样保留。

## 五、新增 UI 资源

- `packages/ui/src/assets/branding/hscode-app-logo.png`（资源包原样，292KB）
- `packages/desktop/src/renderer/hscode-app-logo.png`（同源，供启动壳 index.html 引用）

## 六、后续 merge upstream 注意

品牌改动集中在：`desktop-product-identity.mjs`、`desktopRuntimeEnv.ts`、`about.ts/aboutWindow.ts`、
`RootStartupLoading.tsx`、`ZCodeAppLogo.tsx`、`App.tsx`、`ConversationDraftEmptyState.tsx`、`ZCodeAboutLogo.tsx`、
`WindowsTopLeftLogo.tsx`、`desktopTray` 文案（shared/desktopMenu.ts）、web 两文件、两个 index.html、
`electron-builder.config.js`、`styles.css`（1 个 keyframes）、`highspeed-share.css`（1 个类）。若上游重构上述文件，
merge 时以"应用自身品牌 → H"为决策原则逐处 resolve。
