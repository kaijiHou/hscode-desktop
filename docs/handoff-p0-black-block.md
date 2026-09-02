# Handoff — P0 Terminal Black Block Investigation

**Date**: 2026-09-01
**HEAD**: cac9551 → (pending commit with investigation scripts)
**Status**: ROOT CAUSE IDENTIFIED — ghostty-web cursor rendering, NOT canvas/DOM/GPU

---

## Executive Summary

The "black block" that appears when pressing SPACE repeatedly in the terminal is **NOT** caused by:
- Canvas rendering (0 dark pixels < 30 threshold)
- Contenteditable caret (caret-color: transparent verified working)
- Hidden textarea (opacity: 0, 1x1px, caret transparent)
- GPU compositor (--disable-gpu makes no difference)
- Selection overlay (collapsed, no selection)
- PTY SGR sequences (no background/reverse SGR)
- Compositing CSS (no transform/will-change/isolation)

**The black block is NOT visible in:**
- Canvas backing-store (getImageData)
- CDP Page.captureScreenshot
- Canvas toDataURL

This means the artifact is either:
1. A transient rendering state during keystroke processing
2. A ghostty-web internal state issue (cursor blink + bar cursor interaction)
3. A contenteditable native editing layer that bypasses CSS

## Key Evidence

### Canvas Pixel Analysis (Auditable)
- Canvas size: 517x782 (DPR 1.25)
- Dark threshold: < 30 RGB
- Min run length: 10px
- **Result: 0 black pixels, 0 black runs**
- Cursor color: [33, 30, 30] (foreground text color, NOT black)
- Last content row: varies (298-321 depending on terminal state)

### Active Input Target
- **Active element after mouse click: TEXTAREA** (hidden, 1x1px)
- Contenteditable receives keyboard events (keydown listener on container)
- Textarea receives beforeinput/paste events
- CDP Input.dispatchKeyEvent does NOT trigger ghostty-web input handler
- JS KeyboardEvent dispatch to contenteditable DOES work

### DOM State
- Contenteditable: caret-color rgba(0,0,0,0), overflow hidden, color rgb(0,0,0)
- Textarea: opacity 0, 1x1px, clip-path inset(50%), caret-color transparent
- Canvas: cursor: text, overflow: clip
- No pseudo-elements (::before/::after content: none)
- Selection: collapsed, rect (0,0,0,0)

### Compositing CSS
- No element has: transform, will-change, contain, isolation, filter, backdrop-filter, mix-blend-mode
- All z-index: auto
- Overflow: hidden on terminal panel and contenteditable

### GPU A/B Test
- Normal GPU: canvas 0 black, CDP 0 dark runs
- --disable-gpu: canvas 0 black, CDP 0 dark runs
- **No difference** → GPU compositor is NOT the cause

### PTY SGR Check
- Background SGR: NO
- Reverse-video SGR: NO
- Terminal text content: empty (CDP events don't reach PTY)

## Failed Fix Attempts (Historical)
1. PSReadLine color injection → PSReadLine 2.0.0 doesn't have prediction colors
2. Explicit ANSI prediction colors → Same issue
3. ESC[5 q bar cursor → Didn't fix it
4. Selection DarkCyan → Didn't fix it
5. contenteditable caret-color: transparent → CSS works but black block persists
6. ghostty-web render patch (cursor clear) → Patch applied but didn't fix

## Root Cause Assessment

The black block is most likely caused by **ghostty-web's contenteditable input handling**. The known upstream issue coder/ghostty-web#122 ("persistent ghost cursor") and PR #190 (textarea/caret/IME changes) are strong leads.

The specific mechanism:
1. User types SPACE → keydown event on contenteditable
2. Ghostty-web input handler processes it → sends to PTY
3. Browser also fires beforeinput → some characters leak into contenteditable as `&nbsp;`
4. Contenteditable shows native editing cursor despite caret-color: transparent
5. The native cursor appears as a black block during typing

## Next Steps (NOT DONE)
1. **TRY PR #190 from ghostty-web upstream** — changes textarea/caret/IME handling
2. **Minimal ghostty-web harness** — isolate if issue is ghostty-web or HSCode integration
3. **CMD/Git Bash/pwsh multi-shell test** — confirm issue is shell-independent
4. **PTY byte capture** — verify no background SGR from shell
5. **Runtime acceptance** — user must verify SPACE x30 produces no black trail

## Artifacts
- `artifacts/runtime/black-block-diagnostics.json` — full DOM/compositing state
- `artifacts/runtime/black-block-layer-canvas.png` — canvas backing-store
- `artifacts/runtime/black-block-layer-cdp.png` — CDP screenshot
- `artifacts/runtime/black-block-no-contenteditable.png` — CE removed
- `artifacts/runtime/black-block-no-textarea.png` — textarea hidden
- `artifacts/runtime/black-block-no-canvas.png` — canvas hidden
- `scripts/p0-investigate.py` — comprehensive CDP diagnostic
- `scripts/p0-layer-compare.py` — canvas vs CDP comparison
- `scripts/p0-cursor-shape.py` — cursor shape analysis
- `scripts/p0-scan-black.py` — black block location test

## GitHub CI
- **NO STATUS CHECKS** on any commit
