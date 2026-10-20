$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-env.ps1')
$previewDesktop = Join-Path $previewRepo 'packages/desktop'
$previewExe = Join-Path $previewDesktop 'node_modules/electron/dist/electron.exe'
foreach ($required in @($previewExe, (Join-Path $previewDesktop 'out/main/index.js'), (Join-Path $previewDesktop 'resources/opencode-cli.exe'))) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Missing local preview build: $required" }
}
$env:ELECTRON_RUN_AS_NODE = $null
# This local preview must not inherit model API keys from the developer's machine.
Get-ChildItem Env: | Where-Object Name -Match '(^|_)API_KEY$' | ForEach-Object {
    Remove-Item -LiteralPath ('Env:' + $_.Name)
}
Start-Process -FilePath $previewExe -ArgumentList ('"{0}"' -f $previewDesktop) -WorkingDirectory $previewDesktop -WindowStyle Normal
