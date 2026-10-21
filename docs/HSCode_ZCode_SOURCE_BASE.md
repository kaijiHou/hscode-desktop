# HSCode_ZCode SOURCE BASE（源码基线记录）

生成时间：2026-10-20（Asia/Shanghai）

## 上游与分支

| 项 | 值 |
|---|---|
| 上游仓库 | https://github.com/zai-org/ZCode |
| 审计基线 SHA | `3c5b227649371507ddc4eb46ac5133afe6db1cab` |
| 上游 main 当时 HEAD | `3c5b227649371507ddc4eb46ac5133afe6db1cab`（与基线一致，无漂移，`git ls-remote` 核验） |
| 工作分支 | `hscode/zcode-privacy-brand`（自上游 main 创建，保留完整 upstream ancestry，非孤儿快照） |
| 工作区 | 本机独立工作区（未触碰 HSCode V1、OpenCode2、正式 ZCode 安装） |
| 远端 remote | `origin` 仅指向上游 zai-org/ZCode（只读拉取用）；尚未配置任何推送目标 |

## 克隆方式说明

国内网络下 git 协议大包传输被重置，采用：`git clone --filter=blob:none --no-checkout`（完整 commit/tree 历史继承）+
codeload tarball（`main` == `3c5b2276`）解包填充工作树，`git add -A` 将工作树全部 blob 物化进本地对象库，
`git status` 为空（工作树与 `3c5b2276` 树逐字节一致）。后续所有 diff 均相对该上游提交。

## 依赖与工具链

| 项 | 值 |
|---|---|
| Node | v24.22.0（仓库 engines 要求 `>=24.0.0`） |
| 包管理器 | pnpm 10.33.2（lockfile `packageManager` 字段指定版本） |
| 安装 | `pnpm install --frozen-lockfile`（37m25s；缓存目录与 Electron 镜像均在本机独立配置，ELECTRON_MIRROR=npmmirror） |
| Electron | 41.0.3（electron-builder.config.js 显式固定） |
| 已知安装告警 | `ssh2` 可选原生 crypto 绑定因本机无 Visual Studio 编译器跳过（JS 回退，功能可用）；node-pty 使用 win32-x64 预编译 |

## 构建与打包命令（HSCode）

```
node scripts/hscode-build.mjs
# 等价于：隐私门禁 → pnpm --filter @zcode/desktop run build → pnpm run bundle:desktop -- --win --x64
# 构建环境（由 hscode-build.mjs 统一注入）：
#   ZCODE_ENV=production  ZCODE_PREVIEW_IDENTITY=1  HSCODE_BUILD=1
#   ZCODE_ARMS_RUM_ENDPOINT=''  ZCODE_TELEMETRY_REPORT_ENDPOINT=''  ZCODE_AUTO_UPDATE=0
```

产物目录：`packages/desktop/dist/`（安装包名 `{productName}-{version}-win-x64.exe` → `HSCode Preview-...`）。

## 未提交状态说明

本文档撰写时代码改动已完成、单测通过，但尚未执行最终打包验收与 commit；commit 将在
`docs/HSCode_ZCode_VERIFICATION.md` 完成后进行（见该文档的执行记录）。
