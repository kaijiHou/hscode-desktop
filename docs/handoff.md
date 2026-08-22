# HSCode 交接文档（Handoff）

> 本文档供下一个接手的 Agent 阅读，必须始终保持最新。
> 最后更新：2026-08-22。

## 当前状态

- **阶段**：Phase 1 全部完成（套皮 + 隐私清理 + 文档 + 验证 + 提交）
- **工作目录**：`D:/hscode`（所有操作必须在 D 盘）
- **上游**：`https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`
- **仓库**：`kaijiHou/hscode-desktop`（public）
- **活跃模型**：`mimo-v2.5` via `opencode-go`

## Git 提交记录

```
2ef3134 feat(branding): rebrand OpenCode → HSCode — CHANGE-001
3686da1 feat(privacy): disable session share by default — CHANGE-004
be81563 feat(privacy): disable auto-updater — CHANGE-003
f443752 chore(deps): remove Sentry dependencies — CHANGE-002
fc1b8d5 feat(privacy): remove Sentry crash reporting — CHANGE-002
```

## 已完成

### Phase 1.1-1.3: 基线 + 架构 + 隐私审计
- `docs/upstream-baseline.md`：上游仓库/分支/commit 记录
- `docs/architecture-notes.md`：monorepo 结构、桌面端渲染、打包流程、关键文件索引
- `docs/privacy-audit.md`：Sentry/updater/share/models.dev/api.opencode 逐项分析

### Phase 1.5: 品牌套皮（CHANGE-001）
- 6 个文件改动，应用名/deep-link/存储 key/外链全部从 OpenCode 改为 HSCode
- Dev 启动验证通过：Electron 窗口正常显示，onboarding 完成

### Phase 1.6: 隐私清理（CHANGE-002~004）
- Sentry：6 个代码文件 + 3 个 package.json + bun.lock（代码移除 + 依赖清理）
- 自动更新：`UPDATER_ENABLED=false`，`check()` 在 disabled 时短路
- Session Share：默认禁用，`OPENCODE_DISABLE_SHARE !== "false"` 才启用

### Phase 1.7: 文档
- `docs/change-log.md`：4 条 CHANGE 记录，含 Git Commit hash
- `CHANGELOG.md`：面向用户的版本记录
- `README.md`：保留上游内容，开头加 HSCode 说明

### Phase 1.8: 验证
- typecheck：app + desktop + opencode 三包全部通过
- dev 启动：`electron-vite dev` 成功，Electron 窗口正常，sidecar 连接
- 需要 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR bundle 含 37MB sidecar）

## 正在做

无（Phase 1 全部完成，等待 push）。

## 下一步

1. `git push` 到 `kaijiHou/hscode`（private）
2. 给出 GitHub 链接供下一个 Agent 接手
3. **不要进入 Phase 2**（不重写 OpenCode 核心）

## 已知问题

1. Dev 启动需 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR OOM）
2. `electron.exe` 路径：`node_modules/.bun/electron@42.3.3+759ce506b1ed1a42/node_modules/electron/dist/electron.exe`
3. `path.txt` 内容为 `electron.exe`（无换行），index.js 会拼 `dist/` 前缀
4. Windows `core.symlinks=false`：60 个符号链接需通过 `scripts/hscode-materialize-symlinks.sh` 实体化
5. `models-api.json`（4.2MB，从 `models.opencode.ai` 下载）已加入 `.gitignore`

## 不要修改的东西

- `packages/core/src/` 除 `models-dev.ts` 外的核心逻辑
- `packages/opencode/src/` 的 tool calling、session 管理、agent 核心
- 用户自己的 `/d/todo-app`（与 HSCode 无关）
- 已提交的 5 个 commit 的内容（除非有明确 bug）

## 环境配置

- Bun：`D:/bun-bin/bun.exe`，版本 `1.4.0`
- Bun cache：`/d/bun-cache`（`C:\Users\13772\.bunfig.toml` 已配置）
- Electron：`electron@42.3.3`，通过 npmmirror 下载
- C 盘剩余空间有限，避免写入 C 盘
