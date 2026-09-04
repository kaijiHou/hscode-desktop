# HSCode Context Checkpoint

Current branch: `p0/pwsh-default`
Current HEAD: `83af730`
Base: `c06f87519204f26e34b56761e1b18ae523c3dcbc`
Current objective: preserve the completed Agent Feed redesign and keep runtime gaps explicitly tracked.

## Completed

- `packages/core/src/pty.ts`: removed HSCode's PowerShell startup VT/PSReadLine injection; PTY args now preserve caller args and only add `-l` for login shells.
- `packages/core/test/pty/args.test.ts`: behavior regression coverage for `pwsh.exe`, `powershell.exe`, and POSIX login handling.
- `packages/app/src/pages/session/timeline/message-timeline.tsx`: added Task block, HSCode Agent headers, thinking activity marker, timeline feed root, and a 920px centered feed limit.
- `packages/app/src/styles/hscode-agent-feed.css`: added the visible Agent Feed treatment for task blocks, assistant identity, thinking, tool activity, code output, diffs, and errors.
- Sidecar `packages/opencode/dist/node/node.js` was rebuilt with the new `buildPtyArgs` implementation; old PTY startup injection strings are absent.
- App typecheck: PASS via the bundled TypeScript native preview.
- Core typecheck: PASS via the bundled TypeScript native preview.
- Formatter and diff checks: PASS.
- Desktop main/preload build: PASS with Node heap raised to 8GB; renderer production build is blocked by an existing `node:stream` browser-externalization error in `@effect/platform-node-shared`.

## Commits

- `cdc76e9 fix(terminal): remove obsolete PowerShell startup injection`
- `3e70b9b test(terminal): cover clean PowerShell PTY args`
- `4553a25 feat(ui): reshape session timeline as Agent Feed`

## Runtime evidence

- PowerShell 7 default: **OPEN**. The dev renderer server starts, but electron-vite then reports `Error: Electron uninstall` while resolving the local Electron binary, so no desktop window is created and no claim is made about the real `pwsh.exe` process or `$PSVersionTable`.
- Clean startup, dark PowerShell palette, settings layout, and stale-session recovery: **OPEN** for the same reason.
- Bun tests: **OPEN**. The configured `D:\npm-global\bun.ps1` points to a missing Bun executable. No install/reinstall was attempted.

## git status --short

Working tree contains only existing untracked diagnostic files; no tracked work is pending from this phase.

## Not finished

- If the desktop window becomes accessible, perform one narrow runtime check; otherwise keep runtime OPEN.
- Keep this checkpoint and `docs/handoff.md` current if runtime evidence changes.

## ONE exact next action

If the desktop window becomes accessible after an external environment repair, close old PTY tabs and perform the narrow fresh-terminal check described in `docs/handoff.md`; otherwise leave the runtime statuses OPEN.

## Important files/functions

- `packages/core/src/pty.ts` → `buildPtyArgs`, `Pty.create`
- `packages/app/src/pages/session/timeline/message-timeline.tsx` → `AgentFeedHeader`, `TimelineThinkingRow`, `TimelineRowFrame`
- `packages/app/src/styles/hscode-agent-feed.css`

## Known false leads / DO NOT TOUCH

- Do not resume PSReadLine, Ghostty renderer, cursor, caret, SGR-filter, or Remove-Module research.
- Do not patch `node_modules` or `.vite/deps`.
- Do not run `bun install`, Electron reinstall, delete `node_modules`, or clear Vite cache.
- Do not modify terminal/network resize, network capture core, agent/session data structures, or shell selection while finishing this UI phase.

## Environment

- bun install: NO
- Electron reinstall: NO
- node_modules deleted: NO
- Vite cache cleared: NO
- sidecar rebuilt: YES

## Screenshots

- No new runtime screenshots were produced in this continuation because the desktop window was not reliably accessible.
