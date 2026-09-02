#!/bin/bash
# Check for vite pre-bundle cache
echo "=== Checking .vite directories ==="
ls -la /d/hscode/packages/app/node_modules/.vite/ 2>/dev/null || echo "No .vite in app/node_modules"
ls -la /d/hscode/packages/desktop/node_modules/.vite/ 2>/dev/null || echo "No .vite in desktop/node_modules"
echo ""
echo "=== Checking for ghostty-web in pre-bundle ==="
find /d/hscode/packages -path "*vite*ghostty*" -type f 2>/dev/null | head -5
echo ""
echo "=== Checking dist file modification time ==="
ls -la /d/hscode/packages/app/node_modules/ghostty-web/dist/ghostty-web.js
echo ""
echo "=== Checking if clipPath is still in the file ==="
grep -c "clipPath" /d/hscode/packages/app/node_modules/ghostty-web/dist/ghostty-web.js || echo "clipPath count: 0"
grep -c "clip-path removed by HSCode" /d/hscode/packages/app/node_modules/ghostty-web/dist/ghostty-web.js || echo "HSCode patch count: 0"
