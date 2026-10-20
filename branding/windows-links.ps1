param([switch]$Restore)
$ErrorActionPreference = 'Stop'
$previewRepo = Split-Path -Parent $PSScriptRoot
$manifest = Join-Path $previewRepo '.local/windows-links.json'
if ($Restore) {
    $links = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
    foreach ($link in $links) {
        [IO.File]::WriteAllText((Join-Path $previewRepo $link.path), $link.target, [Text.UTF8Encoding]::new($false))
    }
    "Restored $($links.Count) upstream symlink placeholders."
    return
}
$links = if (Test-Path -LiteralPath $manifest) {
    @(Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json)
} else {
    @(git -C $previewRepo ls-files -s -- packages/app/public packages/app/src/custom-elements.d.ts packages/enterprise/src/custom-elements.d.ts |
    ForEach-Object {
        if ($_ -match '^120000 ([0-9a-f]+) 0\t(.+)$') {
            $file = Join-Path $previewRepo $Matches[2]
            if ((git -C $previewRepo hash-object -- $file) -ne $Matches[1]) {
                throw "Unexpected change in symlink placeholder: $file"
            }
            [pscustomobject]@{path=$Matches[2]; target=[IO.File]::ReadAllText($file)}
        }
    })
}
foreach ($link in $links) {
    if ([IO.File]::ReadAllText((Join-Path $previewRepo $link.path)) -cne $link.target) {
        throw "Link is modified or already materialized; restore it first: $($link.path)"
    }
}
$links | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding utf8
foreach ($link in $links) {
    $file = Join-Path $previewRepo $link.path
    $target = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $file) $link.target))
    if (-not $target.StartsWith($previewRepo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Link escapes the preview repository: $file"
    }
    Copy-Item -LiteralPath $target -Destination $file
}
"Materialized $($links.Count) upstream links for this Windows build; run with -Restore before staging."
