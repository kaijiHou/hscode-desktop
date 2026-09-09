# HSCode Developer Agent Workbench — Current Handoff

Updated: 2026-09-08

## Current fresh-clone recovery

- Repository: `D:/hscode-new`
- Branch: `recovery/fresh-clone-server-start`
- HEAD: `24215b4`
- Recovery commits: `7a80635`, `24215b4`
- Goal: restore canonical `packages/opencode/script/build-node.ts`, build from `packages/opencode/src/node.ts`, and verify the embedded `Server.listen` contract before starting Electron.
- `build-node.ts` is Git-tracked despite `packages/opencode/.gitignore` matching `script/build-*.ts`.
- Sidecar now validates `virtual:opencode-server` and reports its actual export names when `Server.listen` is absent.
- Desktop typecheck and formatting checks pass.
- Real build/runtime verification is OPEN because this machine has only a broken `D:/npm-global/bun` shim; the referenced `bun.exe` is missing. No Bun replacement or dependency reinstall was attempted.
- The existing `packages/opencode/dist/node/node.js` fails a Node import with `SyntaxError: Unexpected identifier '_'`; it is not accepted as a valid rebuilt bundle.

### Exact next action

Restore/use the pinned Bun runtime, run `cd D:/hscode-new/packages/opencode && bun script/build-node.ts`, then verify `Config`, `Database`, `Server`, `bootstrap`, and `typeof Server.listen === "function"` under Node and Bun. Only after that build Desktop and launch Electron.

### Preserve

- Keep `server-entry.ts` and `opencode-web-ui.gen.ts` until the real build has passed and their necessity is confirmed.
- Do not delete `D:/hscode-new`, `node_modules`, or `packages`.
- Do not run recursive deletion, `git clean`, `git reset --hard`, force push, `bun install`, Electron reinstall, or random dependency additions.
- Do not continue UI, Sidebar, model, Network, or Terminal work in this recovery.

## Historical repository state

- Repo: `D:/hscode`
- Branch: `ui/workbench-visual-correction-v2` (active UI branch; runtime base `p0/pwsh-default@1ac5aef`)
- HEAD: Workbench Visual V2 — `d5b0c09` (feed/card restructure) + `4d06c0b` (chrome/composer) + docs
- Stable base: `c06f87519204f26e34b56761e1b18ae523c3dcbc`

## Product direction

HSCode is a private desktop Agent Workbench based on OpenCode. Keep the existing Agent, Session, Provider, Network Inspector, terminal resize, and network resize behavior intact while making the visible shell and feed feel like HSCode.

PowerShell strategy remains: PowerShell 7 preferred, PowerShell Terminal fixed dark, Legacy PowerShell available but demoted. Do not spend more time on the historical PowerShell 5.1 black-block root cause.

## Landed in this handoff

### Terminal

- `packages/core/src/pty.ts` no longer injects `ESC[5 q`, `Set-PSReadLineOption`, `Selection = DarkCyan`, `-NoExit`, or `-EncodedCommand` into PowerShell PTYs.
- `buildPtyArgs()` keeps caller arguments unchanged and only adds `-l` for login shells.
- `packages/core/test/pty/args.test.ts` covers clean `pwsh.exe` and `powershell.exe` arguments plus POSIX login handling.
- Sidecar `packages/opencode/dist/node/node.js` was rebuilt and contains the new PTY argument helper.

Commits:

- `cdc76e9 fix(terminal): remove obsolete PowerShell startup injection`
- `3e70b9b test(terminal): cover clean PowerShell PTY args`

### Sidecar startup ordering (`8e95cc4`)

