#!/usr/bin/env python3
"""Patch ghostty-web to fix black block: move textarea to cursor cell + remove clip-path"""
import re

DIST = "D:/hscode/packages/app/node_modules/ghostty-web/dist/ghostty-web.js"

with open(DIST, "r", encoding="utf-8") as f:
    code = f.read()

# === PATCH 1: Remove clip-path from textarea setup ===
# Old: this.textarea.style.clipPath = "inset(50%)",
# Replace with nothing (remove the line)
old_clip = 'this.textarea.style.clipPath = "inset(50%)",'
if old_clip in code:
    code = code.replace(old_clip, '// clip-path removed by HSCode fix (PR #190 equivalent)')
    print("PATCH 1: Removed clip-path from textarea")
else:
    print("PATCH 1: SKIP - clip-path not found")

# === PATCH 2: In render loop, position textarea at cursor cell ===
# The render loop is in startRenderLoop():
#   this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);
#   const g = this.wasmTerm.getCursor();
# We need to add textarea positioning after the render call

old_render_loop = '''        this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);
        const g = this.wasmTerm.getCursor();
        g.y !== this.lastCursorY && (this.lastCursorY = g.y, this.cursorMoveEmitter.fire()), this.animationFrameId = requestAnimationFrame(A);'''

new_render_loop = '''        this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);
        const g = this.wasmTerm.getCursor();
        // HSCode fix: track textarea to cursor cell (PR #190 equivalent)
        if (this.textarea && this.renderer) {
          const metrics = this.renderer.getMetrics();
          const canvasRect = this.canvas.getBoundingClientRect();
          const taX = canvasRect.left + g.x * metrics.width;
          const taY = canvasRect.top + g.y * metrics.height;
          this.textarea.style.left = taX + 'px';
          this.textarea.style.top = taY + 'px';
          this.textarea.style.width = metrics.width + 'px';
          this.textarea.style.height = metrics.height + 'px';
        }
        g.y !== this.lastCursorY && (this.lastCursorY = g.y, this.cursorMoveEmitter.fire()), this.animationFrameId = requestAnimationFrame(A);'''

if old_render_loop in code:
    code = code.replace(old_render_loop, new_render_loop)
    print("PATCH 2: Added textarea cursor tracking in render loop")
else:
    print("PATCH 2: SKIP - render loop pattern not found")

# === PATCH 3: Make textarea caret truly invisible ===
# Add color: transparent to textarea setup (in addition to caret-color from CSS)
old_ta_color = 'this.textarea.style.resize = "none",'
new_ta_color = 'this.textarea.style.resize = "none", this.textarea.style.color = "transparent",'
if old_ta_color in code and new_ta_color not in code:
    code = code.replace(old_ta_color, new_ta_color)
    print("PATCH 3: Added color: transparent to textarea")
else:
    print("PATCH 3: SKIP - already patched or pattern not found")

# === PATCH 4: Set caret-color on textarea inline ===
old_ta_border = 'this.textarea.style.border = "none",'
new_ta_border = 'this.textarea.style.border = "none", this.textarea.style.caretColor = "transparent",'
if old_ta_border in code and new_ta_border not in code:
    code = code.replace(old_ta_border, new_ta_border)
    print("PATCH 4: Added caret-color: transparent inline on textarea")
else:
    print("PATCH 4: SKIP - already patched or pattern not found")

with open(DIST, "w", encoding="utf-8") as f:
    f.write(code)

print("\nAll patches applied. File size:", len(code))
