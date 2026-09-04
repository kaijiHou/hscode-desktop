# HSCode Developer Agent Workbench — Current Handoff

Updated: 2026-09-04

## Repository state

- Repo: `D:/hscode`
- Branch: `p0/pwsh-default`
- HEAD: `83af730`
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
- Bun tests: OPEN because `D:/npm-global/bun.ps1` points to a missing executable. Do not run `bun install` to repair it.
- PowerShell 7 default: OPEN. Main/preload dev build succeeds and the renderer dev server starts, but electron-vite reports `Error: Electron uninstall` while resolving the local Electron binary; no desktop window is created. Do not claim PASS without `pwsh.exe` in the PTY/process evidence and `PSVersion.Major = 7`.
- Production renderer build: OPEN due the existing `@effect/platform-node-shared` `node:stream` browser-externalization error. Do not patch dependencies to bypass it in this phase.
- Clean startup, dark PowerShell palette, Settings layout, and stale-session recovery: OPEN pending a reliable fresh desktop window.

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
