# HSCode Preview 品牌阶段验证

状态：源码检查与编译通过，本地窗口已启动；完整交互验收未完成。用户要求不生成安装包。2026-10-20。

## 基线与范围

- 上游：https://github.com/anomalyco/opencode ，`v2`，`4617210822bdbb31e5749751afbfb4584ccedac8`。
- 恢复后的源码 tree：`89f56b689675de8f6035ad3fd74375a50d324434`，变更前与官方完全相同。
- 本地工作区：`D:\hscode-opencode2`；品牌分支：`hscode/oc2-brand-preview`。
- 目标审查仓库：`kaijiHou/hscode-desktop`。只允许此品牌分支普通推送；不改默认分支或 V1 分支，不创建 PR/Release。
- 用户最终要求只上传最新源码：品牌分支使用无父提交的单条源码快照，不附带官方 v2 历次提交。上述 SHA 仅记录源码来源；源码和法律归属保留。之前携带历史的推送已停止，远端分支未创建，不使用 force push。
- 旧 HSCode V1 源码只读，未复制 V1 核心或功能实现。Core/Server/CLI/AI 运行逻辑保持上游原样。

## 品牌来源与资源

本轮用户附件 `codex-clipboard-0fff486a-a562-46ed-b048-78f95e89b0c6.png`，原图按字节保存为 `branding/hscode-logo-source.png`。

- 原图：1254 × 1254，SHA256 `a9023cf05fbb0ce8981aeb5f63457839825d2cdf45b027599ec1fe29e9094066`。
- `branding/generate-icons.py` 使用已有 Pillow 做尺寸转换，不使用重新绘制的 H，不增加运行时依赖。
- 三个 Desktop 通道的顶层 PNG、ICO、ICNS 均来自同一原图。ICO 含 16/24/32/48/64/128/256 七个实际图像帧。
- 16/24/32 衍生图裁掉部分外围装饰以增强 H 轮廓；原图不变。已查看小尺寸联系表 `.local/logs/small-icons.png`。
- 界面 PNG `packages/ui/src/assets/branding/hscode.png` 为 512 × 512；字标 `hscode-wordmark.png` 为 1440 × 258。
- 首次启动、Loading、界面 Logo、About 的可见标识替换为 H/HSCode Preview。保留上游隐藏矢量层的动画事件和状态，避免改变首次启动完成时序；这些隐藏层不是可见 O。

## 身份、数据、协议与更新

- 显示名：`HSCode Preview`；App ID / AppUserModelID：`ai.hscode.desktop.oc2.preview`，所有 Preview 通道使用此独立身份。
- 打包作者：`houkaiji`；公司版权：`武汉环声海洋科技有限公司 版权所有`。About 添加品牌署名，原有第三方法律声明、作者名单、LICENSE/NOTICE 保留。
- 早期配置同时隔离 Electron userData/session/temp/crashes 和 CLI 的 XDG data/config/cache/state；服务发现遵循同一新 XDG state，不复用官方/V1 的服务文件。
- 本机 `branding/local-env.ps1` 将可控缓存、工具、临时文件和 Preview 数据指向 `D:\hscode-opencode2\.local`。运行本机成品使用 `pwsh -File branding/run-preview.ps1` 继承该环境。
- 未设置 `HSCODE_PREVIEW_HOME` 时，独立预览数据根默认 `%APPDATA%\ai.hscode.desktop.oc2.preview`；不要把直接双击 EXE 与本机 D 盘启动脚本混淆。Windows 自身的系统写入以及宿主工具自身日志不承诺零 C 盘写入。
- 安装包 `protocols: []`，运行时不注册 `opencode://`，不抢占既有安装的默认关联；深链解析逻辑未改。
- `publish: null` 移除官方更新发布源。Desktop 扩展宿主仅对 `updater` 提供上游已有的 dev 禁用策略；其他扩展的 build 信息、实现和协议均保持原样。
- 本机构建环境禁用 Astro/Turbo/Next 遥测和 Sentry 上传配置；没有新增遥测或分享实现。

## 实际验证记录

完整输出只在被忽略的 `.local/logs/` 保存，不提交含网络头、会话或本机隐私的原始日志。

