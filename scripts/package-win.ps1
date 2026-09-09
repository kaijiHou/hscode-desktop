[CmdletBinding()]
param(
  [ValidateSet("dev")]
  [string]$Channel = "dev"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -lt 7) {
  throw "This release script requires PowerShell 7. Start it with pwsh, not powershell.exe."
}

$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$desktopRoot = Join-Path $sourceRoot "packages\desktop"
$opencodeRoot = Join-Path $sourceRoot "packages\opencode"
$releaseRoot = (Resolve-Path (Join-Path $sourceRoot "..\releases")).Path
$distRoot = Join-Path $desktopRoot "dist"
$unpackedRoot = Join-Path $distRoot "win-unpacked"

function Invoke-CheckedTool {
  param(
    [Parameter(Mandatory)] [string]$FilePath,
    [Parameter(Mandatory)] [string[]]$ToolArgs,
    [Parameter(Mandatory)] [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $FilePath @ToolArgs
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($exitCode -ne 0) {
    throw "$FilePath $($ToolArgs -join ' ') failed with exit code $exitCode."
  }
}

$package = Get-Content -Raw (Join-Path $sourceRoot "package.json") | ConvertFrom-Json
$expectedBun = ([string]$package.packageManager) -replace "^bun@", ""
if ($expectedBun -ne "1.4.0") {
  throw "package.json must pin Bun 1.4.0; found '$expectedBun'."
}

$bunExe = "D:\bun-bin\bun.exe"
if (-not (Test-Path -LiteralPath $bunExe -PathType Leaf)) {
  throw "Pinned Bun is missing: $bunExe. Restore the offline Bun backup; do not run bun install."
}
$actualBun = (& $bunExe --version).Trim()
if ($actualBun -ne $expectedBun) {
  throw "Wrong Bun at ${bunExe}: found $actualBun, expected $expectedBun."
}

# Every child process, including scripts that invoke `bun`, sees this exact Bun first.
$env:Path = "$(Split-Path $bunExe);$env:Path"
$env:OPENCODE_CHANNEL = $Channel
$env:NODE_OPTIONS = "--max-old-space-size=8192"
$env:ELECTRON_EXEC_PATH = Join-Path $desktopRoot "node_modules\electron\dist\electron.exe"

foreach ($required in @(
    (Join-Path $sourceRoot "node_modules\.bun"),
    $env:ELECTRON_EXEC_PATH,
    (Join-Path $desktopRoot "node_modules\.bin\electron-vite.exe"),
    (Join-Path $desktopRoot "node_modules\.bin\electron-builder.exe"),
    (Join-Path $desktopRoot "resources\opencode-cli.exe"),
    (Join-Path $desktopRoot "resources\win\WinDivert.dll"),
    (Join-Path $desktopRoot "resources\win\WinDivert64.sys"),
    (Join-Path $desktopRoot "resources\win\WinDivert-LICENSE.txt")
  )) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Required local build input is missing: $required. This script never downloads or reinstalls dependencies."
  }
}

# The old move left junctions behind once. Refuse to build against that stale tree.
$staleLinks = @(
  Get-ChildItem -LiteralPath (Join-Path $sourceRoot "node_modules") -Recurse -Force -Attributes ReparsePoint -ErrorAction SilentlyContinue |
    ForEach-Object {
      $target = ((Get-Item -LiteralPath $_.FullName -Force).Target -join ";")
      if ($target -match "(?i)D:\\hscode-new") { $_.FullName }
    }
)
if ($staleLinks.Count -gt 0) {
  throw "Found $($staleLinks.Count) stale node_modules links to D:\hscode-new. Repair links before building; do not reinstall blindly."
}

$bun = $bunExe
$electronVite = Join-Path $desktopRoot "node_modules\.bin\electron-vite.exe"
$electronBuilder = Join-Path $desktopRoot "node_modules\.bin\electron-builder.exe"

Write-Host "HSCode Windows release: channel=$Channel, Bun=$actualBun, heap=8GB"
Write-Host "1/7 Generate packaging metadata"
Invoke-CheckedTool $bun @("./scripts/copy-metainfo.ts", $Channel) $desktopRoot

Write-Host "2/7 Build the embedded server bundle"
Invoke-CheckedTool $bun @("./script/build-node.ts") $opencodeRoot
$serverBundle = Join-Path $opencodeRoot "dist\node\node.js"
if (-not (Test-Path -LiteralPath $serverBundle)) { throw "Node bundle was not produced: $serverBundle" }
Invoke-CheckedTool $bun @("-e", "import('./dist/node/node.js').then((m) => { if (typeof m.Server?.listen !== 'function') throw new Error('Server.listen export missing'); console.log('Bundle export contract: PASS') })") $opencodeRoot

Write-Host "3/7 Build Electron main, preload, and renderer"
Invoke-CheckedTool $electronVite @("build") $desktopRoot

Write-Host "4/7 Create the Windows installer and complete portable directory"
Invoke-CheckedTool $electronBuilder @("--win", "--config", "electron-builder.config.ts") $desktopRoot

