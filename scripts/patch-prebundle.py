#!/usr/bin/env python3
"""Patch ghostty-web pre-bundle to fix black block"""
import re

DIST = "D:/hscode/packages/desktop/node_modules/.vite/deps/ghostty-web.js"

with open(DIST, "r", encoding="utf-8") as f:
    code = f.read()

# PATCH 1: Remove clip-path
old = 'this.textarea.style.clipPath = "inset(50%)",'
if old in code:
    code = code.replace(old, '// clip-path removed by HSCode fix')
    print("PATCH 1: Removed clip-path")

# PATCH 2: Add textarea cursor tracking in render loop
old_render = 'this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);\n        const g = this.wasmTerm.getCursor();'
new_render = '''this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);
        const g = this.wasmTerm.getCursor();
        // HSCode fix: track textarea to cursor cell (PR #190)
        if (this.textarea && this.renderer) {
          const metrics = this.renderer.getMetrics();
          const canvasRect = this.canvas.getBoundingClientRect();
          this.textarea.style.left = (canvasRect.left + g.x * metrics.width) + 'px';
          this.textarea.style.top = (canvasRect.top + g.y * metrics.height) + 'px';
          this.textarea.style.width = metrics.width + 'px';
          this.textarea.style.height = metrics.height + 'px';
        }'''
if old_render in code:
    code = code.replace(old_render, new_render)
    print("PATCH 2: Added textarea cursor tracking")
else:
    print("PATCH 2: Pattern not found, trying alt...")
    # Try without newline
    old_render2 = 'this.renderer.render(this.wasmTerm, !1, this.viewportY, this, this.scrollbarOpacity);'
    if old_render2 in code:
        # Find the getCursor line after it
        idx = code.find(old_render2)
        end = code.find('const g = this.wasmTerm.getCursor();', idx)
        if end > 0:
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
            code = code[:end] + insert + '\n        ' + code[end:]
            print("PATCH 2: Added textarea cursor tracking (alt)")

# PATCH 3: Add color: transparent to textarea
old_resize = 'this.textarea.style.resize = "none",'
new_resize = 'this.textarea.style.resize = "none", this.textarea.style.color = "transparent", this.textarea.style.caretColor = "transparent",'
if old_resize in code and new_resize not in code:
    code = code.replace(old_resize, new_resize)
    print("PATCH 3: Added color + caretColor transparent")

with open(DIST, "w", encoding="utf-8") as f:
    f.write(code)

# Also patch the .map file - remove it to avoid source map issues
import os
mapfile = DIST + ".map"
if os.path.exists(mapfile):
    os.remove(mapfile)
    print("Removed .map file")

print("Done. File size:", len(code))