- `packages/desktop/src/main/sidecar-start.ts`: `sendSidecarStartOnSpawn()` registers a one-shot `spawn` listener on the Electron utility process and posts `{type:"start", hostname, port, password, userDataPath}` only from that callback, returning an unsubscribe that removes the listener.
- `packages/desktop/src/main/sidecar-start.test.ts`: covers "no postMessage before spawn" and "postMessage exactly once on spawn".
- `packages/desktop/src/main/server.ts`: the sidecar startup path now uses the spawn-ordered helper, so the previous failure mode (sidecar receiving/losing the start message before it was ready, exiting with code 0) is addressed at the source. Unit tests cover the helper only; the desktop runtime loop still needs live confirmation.

### Workbench Agent Feed

The Agent Feed phase is committed in `4553a25` and is deliberately limited to:

- `packages/app/src/pages/session/timeline/message-timeline.tsx`
  - user messages are presented as a Task block;
  - assistant groups get an `HSCode Agent` identity header once per assistant turn;
  - thinking gets a quiet activity marker;
  - the timeline root is addressable for styling;
  - centered feed rows and the legacy title bar are capped at 920px.
- `packages/app/src/styles/hscode-agent-feed.css`
  - task block signal line;
  - assistant identity header;
  - quiet thinking activity;
  - compact tool activity and terminal-like output surfaces;
  - restrained diff and error treatments.

These changes are real TSX plus CSS; do not replace them with CSS-only selectors or redesign terminal/network mechanics.

## Verification

- App typecheck: PASS using the checked-in bundled TypeScript native preview.
- Core typecheck: PASS using the checked-in bundled TypeScript native preview.
- Prettier and `git diff --check`: PASS.
- Bun tests: PASS via `D:\bun-bin\bun.exe` (global `D:\npm-global\bun` shim still broken; do NOT `bun install` to fix it). `packages/desktop/src/main/sidecar-start.test.ts`: 1 pass. `packages/core/test/pty/args.test.ts`: 3 pass.
- Production renderer build: OPEN due the existing `@effect/platform-node-shared` `node:stream` browser-externalization error. Do not patch dependencies to bypass it in this phase.

### Desktop runtime (narrow diagnosis, 2026-09-05)

Launched with `ELECTRON_EXEC_PATH=D:\hscode\packages\desktop\node_modules\electron\dist\electron.exe` (root electron-vite dependency lacks binary metadata; this override is the documented workaround — the desktop Electron 42 binary works).

