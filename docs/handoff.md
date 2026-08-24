# HSCode 交接文档（Handoff）

> 本文档供下一个接手的 Agent 阅读，必须始终保持最新。
> 最后更新：2026-08-24（Phase 1.9 Baseline Repair & Privacy Closure 完成）

## 当前状态

- **阶段**：Phase 1.9 完成（Baseline Repair & Privacy Closure）
- **工作目录**：`D:/hscode`（所有操作必须在 D 盘）
- **上游**：`https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`
- **仓库**：`kaijiHou/hscode-desktop`（public）
- **下一阶段**：Phase 2 — 自定义 OpenAI Compatible Provider（llama.cpp / Qwen）
  （未开始，收到 Phase 2 任务书前不要动）

## Git 提交记录（GitHub 可追溯）

```
当前 HEAD 见 git log；早期本地细粒度 commit（fc1b8d5 等）在首次公开 push 时被 squash，
当前以 GitHub 可追溯 commit 为准。
```

## 已完成（Phase 1 + 1.9）

### 品牌套皮
- 应用名 HSCode Dev/Beta/HSCode、`hscode://` deep-link、存储 key、外链
- HTML `<title>`、webmanifest、favicon apple-title → HSCode
- 内部 `@opencode-ai/*` 包名**未动**（任务书明确禁止）

### 隐私清理（Phase 1.9 后状态）
- **Sentry**：代码 + 依赖 + 构建插件 + env.d.ts 全部移除（`git grep sentry` 仅剩注释/图标）
- **Auto updater**：`UPDATER_ENABLED=false`，check() 短路
- **Session Share**：`disabled = true` 硬禁用 + config 强制 `share="disabled"`（UI 隐藏）
- **models.opencode.ai**：Desktop 启动注入 `OPENCODE_DISABLE_MODELS_FETCH=true` 默认禁用
- **远程 Release Notes / hscode.dev**：全部禁用/移除
- **OpenTelemetry**：默认不启用（仅用户配置 OTEL_EXPORTER_OTLP_ENDPOINT 才发送）
- **Electron CrashReporter**：`uploadToServer=false` 保留（本地 crash dump）
- 普通启动被动外联 = 0 请求（sentry/opncd/models.opencode.ai/hscode.dev 全无）

### 数据隔离
- Electron App ID：`ai.hscode.desktop[.dev|.beta]`（index/migrate/background-cli/copy-metainfo/deep-links）
- Core 数据目录：`data/hscode`、`cache/hscode`、`config/hscode`、`state/hscode`、`tmp/hscode`
- 与原版 OpenCode 完全隔离，不读其数据

### 仓库裁剪（CHANGE-005）
- 删除 12 个非 Desktop 包 + 大文件（mp4/测试图）+ 21 个多语言 README + 上游配置
- 根 package.json 清死脚本、workspace 修引用
- `patches/` 已恢复（18 个，含 @ai-sdk/openai-compatible）

## 验证记录（Phase 1.9 实测）

- `bun install`：PASS（workspace 解析正常）
- typecheck：app / desktop / opencode / core 四包全部 PASS
- `electron-vite dev`：PASS（窗口启动、crash reporter 路径 `ai.hscode.desktop.dev`、
  sidecar 连接、loading 完成）
- 网络日志：无 sentry/opncd/models.opencode.ai/hscode.dev 请求

## 已知问题

1. 设置组件/`dialog-connect-provider.tsx` 仍残留 `opencode.ai` 外链（Zen 宣传/docs），
   均为用户主动点击的 ExternalLink，非被动外联——可后续处理
2. Windows `core.symlinks=false`：60 个符号链接需 `scripts/hscode-materialize-symlinks.sh` 实体化
3. Dev 启动需 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR OOM）
4. `electron-builder.config.ts` 引用 `script/sign-windows.ps1`（CI 签名脚本），`script/`
   目录已裁剪，仅 GitHub Actions Windows 签名时需要
5. `packages/ui/src/theme/themes/opencode.json` 主题名保留 OpenCode（内部 theme ID，未改）

## 不要修改的东西

- `packages/core/src/` 核心逻辑（除已改的 global.ts 数据目录）
- `packages/opencode/src/` 的 tool calling、session、agent 核心
- `@opencode-ai/*` 内部包名（任务书禁止）
- 用户自己的 `/d/todo-app`

## 环境配置

- Bun：`D:/bun-bin/bun.exe` 1.4.0；cache `/d/bun-cache`
- Electron：`electron@42.3.3`（npmmirror），`path.txt` = `electron.exe`（无换行）
- 代理：`git config --global http.proxy http://127.0.0.1:7890`（push 需要）

## Dev 启动命令

```bash
cd D:/hscode/packages/desktop
PATH="/d/bun-bin:$PATH" NODE_OPTIONS=--max-old-space-size=8192 \
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 MSYS_NO_PATHCONV=1 \
  bun electron-vite dev
```