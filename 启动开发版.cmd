@echo off
setlocal
cd /d "%~dp0packages\desktop"
set "OPENCODE_CHANNEL=dev"
set "ELECTRON_EXEC_PATH=%~dp0packages\desktop\node_modules\electron\dist\electron.exe"
set "NODE_OPTIONS=--max-old-space-size=8192"
rem Bun 1.4.0 is the pinned runtime; do not let the broken global shim win.
set "PATH=D:\bun-bin;%PATH%"
call ".\node_modules\.bin\electron-vite.exe" dev
endlocal
