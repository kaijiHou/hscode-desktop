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
