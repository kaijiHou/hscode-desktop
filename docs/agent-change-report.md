# HSCode Agent Change Report

## Current Recovery

Date: 2026-09-08

Repository: `D:\hscode-new`

Branch: `recovery/fresh-clone-server-start`

Base: `e012402e24b07c4e055fffcb263728891f8d589f`

HEAD: `0480c8f5d310b89a02963d94f63528550d04709f`

Objective: 恢复 fresh clone 后 Desktop local server 启动失败的问题。当前用户可见错误为 `Cannot read properties of undefined (reading 'listen')`；本阶段只处理 Node sidecar build/export contract，禁止 UI、Terminal、Network、Sidebar 和模型改动。

## Exact Files Changed

### `packages/opencode/script/build-node.ts`

Commit: `7a80635`

Status: ADDED

Why: Fresh clone 中缺少该文件，但 `packages/desktop/scripts/predev.ts` 和 `packages/desktop/scripts/prebuild.ts` 明确执行 `bun script/build-node.ts`。

What changed:

- 恢复 Bun Node bundle build script。
- `entrypoints` 使用 `./src/node.ts`，不再使用手写的 `script/server-entry.ts`。
- 输出目录为 `./dist/node`，构建目标为 `node`，格式为 `esm`，生成 linked sourcemap。
- 保留 `jsonc-parser` 和 `@lydell/node-pty` external。
- 注入 `OPENCODE_MODELS_DEV`、`OPENCODE_VERSION`、`OPENCODE_CHANNEL`。
- 通过 `files` 写入 `opencode-web-ui.gen.ts` 空 stub。
- 因 `packages/opencode/.gitignore` 的 `script/build-*.ts` 规则会忽略该文件，提交时使用了针对单文件的 `git add -f`；没有修改整个忽略规则。

Expected behavior: build 后 `packages/opencode/dist/node/node.js` 应导出 `Config`、`Database`、`Server`、`bootstrap`，且 `Server.listen` 应为函数。

Verified: Git-tracked = YES；Desktop typecheck 间接通过仓库配置检查。

Not verified: 真实 Bun build、Node import、Bun import。

### `packages/desktop/src/main/server-contract.ts`

Commit: `24215b4`

Status: ADDED

Why: 在调用 `Server.listen` 前提供明确的 embedded server export contract 检查。

What changed:

- 新增 `assertServerExport(serverModule)`。
- 当 `module.Server` 不存在，或 `typeof module.Server.listen !== "function"` 时抛出明确错误。
- 错误包含 `Object.keys(serverModule)`，格式为 `virtual:opencode-server export contract invalid; exports=...`。

Expected behavior: export shape 错误不再表现为模糊的 `undefined.listen`。

Verified: Desktop typecheck = PASS；纯函数 guard test 文件已加入。

Not verified: 真实 `dist/node/node.js` export contract。

### `packages/desktop/src/main/server-contract.test.ts`

Commit: `24215b4`

Status: ADDED

Why: 覆盖 guard 的最小行为边界。

What changed:

- 验证缺少 `Server` 时抛出包含实际 exports 的错误。
- 验证存在 `Server.listen` 函数时不抛错。

Verified: 文件已加入 Git；未能执行 Bun test，因为本机 Bun 可执行文件缺失。

Important boundary: 该测试只证明 `assertServerExport` 纯函数，不证明真实 Node bundle 导出了 `Server.listen`。

### `packages/desktop/src/main/sidecar.ts`

Commit: `24215b4`

Status: MODIFIED

Before:

```ts
const { Server } = await import("virtual:opencode-server")
listener = await Server.listen(...)
```

After:

```ts
const serverModule = await import("virtual:opencode-server")
assertServerExport(serverModule)
const Server = serverModule.Server
listener = await Server.listen(...)
```

Why: 让 sidecar 在 export contract 损坏时报告实际 module exports，而不是把 `Server` 为 undefined 的错误延迟到 `.listen` 属性访问。

Verified: Desktop typecheck = PASS。

Not verified: 真实 sidecar runtime、server ready、renderer load。

### Documentation files

Commit: `0480c8f`

Status: MODIFIED

Files:

- `docs/context-checkpoint.md`
- `docs/handoff.md`
- `docs/change-log.md`