| 项目 | 结果 | 命令 / 证据 |
| --- | --- | --- |
| Logo 原图与附件相同 | PASS | SHA256 比对，`.local/logs/icons.json` |
| ICO 七尺寸 + 小图可读性 | PASS | Pillow 解析帧，`small-icons.png` |
| Desktop 类型检查 | PASS | `bun run --cwd packages/desktop typecheck`，`typecheck-desktop.log` |
| UI 类型检查 | PASS | `bun run --cwd packages/ui typecheck`，`typecheck-ui.log` |
| App 类型检查 | PASS | `bun run --cwd packages/app typecheck`，`typecheck-app.log` |
| 打包配置测试 | PASS | Desktop 内 `bun test electron-builder.config.test.ts`；7 pass / 0 fail / 152 断言，`test-packaging.log` |
| 官方全仓库 check | PASS | `bun run check`；36 successful / 36 total，`check-windows-links.log` |
| 官方网页构建 | PASS | CLI 官方构建内 `vite build`，含完整网页资源/PWA，`build-cli-cached-runtime.log` |
| 官方 baseline 编译工具探针 | PASS | Bun.build 的 executablePath 指向官方 1.4.2 baseline，生成程序实际输出预期文字 |
| 当前基线 Windows CLI | PASS | `build-cli-cached-runtime.log`；产物 214667264 字节，实际输出 `opencode v2.0.26` |
| Desktop build | PASS | `build-desktop.log`；`out/main/index.js`、preload、renderer 已生成 |
| Windows NSIS / EXE | NOT COMPLETED | 用户要求仅本地运行，打包已中止；`dist/win-unpacked` 不完整，非交付成品 |
| 本地编译结果启动 | PARTIAL | 通过现有 Electron 运行；主窗口标题 HSCode Preview、非零窗口句柄、日志 main window visible / service ready；用户提供首页截图。未用截图替代完整交互验收 |
| 二次启动 | PARTIAL | 修正误用 Hidden 启动参数后重启，进程与服务就绪；未验收状态持久化 |
| Agent session / Windows PTY | NOT RUN | 不发起真实模型请求验证品牌 |
| 任务栏 / Alt+Tab / 安装快捷方式 | NOT RUN | 需实际成品及系统表面验证 |
| GitHub push | PENDING | 用户授权提交；仅品牌分支，普通非强制 push，结果以实际远端 SHA 为准 |

本轮确认运行路径为 `D:\hscode-opencode2\packages\desktop\node_modules\electron\dist\electron.exe`，源码来源为上述官方 upstream/v2 固定基线。Core/Server/CLI/AI 内容与基线相同。本轮仅替换品牌，未重新设计官方首页布局。

用户要求移除 Preview 模型 Key：凭据 API 检查确认没有已保存的 key/oauth 凭据；启动入口不再传递本机 `API_KEY` / `*_API_KEY` 环境变量。保留机器全局配置及旧版数据；本地数据、日志、缓存均不提交。此操作不是向服务商撤销密钥。

## 构建环境问题与复现要点

使用 Bun 1.4.2、Node 24.22.0、Electron 44.4.5；不使用 V1 的 Electron sidecar 补丁。

1. 本机不能创建 Windows symlink。先运行 `branding/windows-links.ps1` 将上游链接临时物化；提交前必须 `branding/windows-links.ps1 -Restore`。链接清单在 `.local/windows-links.json`。首次全仓库检查在 Enterprise 的同类占位文件报 TS1128，补齐该链接后完整 check 通过；没有提交 Enterprise 功能改动。
2. npm 的 `@ibm/plex@6.4.1` 大文件连接失败。分段下载官方原包并核对上游锁文件 SHA512 后补本机缓存，`bun install --frozen-lockfile --offline` 成功；锁文件未改。
3. CLI 自动下载 `bun-windows-x64-baseline-v1.4.2` 发生 `ConnectionClosed`。官方 baseline ZIP SHA256 为 `78c221c2376f79731ccf4e4af0b3bb46d81fefa3296c5abee09ad8a1b21e68c6`，已完整下载并验证。使用上游现有 `BUN_COMPILE_RELEASE=bun-v1.4.2` 和它支持的 `.bun` 编译缓存，未改 CLI 编译实现。
4. 当前 CLI 编译命令：`OPENCODE_CHANNEL=latest OPENCODE_VERSION=2.0.26 BUN_COMPILE_RELEASE=bun-v1.4.2 bun run --cwd packages/cli build --target=opencode-windows-x64-baseline --skip-install`。上游脚本先清理专用输出，再构建网页；预下载的运行时在此后放入该输出的 `.bun/bun-v1.4.2/bun-windows-x64-baseline/bun.exe`。不要提前放入会被本轮构建清理的目录。

## 剩余 OpenCode 品牌扫描分类

- 已处理的应用品牌：Desktop 名称、早期/正式窗口标题、打包/安装图标、启动和主界面 Logo、About 主字标、en/zh/zht 的菜单名。
- 有意保留：OpenCode 服务提供商/Console/Zen 的图标与名称、技术包名、协议/IPC/API 标识、内部文件名、法律归属、作者名单和帮助文档中的技术名称。
- 未验证：真实 Windows 任务栏与 Alt+Tab、安装快捷方式，其他语言中的上游产品文案，以及目标外平台的实际运行结果。

## 上游同步冲突面

- 二进制资源：三通道顶层 icons 与公共 favicon；上游更新这些文件时重新从本原图生成。
- Desktop 少量常量/窗口标题、打包元数据、copy-icons/copy-metainfo、configure/environment 和 updater 宿主上下文；升级时逐点检查，尤其确认服务发现仍读取隔离的 XDG state。
- 界面展示点：共享 Logo/Wordmark、About 字标/品牌署名、菜单标题和少量品牌翻译。保留布局和首次启动动画完成事件。
- 后续从新官方 v2 基线建立新品牌分支，应用本轮品牌提交并复测；不要把 V1 历史合并进来，不通过全局替换维护品牌。本轮不执行下一次上游升级或任何功能迁移。
