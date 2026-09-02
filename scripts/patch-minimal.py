#!/usr/bin/env python3
"""Minimal safe patch: make textarea invisible without touching render loop"""
DIST = "D:/hscode/packages/desktop/node_modules/.vite/deps/ghostty-web.js"
SRC = "D:/hscode/packages/app/node_modules/ghostty-web/dist/ghostty-web.js"

# Patch SOURCE first
with open(SRC, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Remove clip-path
old1 = 'this.textarea.style.clipPath = "inset(50%)",'
new1 = 'this.textarea.style.clipPath = "none",'
if old1 in code:
    code = code.replace(old1, new1)
    print("SRC PATCH 1: clip-path inset(50%) -> none")

# 2. Make textarea 0x0 instead of 1x1
old2 = 'this.textarea.style.width = "1px", this.textarea.style.height = "1px", this.textarea.style.padding = "0"'
new2 = 'this.textarea.style.width = "0px", this.textarea.style.height = "0px", this.textarea.style.padding = "0"'
if old2 in code:
    code = code.replace(old2, new2)
    print("SRC PATCH 2: textarea 1x1 -> 0x0")

with open(SRC, "w", encoding="utf-8") as f:
    f.write(code)
print("SRC saved")

# Now let vite create the pre-bundle from patched source
# We'll patch the pre-bundle after vite starts
print("Done with source. Vite will create pre-bundle on next start.")
