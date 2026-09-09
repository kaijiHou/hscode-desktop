@echo off
setlocal
where pwsh >nul 2>&1
if errorlevel 1 (
  echo PowerShell 7 (pwsh) is required to build HSCode user packages.
  pause
  exit /b 1
)
pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\package-win.ps1"
set "exitCode=%ERRORLEVEL%"
if not "%exitCode%"=="0" pause
exit /b %exitCode%
