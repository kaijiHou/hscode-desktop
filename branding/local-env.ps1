$ErrorActionPreference = 'Stop'
$previewRepo = Split-Path -Parent $PSScriptRoot
$previewLocal = Join-Path $previewRepo '.local'
foreach ($dir in @('temp','cache/bun','cache/npm','cache/electron','cache/electron-builder','cache/node','tools','logs','data')) {
    New-Item -ItemType Directory -Path (Join-Path $previewLocal $dir) -Force | Out-Null
}
$env:TEMP = Join-Path $previewLocal 'temp'
$env:TMP = $env:TEMP
$env:BUN_INSTALL_CACHE_DIR = Join-Path $previewLocal 'cache/bun'
$env:BUN_INSTALL = Join-Path $previewLocal 'tools/bun'
$env:BUN_RUNTIME_TRANSPILER_CACHE_PATH = Join-Path $previewLocal 'cache/bun-transpiler'
$env:npm_config_cache = Join-Path $previewLocal 'cache/npm'
$env:ELECTRON_CACHE = Join-Path $previewLocal 'cache/electron'
$env:ELECTRON_BUILDER_CACHE = Join-Path $previewLocal 'cache/electron-builder'
$env:NODE_COMPILE_CACHE = Join-Path $previewLocal 'cache/node'
$env:XDG_CACHE_HOME = Join-Path $previewLocal 'cache'
$env:XDG_CONFIG_HOME = Join-Path $previewLocal 'data/config'
$env:XDG_DATA_HOME = Join-Path $previewLocal 'data/share'
$env:XDG_STATE_HOME = Join-Path $previewLocal 'data/state'
$env:HSCODE_PREVIEW_HOME = Join-Path $previewLocal 'data'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $previewLocal 'cache/playwright'
$env:HUSKY = '0'
$env:DO_NOT_TRACK = '1'
$env:ASTRO_TELEMETRY_DISABLED = '1'
$env:TURBO_TELEMETRY_DISABLED = '1'
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:SENTRY_AUTH_TOKEN = $null
$env:VITE_SENTRY_DSN = $null
$env:PATH = "$(Join-Path $previewLocal 'tools/bun-windows-x64');$(Join-Path $previewLocal 'tools/node-v24.22.0-win-x64');$env:PATH"
