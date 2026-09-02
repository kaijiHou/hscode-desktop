#!/usr/bin/env python3
"""Patch render loop in pre-bundle"""
DIST = "D:/hscode/packages/desktop/node_modules/.vite/deps/ghostty-web.js"

with open(DIST, "r", encoding="utf-8") as f:
    code = f.read()

old = '''        this.renderer.render(this.wasmTerm, false, this.viewportY, this, this.scrollbarOpacity);
        const g = this.wasmTerm.getCursor();
        g.y !== this.lastCursorY && (this.lastCursorY = g.y, this.cursorMoveEmitter.fire()), this.animationFrameId = requestAnimationFrame(A);'''

new = '''        this.renderer.render(this.wasmTerm, false, this.viewportY, this, this.scrollbarOpacity);
        const g = this.wasmTerm.getCursor();
        // HSCode fix: track textarea to cursor cell (PR #190)
        if (this.textarea && this.renderer) {
          const metrics = this.renderer.getMetrics();
          const canvasRect = this.canvas.getBoundingClientRect();
          this.textarea.style.left = (canvasRect.left + g.x * metrics.width) + 'px';
          this.textarea.style.top = (canvasRect.top + g.y * metrics.height) + 'px';
          this.textarea.style.width = metrics.width + 'px';
          this.textarea.style.height = metrics.height + 'px';
        }
        g.y !== this.lastCursorY && (this.lastCursorY = g.y, this.cursorMoveEmitter.fire()), this.animationFrameId = requestAnimationFrame(A);'''

if old in code:
    code = code.replace(old, new)
    print("PATCHED render loop")
else:
    print("PATTERN NOT FOUND")
    # Try finding the lines separately
    line1 = 'this.renderer.render(this.wasmTerm, false, this.viewportY, this, this.scrollbarOpacity);'
    line2 = 'const g = this.wasmTerm.getCursor();'
    idx1 = code.find(line1, 3200)  # start near startRenderLoop
    idx2 = code.find(line2, idx1) if idx1 >= 0 else -1
    if idx1 >= 0 and idx2 >= 0:
        insert = '''
        // HSCode fix: track textarea to cursor cell (PR #190)
        if (this.textarea && this.renderer) {
          const metrics = this.renderer.getMetrics();
          const canvasRect = this.canvas.getBoundingClientRect();
          const cur = this.wasmTerm.getCursor();
          this.textarea.style.left = (canvasRect.left + cur.x * metrics.width) + 'px';
          this.textarea.style.top = (canvasRect.top + cur.y * metrics.height) + 'px';
          this.textarea.style.width = metrics.width + 'px';
          this.textarea.style.height = metrics.height + 'px';
        }'''
        end = idx2 + len(line2)
        code = code[:end] + insert + code[end:]
        print("PATCHED render loop (alt)")

with open(DIST, "w", encoding="utf-8") as f:
    f.write(code)

# Remove map file
import os
m = DIST + ".map"
if os.path.exists(m):
    os.remove(m)
    print("Removed map file")

print("Done")