What changed: 记录恢复分支、canonical build entry、export guard、Bun 缺失阻塞、未完成的 Node/Bun/Desktop/runtime 验收和下一步；没有修改 UI 或运行时代码。

## Tests

| Command | Result | Evidence / boundary |
|---|---|---|
| `node node_modules/@typescript/native-preview/bin/tsgo.js -b packages/desktop/tsconfig.json` | PASS | Desktop typecheck exit code 0。 |
| `node node_modules/prettier/bin/prettier.cjs --write packages/opencode/script/build-node.ts packages/desktop/src/main/sidecar.ts packages/desktop/src/main/server-contract.ts packages/desktop/src/main/server-contract.test.ts` | PASS | 目标文件格式化完成。 |
| `git diff --check` | PASS | 无 whitespace 错误。 |
| `bun --version` | OPEN | `D:\npm-global\bun.ps1` 存在，但目标 `D:\npm-global\node_modules\bun\bin\bun.exe` 不存在；没有可记录的 Bun 版本。 |
| `cd D:\hscode-new\packages\opencode; bun script/build-node.ts` | OPEN | 被缺失的 `bun.exe` shim 阻塞，真实 build 未执行。 |
| `node -e "import('./packages/opencode/dist/node/node.js')..."` | FAIL / OLD ARTIFACT INVALID | 现有旧 bundle 报 `SyntaxError: Unexpected identifier '_'`；没有把旧产物当作新 build 结果。 |
| `node node_modules/@typescript/native-preview/bin/tsgo.js -p packages/opencode/tsconfig.json --noEmit` | OPEN | 长时间无输出后停止；未作为通过处理。 |
| `bun test packages/desktop/src/main/server-contract.test.ts` | OPEN | Bun runtime 不可用，测试没有执行。 |

## Runtime Evidence

Current startup: FAIL / OPEN

User-visible error: `Cannot read properties of undefined (reading 'listen')`

Sidecar: OPEN — 未使用新 build 产物启动验证。

Server ready: OPEN

Renderer: OPEN

Real bundle export: OPEN — 必须先用 canonical `build-node.ts` 重建，再检查 `Object.keys(module)` 和 `typeof module.Server?.listen`。

Do not claim: FIXED。当前只能确认代码恢复方向和 contract guard 已提交，不能声称 HSCode 已经启动恢复。

## Environment / Dependency Changes

- Bun: 当前机器只有 shim，`bun.exe` 缺失；版本 UNKNOWN。
- `bun install`: NO。
- Electron reinstall: NO。
- `node_modules` deleted: NO。
- Vite cache cleared: NO。
- `rm -rf`: NO。
- `git clean`: NO。
- `git reset --hard`: NO。
- Force push: NO。
- Random dependency additions: NO。
- `node-fetch`: KEPT；它是基线 `e012402` 已存在的依赖，本轮没有修改。
- `server-entry.ts`: KEPT pending real build verification；canonical build script 已不再引用它。
- `opencode-web-ui.gen.ts`: KEPT pending real build verification；源码 `packages/opencode/src/server/shared/ui.ts` 仍引用该模块。

## Commits

| Commit | Purpose | Runtime verified? |
|---|---|---|
| [`7a80635`](https://github.com/kaijiHou/hscode-desktop/commit/7a806352b085c6f029b1338e6f95fa377d6dfec7) | restore `packages/opencode/script/build-node.ts` | NO |
| [`24215b4`](https://github.com/kaijiHou/hscode-desktop/commit/24215b4f1a143ab228f6d4ec06b62e493a9c26c7) | add `Server.listen` export contract guard and focused test | NO |
| [`0480c8f`](https://github.com/kaijiHou/hscode-desktop/commit/0480c8f5d310b89a02963d94f63528550d04709f) | record recovery docs | N/A |

## Known Open Items

1. 恢复或找到正确的 pinned Bun runtime。
2. 运行 canonical `build-node.ts`。
3. 检查 `dist/node/node.js` exports。
4. Node 下验证 `typeof Server.listen === "function"`。
5. Bun 下验证 `typeof Server.listen === "function"`。
6. Desktop build。
7. Electron start。
8. Sidecar ready。
9. Server ready。
10. Renderer load。
11. Fresh-clone reproducibility。

## ONE Exact Next Action

恢复/使用正确的 pinned Bun runtime，然后执行：

```powershell
cd D:\hscode-new\packages\opencode
bun script/build-node.ts
```
