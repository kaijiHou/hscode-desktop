# HSCode Phase 2A.5 — Closure Before Provider Connection Tests

## HEAD

- branch: master
- local: 470acb0
- origin/master: 470acb0

## Model UI

| Item | Status |
|---|---|
| OpenCode Go | PASS |
| DeepSeek | PASS |
| Custom Model | PASS |
| Custom classification | PASS (OpenAI/Anthropic no longer misclassified) |
| DeepSeek Test Connection | **DEFERRED** — user requested final credential phase later |
| Self-hosted Test Connection | **DEFERRED** — user requested final connection-validation phase later |

## Network

| Item | Status |
|---|---|
| Terminal | Network | text buttons | PASS |
| Active session state | PASS |
| Panel open | PASS (requires active session) |
| Start/Stop | SKIPPED — administrator privilege unavailable |
| Packet List | SKIPPED — administrator privilege unavailable |
| Packet Detail | SKIPPED — administrator privilege unavailable |
| HEX/ASCII | SKIPPED — administrator privilege unavailable |
| Filter | SKIPPED — administrator privilege unavailable |
| Bounded buffer | PASS (5000 packet limit in code) |

## Default Project

| Item | Status |
|---|---|
| Reproduced | NO (not on current HEAD) |
| Actual error | N/A |
| Root cause | Likely resolved by catalog restoration + models.dev snapshot |
| Fix | OPENCODE_DISABLE_MODELS_FETCH restored, catalog bundled |
| 3-run validation | PASS (start/refresh/restart all clean) |

## Privacy

| Item | Status |
|---|---|
| Passive models fetch | DISABLED (OPENCODE_DISABLE_MODELS_FETCH=true) |
| 60-min refresh | DISABLED |
| User-triggered requests | ALLOWED |

## Commits (this session)

| Hash | Message |
|---|---|
| 470acb0 | feat(network-ui): add Terminal | Network text buttons to V2Actions |
| 81bc77e | fix(models): remove misclassified customModels filter |
| 700aa67 | fix(ui): add copyright to app root layout bottom |
| 8c11468 | fix(ui): move copyright to app root layout bottom |
| 4e768cc | fix(models-ui): fix providers.all() type + fix titlebar JSX |
| 6cb1cd7 | fix(models-ui): use providers.all() for DeepSeek visibility |
| e80c207 | fix(models-ui): rewrite unpaid selector to show 3 primary entries |

## Deferred Items

- DeepSeek Test Connection —留到下一轮 Provider Connection Finalization
- Self-hosted Test Connection —留到下一轮 Provider Connection Finalization
- EXE Packaging —留到模型和 Network 都稳定后单独处理

## Known Issues

- Network panel only renders when in an active session (by design)
- V2Actions Terminal|Network buttons only visible when isDesktop() is true
- Free models section shows even when no free models available (minor UI issue)

---

## CHANGE-023 Handoff (2026-08-26) — WinDivert Dev Runtime + Live Capture Closure

### What landed
- `networkResourcesDir()` unified helper (resources.ts): dev → packages/desktop/resources, packaged → process.resourcesPath
- Native bridge init errors surfaced: structured log + `setNativeBridgeError()` + real root cause in renderer (Chinese mapping via `networkErrorText()`)
- Light-theme buttons fixed: ButtonV2 replaces hardcoded dark inline styles
- capture-worker: separate rollup entry (`out/main/capture-worker.js`) + static import of ./native
- GetLastError via koffi prototype form — real win32 codes (e.g. 87 on bad filter)
- network-start IPC defensive re-validation; empty filter explicitly allowed

### First REAL live capture (admin-mode dev)
click 开始抓包 → capturing → packetCount=1910 → match row
`→ 10.1.224.6:54427 → 10.199.194.75:8080 TCP 52` → stop stable → clear=0.
Screenshots: artifacts/runtime/network-live-{capturing,packets}.png, network-buttons-{light,dark}.png

### Tests
desktop network 71/0 · app network 10/0 · typecheck exit=0 (both).
App-wide 12 pre-existing failures (server-session/i18n/deep-links) confirmed on HEAD via stash.

### Dev-run-as-admin note
Desktop launcher: `D:\Desktop\HSCode-管理员启动.bat` → pwsh7 self-elevating ps1.
WinDivert requires admin; non-admin now shows 中文提示 instead of raw error.
Verification scripts kept in scripts/: live-capture-verify.cjs, theme-buttons-shot.cjs.

## Known Issues (updated)

- Network panel only renders when in an active session (by design)
- V2Actions Terminal|Network buttons only visible when isDesktop() is true
- Free models section shows even when no free models available (minor UI issue)
- App-wide test suite has 12 pre-existing failures (server-session/i18n/deep-links) unrelated to network work
- Non-admin capture start surfaces ADMIN_REQUIRED Chinese hint; live capture requires admin relaunch

## CHANGE-024 Handoff (2026-09-02) — PowerShell 5.1 黑块（PSReadLine ECH）

### What landed
- `packages/core/src/shell.ts`: `LEGACY_POWERSHELL_COMPAT_CMD` + pure
  `legacyPowerShellCompatArgs(command)` (legacy powershell.exe only;
  pwsh/cmd/bash → undefined).
- `packages/core/src/pty.ts`: spawn init args now via that function; old
  inline EncodedCommand (DECSCUSR + Selection color) removed.
- New unit test `packages/core/test/pty/psreadline-compat.test.ts` (8 cases).
- Diagnostic evidence committed: `scripts/psreadline-capture.ts`,
  `docs/psreadline-capture-*.txt` (byte-level), `docs/psreadline-diag/`
  (CDP probe scripts + initial screenshot).

### Root cause (byte-level)
Black block = PSReadLine ECH (ESC[nX) erase-fill growing with line length;
NO SGR-40 black-background escape anywhere. PSReadLine 2.3.5 (bundled) still
emits the same ECH → upgrade path dead. Only proven fix: session-local
Remove-Module PSReadLine (host falls back to built-in line editor, no ECH).
Scope: spawned PTY session only; user's machine/$PROFILE/module store untouched.
Cost: legacy powershell.exe session loses PSReadLine history-editing/highlight.

### Deviation from task assumption
Task assumed "upgrade PSReadLine ≥2.0.3 fixes it" — disproven by capture-D
(2.3.5 still emits ECH). Fix changed to session-local module removal.

### Verification status
- VERIFIED: unit 8/8, typecheck exit 0, byte-level captures (A/B/C/D, run1/run2).
- IMPLEMENTED BUT NOT VERIFIED: in-app real space-mashing canvas pixel scan
  (`docs/psreadline-diag/cdp_scan2.py` ready, not yet executed) — user manual
  confirmation or follow-up run pending.

### Notes / known issues
- CDP toggling the terminal panel repeatedly triggers "PTY session not found"
  dispose-race logs (size-sync on already-disposed PTY) — pre-existing, not
  introduced by this change.
- vision_analyze: user re-enabled image analysis 2026-09-02 ("你可以看图");
  local custom:local model (qwen3.8-27b) still rejects image input (500),
  so screenshots must be delivered to the user via MEDIA: for human review.
