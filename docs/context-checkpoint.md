# HSCode Context Checkpoint

Current branch: `p0/pwsh-default`
Current HEAD: `8e95cc46961af76689211a08f0a88510dbca0105`
Base: `c06f87519204f26e34b56761e1b18ae523c3dcbc`
Current objective: preserve the completed Agent Feed redesign, land the sidecar spawn-ordering fix, and close the desktop runtime acceptance.

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

Updated 2026-09-05 with a live narrow diagnosis (see `packages/desktop/probe-sidecar.cjs`, `probe-sidecar-echo.cjs`, `probe-echo-sidecar.mjs`):

- Sidecar spawn: **PASS**. Electron starts with `ELECTRON_EXEC_PATH` pointed at the desktop Electron 42 binary; `utilityProcess.fork(out/main/sidecar.js)` spawns and the `spawn` event fires.
- Startup message ordering (`8e95cc4` helper): **PASS**. `sendSidecarStartOnSpawn` posts the `{type:"start"}` message exactly once on spawn; a standalone probe confirms `postMessage` fires (`startSent: true`).
- Message pipeline: **PASS**. A minimal ESM echo sidecar under the same Electron receives the start message on spawn and replies over `parentPort`, so utilityProcess ESM entries and parentPort messaging work.
- Sidecar ready: **FAIL (root cause narrowed)**. Inside the utility process, the dynamic import of the bundled server chunk `out/main/chunks/node-C5I0Aot4.js` (34 MB, built by electron-vite from `virtual:opencode-server`) never resolves and never throws: the sidecar logs `start received, importing server chunk…` and then goes silent with no stdout/stderr, no ready, no error. The app's 60s stall guard then fails initialization and kills the sidecar (reported as `sidecar exited { code: 0 }`).
- This is a different failure from the pre-`8e95cc4` one: the start message now arrives; the hang is in the ESM chunk import step that follows. Root-causing electron-vite's chunk import inside utilityProcess is a NEW investigation and is deliberately not started.
- PowerShell 7 default, clean startup, dark PowerShell palette, Settings layout, stale-session recovery, Agent Feed desktop screenshots: **OPEN** — the renderer cannot pass `await-initialization` until the sidecar becomes ready.
- Bun tests: **PASS** via `D:\bun-bin\bun.exe` (the global `D:\npm-global\bun` shim is still broken). `sidecar-start.test.ts` 1 pass; core `test/pty/args.test.ts` 3 pass.

## git status --short

Working tree contains only existing untracked diagnostic files; no tracked work is pending from this phase.

## Not finished

- Root-cause why `import("./chunks/node-C5I0Aot4.js")` hangs inside the Electron utilityProcess (ESM chunk loaded via electron-vite; no `.node` natives in the chunk; `node:sqlite` builtin is used and should exist in Electron 42's Node). Do NOT expand this into a broad investigation — one candidate at a time (e.g. try `build.rollupOptions.output.inlineDynamicImports` for the sidecar entry, or test the same chunk under `node --experimental-sqlite`).
- Once the sidecar becomes ready: run the full desktop runtime acceptance in `docs/handoff.md` (fresh terminal, PowerShell 7, Settings, stale-session, Agent Feed screenshots at 1366/1600/1920).
- Keep this checkpoint and `docs/handoff.md` current if runtime evidence changes.

## ONE exact next action

If the desktop window becomes accessible after an external environment repair, close old PTY tabs and perform the narrow fresh-terminal check described in `docs/handoff.md`; otherwise leave the runtime statuses OPEN.

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
