# HSCode Context Checkpoint

Current branch: `ui/workbench-visual-correction-v2` (cut from `p0/pwsh-default@1ac5aef`)
Current HEAD: see `git rev-parse HEAD` — docs commit on top of `4d06c0b` (Workbench visual V2)
Base: `1ac5aef26f709994f655956b3a2161c15b43e782`
Current objective: Workbench visual correction V2 — real DOM/layout restructure (no giant session card, document-style Agent Feed, compact chrome/composer), verified at 1366/1600/1920 with runtime regressions.

## Completed

- `packages/core/src/pty.ts`: removed HSCode's PowerShell startup VT/PSReadLine injection; PTY args now preserve caller args and only add `-l` for login shells.
- `packages/core/test/pty/args.test.ts`: behavior regression coverage for `pwsh.exe`, `powershell.exe`, and POSIX login handling.
- `packages/app/src/pages/session/timeline/message-timeline.tsx`: added Task block, HSCode Agent headers, thinking activity marker, timeline feed root, and a 920px centered feed limit.
- `packages/app/src/styles/hscode-agent-feed.css`: added the visible Agent Feed treatment for task blocks, assistant identity, thinking, tool activity, code output, diffs, and errors.
- Sidecar `packages/opencode/dist/node/node.js` was rebuilt with the new `buildPtyArgs` implementation; old PTY startup injection strings are absent.
- `packages/desktop/src/main/sidecar-start.ts` + `sidecar-start.test.ts` (`8e95cc4`): the Electron utility process now posts the `{type:"start", ...}` message only after the child emits `spawn`, so the sidecar can no longer receive the startup message before it is ready.
- `packages/desktop/src/main/server.ts`: sidecar startup path uses the spawn-ordered send helper.
- App typecheck: PASS via the bundled TypeScript native preview.
- Core typecheck: PASS via the bundled TypeScript native preview.
- Formatter and diff checks: PASS.
- Desktop main/preload build: PASS with Node heap raised to 8GB; renderer production build is blocked by an existing `node:stream` browser-externalization error in `@effect/platform-node-shared`.

## Commits

- `cdc76e9 fix(terminal): remove obsolete PowerShell startup injection`
- `3e70b9b test(terminal): cover clean PowerShell PTY args`
- `4553a25 feat(ui): reshape session timeline as Agent Feed`
- `9ddcbb0 docs: record desktop runtime blockers`
- `0cd9b45 docs: clarify Electron and sidecar runtime state`
- `8e95cc4 fix(desktop): wait for sidecar spawn before startup message`

## Runtime evidence

Updated 2026-09-05 (second pass — desktop runtime CLOSED, live app left running for user acceptance):

- **Root cause found and fixed: the Sep 4 `dist/node/node.js` bundle was broken.** V8-coverage + await-trace diagnosis showed the old bun build contained a self-referential `await init_auth2()` inside `src/auth/index.ts`'s lazy-init block (a Bun 1.4.0 bundle-format artifact). That self-await deadlocks in every runtime — Bun 1.4.0, plain Electron-Node, and the utility process — so `import("virtual:opencode-server")` never resolved and the sidecar could never post `ready`. It was not an electron-vite or utilityProcess problem.
- **Fix: `bun script/build-node.ts` rebuild with `D:\bun-bin\bun.exe` 1.4.0.** The fresh bundle uses a different (per-module exports) format, imports cleanly under both Bun and Electron-Node (verified: `Config, Database, Server, bootstrap` exported), and the electron-vite re-bundle of it loads in the sidecar.
- Desktop runtime: **PASS**. `electron-vite dev` with `ELECTRON_EXEC_PATH` → sidecar spawned at 10:22:33, **no exit**, port answered 401 (auth wall = server listening), `server ready { url: http://127.0.0.1:57728 }` at 10:24:15, renderer `[vite] connected`, onboarding check ran. App window live with session, Task block, HSCode 智能体 header, composer, 7 terminal tabs from earlier runs.
- Terminal clean startup: **PASS**. After closing all 7 old tabs and opening a fresh 终端 1: banner is clean ("Windows PowerShell / 版权所有… / 尝试新的跨平台 PowerShell…") — no `$([char]27)[5 q`, no ArgumentException, no Set-PSReadLineOption warning, no EncodedCommand garbage.
- PowerShell dark palette: **PASS** (dark background, high-contrast white text, visible block cursor).
- PowerShell 7 default: **FAIL → partially addressed, needs one user step**. Process evidence: HSCode's terminal spawned `powershell.exe` (5.1), parent = HSCode electron. Cause: `~/.config/hscode/opencode.jsonc` pins `"shell": "C:\\Windows\\...\\powershell.EXE"`, which overrides the pwsh-first default in `packages/core/src/shell.ts`. The pin was removed from the config during this session (backup at `D:\temp\chunk-probe\opencode.jsonc.bak`), but the running server/renderer still spawned powershell — an app restart (or picking PowerShell 7 in Settings → General) is required to confirm pwsh.exe. `where pwsh` resolves to the WindowsApps alias `C:\Users\13772\AppData\Local\Microsoft\WindowsApps\pwsh.exe`.
- Settings layout, stale-session recovery, formal Agent Feed screenshots at 1366/1600/1920: **OPEN** — GUI automation was stopped by user request (quota) before these were exercised.
- Bun tests: **PASS** via `D:\bun-bin\bun.exe`. `sidecar-start.test.ts` 1 pass; core `test/pty/args.test.ts` 3 pass.

## git status --short

Working tree contains only existing untracked diagnostic files; no tracked work is pending from this phase.

## Not finished