$installer = @(Get-ChildItem -LiteralPath $distRoot -File -Filter "*.exe" | Where-Object { $_.Name -notmatch "uninstaller" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
if ($installer.Count -ne 1) { throw "Expected one Windows installer in $distRoot; found $($installer.Count)." }
$appExe = Join-Path $unpackedRoot "HSCode Dev.exe"
foreach ($required in @(
    $appExe,
    (Join-Path $unpackedRoot "resources\app.asar"),
    (Join-Path $unpackedRoot "resources\win\WinDivert.dll"),
    (Join-Path $unpackedRoot "resources\win\WinDivert64.sys"),
    (Join-Path $unpackedRoot "resources\win\WinDivert-LICENSE.txt")
  )) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Packaged runtime input is missing: $required" }
}
$localeCount = @(Get-ChildItem -LiteralPath (Join-Path $unpackedRoot "locales") -File -Filter "*.pak").Count
if ($localeCount -lt 50) { throw "Electron locales are incomplete: found $localeCount, expected at least 50." }

Write-Host "5/7 Verify the packaged Electron process starts"
$smokeRoot = Join-Path $releaseRoot ".smoke-$PID"
$smokeProcess = $null
try {
  New-Item -ItemType Directory -Path $smokeRoot -Force | Out-Null
  $smokeProcess = Start-Process -FilePath $appExe -ArgumentList @("--user-data-dir=$smokeRoot", "--no-sandbox", "--enable-logging") -PassThru
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    $smokeProcess.Refresh()
    if ($smokeProcess.HasExited) { throw "Packaged Electron exited during startup with code $($smokeProcess.ExitCode)." }
  } while ((Get-Date) -lt $deadline)
  Write-Host "Packaged Electron cold start: PASS"
} finally {
  if ($smokeProcess -and -not $smokeProcess.HasExited) {
    [void]$smokeProcess.CloseMainWindow()
    if (-not $smokeProcess.WaitForExit(5000)) { [void]$smokeProcess.Kill() }
  }
  if (Test-Path -LiteralPath $smokeRoot) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    try {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($smokeRoot, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
    } catch {
      Write-Warning "Could not move smoke data to the Recycle Bin: $smokeRoot"
    }
  }
}

Write-Host "6/7 Stage and validate the two user deliverables"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stageRoot = Join-Path $releaseRoot ".staging-$PID-$stamp"
$historyRoot = Join-Path $sourceRoot "..\backups\releases\$stamp"
$installerStage = Join-Path $stageRoot "HSCode-Dev-安装版-win-x64.exe"
$portableStage = Join-Path $stageRoot "HSCode-Dev-免安装版-win-x64.zip"
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
try {
  Copy-Item -LiteralPath $installer.FullName -Destination $installerStage
  Compress-Archive -Path $unpackedRoot -DestinationPath $portableStage -CompressionLevel Optimal

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($portableStage)
  try {
    $names = @($zip.Entries | ForEach-Object FullName)
    foreach ($requiredEntry in @(
        "win-unpacked/HSCode Dev.exe",
        "win-unpacked/resources/app.asar",
        "win-unpacked/resources/win/WinDivert.dll",
        "win-unpacked/resources/win/WinDivert64.sys",
        "win-unpacked/resources/win/WinDivert-LICENSE.txt"
      )) {
      if ($requiredEntry -notin $names) { throw "Portable ZIP is incomplete: $requiredEntry" }
    }
    $zipLocaleCount = @($names | Where-Object { $_ -match '^win-unpacked/locales/[^/]+\.pak$' }).Count
    if ($zipLocaleCount -lt 50) { throw "Portable ZIP locales are incomplete: found $zipLocaleCount." }
  } finally { $zip.Dispose() }

  New-Item -ItemType Directory -Path $historyRoot -Force | Out-Null
  $releaseInstaller = Join-Path $releaseRoot "HSCode-Dev-安装版-win-x64.exe"
  $releasePortable = Join-Path $releaseRoot "HSCode-Dev-免安装版-win-x64.zip"
  foreach ($oldRelease in @($releaseInstaller, $releasePortable)) {
    if (Test-Path -LiteralPath $oldRelease) { Move-Item -LiteralPath $oldRelease -Destination $historyRoot }
  }
  Copy-Item -LiteralPath $installerStage -Destination $releaseInstaller
  Copy-Item -LiteralPath $portableStage -Destination $releasePortable
} finally {
  if (Test-Path -LiteralPath $stageRoot) {
    Add-Type -AssemblyName Microsoft.VisualBasic
    try {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($stageRoot, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
    } catch {
      Write-Warning "Could not move staging data to the Recycle Bin: $stageRoot"
    }
  }
}

Write-Host "7/7 Record hashes"
$gitCommit = (git -C $sourceRoot rev-parse HEAD).Trim()
$releaseInstaller = Join-Path $releaseRoot "HSCode-Dev-安装版-win-x64.exe"
$releasePortable = Join-Path $releaseRoot "HSCode-Dev-免安装版-win-x64.zip"
$installerHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $releaseInstaller).Hash
$portableHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $releasePortable).Hash
[pscustomobject]@{
  Commit = $gitCommit
  Bun = $actualBun
  Installer = $releaseInstaller
  InstallerSHA256 = $installerHash
  Portable = $releasePortable
  PortableSHA256 = $portableHash
  Locales = $localeCount
} | Format-List
