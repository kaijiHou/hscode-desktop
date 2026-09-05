# HSCode Developer Agent Workbench — Current Handoff

Updated: 2026-09-05

## Repository state

- Repo: `D:/hscode`
- Branch: `p0/pwsh-default`
- HEAD: `8e95cc46961af76689211a08f0a88510dbca0105`
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