- Sidecar spawn + one-shot start message on spawn (`8e95cc4` helper): **working as designed**, proven by `packages/desktop/probe-sidecar.cjs` (`[probe] spawned` → `start message posted on spawn`).
- utilityProcess ESM + parentPort messaging: **working**, proven by `probe-sidecar-echo.cjs` + `probe-echo-sidecar.mjs` (echo round-trip succeeds).
- Sidecar ready: **RESOLVED same day.** The 34 MB chunk was innocent; the Sep 4 `dist/node/node.js` bundle itself was broken — V8 coverage + await tracing showed evaluation stalled at a bun-emitted self-await (`await init_auth2()` inside `src/auth/index.ts`'s own `__esm` init), which deadlocks under Bun 1.4.0, plain Electron-Node, and the utility process alike. **Rebuilding with `bun script/build-node.ts` via `D:\bun-bin\bun.exe` 1.4.0 produces a working per-module-exports bundle** that loads everywhere (verified: `Config, Database, Server, bootstrap` exported; sidecar went ready).
- Live desktop after the rebuild: sidecar spawned, port 401 (listening, auth wall), `server ready { url: http://127.0.0.1:57728 }`, renderer connected, no sidecar exit. Fresh terminal tab (after closing all 7 old ones): **clean banner, dark palette, no injection garbage** — clean-startup and dark-palette checks PASS.
- PowerShell 7 default: **FAIL at process level, cause found** — `~/.config/hscode/opencode.jsonc` pinned `shell` to Windows PowerShell 5.1, overriding the pwsh-first default in `packages/core/src/shell.ts`. Pin removed (backup: `D:\temp\chunk-probe\opencode.jsonc.bak`); needs an app restart + one fresh terminal to confirm `pwsh.exe` (WindowsApps alias) is now the PTY process.
- Settings runtime, stale-session runtime, Agent Feed screenshots at 1366/1600/1920: OPEN, left for the user's manual acceptance pass (GUI automation stopped by user request).

## Exact next actions

1. If the desktop window becomes accessible after an external environment repair, perform one narrow runtime check with all old PTY tabs closed; otherwise keep the runtime statuses OPEN.
2. If runtime evidence changes, record it in `docs/context-checkpoint.md` and this file.

## Preserve

- Existing untracked diagnostic files. They belong to the ongoing investigation and must not be deleted casually.
- Terminal/network resize and reflow behavior.
- Network capture core and native bridge.
- Shell selection logic unless a future runtime check provides direct evidence.
- Agent/session data structures and provider protocol.

## Never do

- Do not merge `p0/psreadline-compat` (`c521235`).
- Do not patch `node_modules` or `.vite/deps`.
- Do not run `bun install`, Electron reinstall, delete `node_modules`, or clear Vite cache.
- Do not continue PSReadLine, Ghostty renderer, cursor, caret, SGR-filter, or Remove-Module root-cause experiments.

## Runtime wording

Until direct evidence exists:

- `PowerShell 7 default: OPEN`
- `black-block root cause: OPEN`
- `black-block product mitigation: PowerShell 7 preferred + fixed dark PowerShell terminal`

Never write that the black-block root cause is fixed based only on static code or Settings labels.

## Workbench Visual V2 (ui branch)

- Commit `d5b0c09`: giant session card removed (flat canvas), duplicate breadcrumb row deleted, sticky Session Context Header (56px hairline, title 14px + project subtitle, 920px column), task block = 2px signal line + flowing 15px text (chip/bubble gone), agent header = Ink Blue 13px name + short tick, thinking/tool rows compact.
- Commit `4d06c0b`: DEV chip demoted to ghost mono indicator, perf overlay opt-in, titlebar tabs are IDE document tabs (active = canvas tone + 2px Ink Blue signal line), composer dock aligned to the feed column (max 960) with 76px resting height.
- Visual acceptance screenshots: `artifacts/ui-redesign/v2/session-{1920,1600,1366}-light.png` + `session-1920.png` (dark). Giant card REMOVED, title duplication gone, feed centered ≤920px.
- Runtime regressions on this branch: composer input/send-enable PASS, terminal open PASS, terminal splitter PASS (450→600 chat / 874→724 terminal; 450 is the clamp min), network open + splitter PASS (600→720). Submit action not drivable by synthetic events in the harness; submit path untouched this round.
- Terminal/PowerShell/sidecar code untouched (work order §3). PowerShell 7 confirm-after-restart remains OPEN from the runtime round.

## Fresh-clone server recovery continuation (2026-09-08)

This continuation is based on `17ae7ec` and the unpushed recovery baseline `a00b23a`.

- `f884436` adds one narrowly scoped Desktop build guard for an Electron-vite 5 false-positive CommonJS shim scan. The scan was inserting code inside a string from the generated server bundle and caused `Unterminated string literal`.
- Bun `1.4.0` at `D:\bun-bin\bun.exe` rebuilt the canonical node bundle successfully.
- Node 24 and Bun both confirmed the real exports and `Server.listen`; both completed an authenticated `/global/health` smoke check with HTTP 200.
- Desktop production build and typecheck passed. Generated main, sidecar, and node chunks parse successfully.
- The full Electron GUI startup remains OPEN: `electron-vite dev` reached main/preload/renderer build and started the renderer dev server, but Electron exited code 1 without stderr in the current Codex terminal session. Do not claim sidecar ready, Desktop server ready, or renderer ready from this run.
- No dependency installation, Electron reinstall, node_modules deletion, Vite cache deletion, or destructive Git operation was performed.

### Next handoff action

Use a normal interactive Windows desktop session to launch the generated Desktop app and capture sidecar spawn, `assertServerExport`, `Server.listen`, local server health, and renderer-ready evidence. If that succeeds, run the fresh-clone reproduction check; otherwise use the first concrete Electron log as the next debugging input.

## Review after d3d3c33 — report correction and Electron acceptance

- The report now starts with a current-status summary so the old historical Bun/build OPEN entries cannot be mistaken for current state.
- `a00b23a` is now documented with its exact files and direct `@lydell/node-pty` dependency rationale. It is a recovery-specific divergence from `master@e012402`; do not remove it before a separate clean-clone audit.
- Root declares Bun `1.3.14`; successful verification used `D:\bun-bin\bun.exe` Bun `1.4.0`. Keep this reproducibility gap OPEN and do not change `packageManager` in this phase.
- A visible Electron 42.3.3 launch of the production output was attempted through a temporary wrapper. The process exited before JavaScript logging, with no stderr and no wrapper log file. No new product code was changed; Electron GUI, utility process, sidecar ready, Electron server ready, renderer, window, and fresh-clone reproduction remain OPEN.
- Do not add another shim or dependency based only on this exit. The next modification requires the first concrete Electron runtime error from a normal interactive desktop session.

### ONE exact next action

Run production Electron 42 from a normal interactive Windows desktop session and capture the first main/utility/sidecar/renderer log before changing code.

## Packaged Electron PASS after d3d3c33

- The current recovery output was rebuilt and packaged as `dist/win-unpacked/HSCode Dev.exe` with Electron 42.3.3.
- Interactive launch is PASS: main process responsive, Node utility process spawned, sidecar connection started, server ready on `127.0.0.1:54439`, renderer running, and HSCode window visible.
- The original `Server.listen` TypeError appeared in the stale 14:13 package but is absent from the rebuilt package, providing a direct before/after runtime comparison.
- The only observed application error is a separate missing `resources/win/WinDivert.dll` Network warning. It is outside the recovery scope; do not mix it into the fresh-clone server-start fix.
- Product code changed in this acceptance run: NONE. CI is still unverified because GitHub reported `statuses=[]`.

### ONE exact next action

Create `D:\hscode-repro-check` only if absent and perform the full recovery-branch fresh-clone verification. Do not delete or reset `D:\hscode-new`.

## Packaged Network Capture runtime PASS

- The visible Network Capture panel initially failed because `WinDivert.dll` was absent from packaged `resources/win`.
- Corrected Windows packaging to copy the tracked WinDivert DLL, driver, and license to that exact runtime directory.
- Runtime then exposed missing `koffi`; moved the already-pinned `koffi@3.1.6` dependency from development to production dependencies.
- Rebuilt package evidence: all three files match source hashes, Koffi native modules are unpacked, and `main.log` reports `native bridge initialized`.
- Do not package from the flattened `packages/desktop/node_modules/electron/dist` directory: it produced an empty `locales` directory and repeatable renderer access violations. The complete cached official Electron 42.3.3 zip produced 55 locales and a responsive window beyond 40 seconds.
- Focused network tests: 20 PASS, 0 FAIL. Desktop main/sidecar/server/renderer/window remains PASS.

Code commit: `8938e58 fix(desktop): package network capture runtime`

### ONE exact next action

Fresh-clone verification at `D:\hscode-repro-check`; CI is still unverified and merge is not yet ready.

## Packaged Dev statistics + installer run (2026-09-09)

- PRE_PACKAGE_HEAD: `1ac115bae690f54e7255ddcf27224f898609d717`.
- Pushed `ca37e36` (shared Dev-channel gate, real stats toggle, compact accessible “开发版” button, hidden initial state) and `1ac115b` (three current HSCode packaging IDs in tests).
- Focused helper 4/4, titlebar 7/7, app typecheck, and builder 7/7 are PASS.
- Packaging/runtime evidence is still pending. Use only a complete official Electron 42.3.3 distribution and reject any package with zero locales.
- Do not touch Network internals unless a new concrete runtime error appears. Fresh Clone OPEN; CI UNVERIFIED; do not merge master.