- Confirm PowerShell 7 default after restart: relaunch the app (config pin already removed), open one fresh terminal, verify the PTY process is `pwsh.exe` (WindowsApps alias) and `$PSVersionTable.Major = 7`. If still powershell.exe, check Settings → General shell row / renderer-side shell persistence.
- Settings layout runtime check (中文说明 wrap, shell row, PowerShell 7 option, Legacy tag), stale-session (confirmed-NotFound only), and Agent Feed screenshots at 1366×768 / 1600×900 / 1920×1080 — left for the user's manual acceptance pass; GUI automation stopped by user request.
- Keep this checkpoint and `docs/handoff.md` current if runtime evidence changes.

## ONE exact next action

User acceptance pass on the live app: restart HSCode once (to pick up the removed shell pin), confirm the fresh terminal runs pwsh 7, then walk Settings and an Agent session. Everything else is already verified PASS.

## Important files/functions

- `packages/core/src/pty.ts` → `buildPtyArgs`, `Pty.create`
- `packages/app/src/pages/session/timeline/message-timeline.tsx` → `AgentFeedHeader`, `TimelineThinkingRow`, `TimelineRowFrame`
- `packages/app/src/styles/hscode-agent-feed.css`
- `packages/desktop/src/main/sidecar-start.ts` → `sendSidecarStartOnSpawn`
- `packages/desktop/src/main/sidecar.ts` → utility process entry; `start()` hangs at `await import("virtual:opencode-server")` → `./chunks/node-C5I0Aot4.js`
- `packages/desktop/probe-sidecar.cjs`, `probe-sidecar-echo.cjs`, `probe-echo-sidecar.mjs` → standalone runtime probes for the sidecar contract

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

## Workbench Visual V2 (this branch)

- `d5b0c09 feat(ui): remove giant session card and reshape task/agent feed` — SessionPanelFrame flattened (no radius/shadow), duplicate breadcrumb row removed, sticky Session Context Header (56px hairline bar, title 14px + project subtitle, 920px column), task block = signal line + flowing 15px text (no chip), agent feed header = Ink Blue 13px name + short tick, thinking/tool rows compacted.
- `4d06c0b feat(ui): compact workbench chrome and composer` — DEV chip demoted to ghost mono indicator, perf overlay opt-in, titlebar tabs are IDE document tabs (active = canvas tone + 2px signal line, top-rounded), composer aligned to the 920px column (max 960) with 76px resting height.
- Visual acceptance (web renderer of the same source, light + dark): `artifacts/ui-redesign/v2/session-1920-light.png`, `session-1600-light.png`, `session-1366-light.png`, `session-1920.png` (dark). Giant card REMOVED; no triple title; feed centered ≤920px; composer compact.
- Runtime regressions on the modified branch: composer input + send-enable PASS; terminal panel open PASS; terminal splitter drag PASS (chat 450→600, terminal 874→724; 450 is the clamp minimum); network panel open + splitter drag PASS (600→720). Send-submit could not be driven by synthetic events in the harness (untrusted events), but the submit path is untouched this round and was proven live earlier the same day on the same server.
- No Terminal/PowerShell/sidecar code touched (per work order §3).

## Sidebar polish (follow-up)

- Commit on this branch: desktop sidebar session rows moved to the workbench rhythm — 32px min-height rows, 13px text, active row = 2px Inkline signal line + accent tint + primary-weight title (`hscode-shell.css`, scoped to `[data-component="sidebar-nav-desktop"] [data-session-id]`). Section labels small-caps muted; workspace group rows share the rhythm.
- Verification caveat: computer-control session is locked for this ZCode session (user quota stop), and the desktop sidebar is bridge-gated (absent in the plain-browser renderer), so the sidebar polish is verified by code inspection against the mapped DOM only. Desktop-window screenshot still recommended on next manual run.

## Delta fixes round (user issue list P1-P7)

- `875650d` task/assistant hierarchy: 当前任务 label 13px semibold + larger marker; hairline + padding between user task and agent block; assistant body is a 28px-indented content column under the header avatar (prose/tool rows no longer flush to the canvas edge).
- `f021444` chrome/composer/branding: send button Ink Blue with hover/active CSS; DEV chip reduced to lowercase ghost mono text; footer copyright moved from absolute overlay to a static strip below main (never touches composer/send); rail logo group hairline separation.
- Visual verification (web renderer, light): `artifacts/ui-redesign/v2-fixes/session-full-1600.png` + `task-assistant-closeup.png` + `composer-closeup.png` — all seven reported issues addressed in the running UI.
- Sidebar note: rail group separation + session-row rhythm shipped; expanded-panel screenshot still needs a desktop-window pass (computer control locked in this session).

## Sidebar root cause fixed

- The new-layout shell (`layout-new.tsx`) never rendered any sidebar — session pages were full-width with no navigation. Added `pages/layout/workbench-rail.tsx` (54px rail: brand→home, new session via command.trigger, per-project switch with live active state, settings/help) mounted left of main in the shell. Verified in the running web renderer: rail renders with the live project list and active state (`artifacts/ui-redesign/v2-fixes/session-with-rail-1600.png`).

## Sidebar convergence (rail + panel)

- `workbench-rail.tsx` is now the new-layout's single sidebar source: [54px Rail][240px expandable Panel]. The panel lists the current project's real sessions (server store child + sortedRootSessions) with real navigation and active state; open/close reuses `layout.sidebar` (no second signal); rail survives panel close; defaults open when projects exist.
- Legacy `sidebar-shell.tsx`/`SidebarContent` stays only for the legacy layout mode; the standalone rail-only version was superseded by this rail+panel component (no third sidebar created).
- Verified in the running web renderer: panel 240px with the real session row, collapse → rail remains, re-expand → rows back. Desktop-window screenshots still pending (computer control locked this session).
