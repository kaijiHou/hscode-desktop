# HSCode 交接文档（Handoff）

> 本文档供下一个接手的 Agent 阅读，必须始终保持最新。
> 最后更新：2026-08-24（Phase 2A 完成：Baseline Verification + Network Inspector MVP）

## 当前状态

- **阶段**：Phase 2A 完成（Phase 1.9 Verification Closure + Network Inspector MVP）
- **工作目录**：`D:/hscode`（所有操作必须在 D 盘）
- **上游**：`https://github.com/anomalyco/opencode`，分支 `dev`，commit `e00890c`
- **仓库**：`kaijiHou/hscode-desktop`（public）
- **下一阶段**：Phase 2B — TCP Stream Reassembly + HTTP Session View（见任务书建议，未开始）

## Network Inspector 状态（Phase 2A 新增）

- **功能**：Windows 内置抓包面板（命令面板输入 "Network Inspector" 打开）
  - TCP/UDP/ICMP 捕获（WinDivert 2.2.2，LGPLv3/GPLv2，官方预构建二进制在
    `packages/desktop/resources/win/`）
  - 过滤：`tcp` / `udp` / `tcp.port == 22122` / `src.ip == ...` / `dst.ip == ...`
  - 实时列表 + 详情（Overview / Payload / HEX / ASCII）
  - 明文 HTTP/1.x 单包识别（GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS + path + version + Host）
- **不可用**：HTTPS 解密、完整 TCP 流重组、pcap 导出、Linux/macOS
- **管理员权限**：`WinDivertOpen()` 需要管理员。非管理员 → UI 明确提示
  "Restart HSCode as administrator"（真实驱动验证 error 5 ACCESS_DENIED），不 crash。
  DLL/驱动缺失 → "Network capture engine is unavailable"。
- **架构**：Renderer（UI）→ IPC（network-* 通道）→ CaptureService（状态机+ring buffer）
  → capture-worker（worker_threads 阻塞 recv）→ koffi FFI → WinDivert.dll
- **Native 文件**：`packages/desktop/resources/win/WinDivert.dll`（47KB）
  + `WinDivert64.sys`（94KB）+ `WinDivert-LICENSE.txt`；koffi 3.1.6（desktop devDep）
- **测试**：desktop `src/main/network/*.test.ts`（36 PASS）+ 架构文档
  `docs/network-inspector-architecture.md`

### 启动方法（dev）

```bash
cd D:/hscode/packages/desktop
PATH="/d/bun-bin:$PATH" NODE_OPTIONS=--max-old-space-size=8192 \
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 MSYS_NO_PATHCONV=1 \
  bun electron-vite dev
```

### 测试方法

```bash
cd D:/hscode/packages/desktop && bun test src/main/network/ src/main/app-identity.test.ts
cd D:/hscode/packages/opencode && bun test test/share/share-next.test.ts
cd D:/hscode/packages/core && bun test src/global-path-isolation.test.ts test/models.test.ts
cd D:/hscode/packages/app && bun test --conditions=browser --preload ./happydom.ts ./src/context/highlights.test.tsx
```

### 真实验证结果（Phase 2A，管理员提权运行）

```
capture open OK
UDP 127.0.0.1 → payload="hello-hscode-udp"        ✔
TCP GET /hscode-network-test HTTP/1.1 Host:       ✔（HTTP 识别）
recv: 142 包（TCP 137 / UDP 5 / HTTP 6）→ PASS
非管理员: WinDivertOpen=-1, GetLastError=5 → ADMIN_REQUIRED ✔
```

验证脚本：`scripts/native-smoke-test.cjs`（错误映射）、`scripts/native-capture-test.cjs`/`.bat`（真抓包，需 UAC 提权）。

## Git 提交记录（GitHub 可追溯）

```
当前 HEAD 见 git log；早期本地细粒度 commit（fc1b8d5 等）在首次公开 push 时被 squash，
当前以 GitHub 可追溯 commit 为准。
```

## 已完成（Phase 1 + 1.9 + 2A）

### 品牌套皮
- 应用名 HSCode Dev/Beta/HSCode、`hscode://` deep-link、存储 key、外链
- HTML `<title>`、webmanifest、favicon apple-title → HSCode
- 内部 `@opencode-ai/*` 包名**未动**（任务书明确禁止）

### 隐私清理（Phase 1.9 后状态）
- **Sentry**：代码 + 依赖 + 构建插件 + env.d.ts 全部移除（`git grep sentry` 仅剩注释/图标）
- **Auto updater**：`UPDATER_ENABLED=false`，check() 短路
- **Session Share**：`disabled = true` 硬禁用 + config 强制 `share="disabled"`（UI 隐藏）；
  环境变量无法恢复；用户主动 `opencode import <share URL>` 保留（显式行为）
- **models.opencode.ai**：Desktop 启动注入 `OPENCODE_DISABLE_MODELS_FETCH=true` 默认禁用；
  用户主动 force refresh 仍可能访问配置源（文档已如实标注）
- **远程 Release Notes / hscode.dev**：全部禁用/移除
- 普通启动被动外联 = 0 请求（sentry/opncd/models.opencode.ai/hscode.dev 全无）

### 数据隔离
- Electron App ID：`ai.hscode.desktop[.dev|.beta]`（抽为 `app-identity.ts` 可测纯模块）
- Core 数据目录：`data/hscode`、`cache/hscode`、`config/hscode`、`state/hscode`、`tmp/hscode`

### 仓库裁剪（CHANGE-005）
- 删除 12 个非 Desktop 包 + 大文件；根 package.json 清死脚本；`patches/` 已恢复 18 个

## 已知问题

1. 设置组件/`dialog-connect-provider.tsx` 仍残留 `opencode.ai` 外链（用户主动点击，非被动外联）
2. Windows `core.symlinks=false`：60 个符号链接需 `scripts/hscode-materialize-symlinks.sh`
3. Dev 启动需 `NODE_OPTIONS=--max-old-space-size=8192`（Vite SSR OOM）
4. `electron-builder.config.ts` 引用已裁 `script/sign-windows.ps1`（仅 CI 签名需要）
5. Network Inspector 抓包需管理员权限（非管理员明确提示，不 crash）
6. electron-builder 打包需把 resources/win 加入 extraResources（Phase 2A 未验证打包）
7. `packages/ui/src/theme/themes/opencode.json` 主题名保留 OpenCode（内部 ID）

## 不要修改的东西

- `packages/core/src/` 核心逻辑（除 global.ts 数据目录与 models-dev flag 检查）
- `packages/opencode/src/` 的 tool calling、session、agent 核心
- `@opencode-ai/*` 内部包名（任务书禁止）
- Network Inspector 保持在 `packages/desktop/src/main/network/`、`packages/app/src/components/network/`
  独立层（便于未来 merge upstream）

## 环境配置

- Bun：`D:/bun-bin/bun.exe` 1.4.0；cache `/d/bun-cache`
- Electron：`electron@42.3.3`（npmmirror），`path.txt` = `electron.exe`（无换行）
- 代理：`git config --global http.proxy http://127.0.0.1:7890`（push 需要）
- koffi 3.1.6：desktop devDependency（WinDivert FFI，prebuilt 零编译）