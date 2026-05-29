$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $root "release"
$packageDir = Join-Path $releaseRoot "DailyStox"
$zipPath = Join-Path $releaseRoot "DailyStox.zip"

Set-Location $root

if (Test-Path $packageDir) {
  Remove-Item -LiteralPath $packageDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null

$files = @(
  "package.json",
  "server.js",
  "start.bat",
  "start.ps1",
  "stop-dailystox.bat",
  "stop-dailystox.ps1",
  "install-node-local.bat",
  "install-node-local.ps1",
  "RELEASE_INSTRUCTIONS.txt"
)

foreach ($file in $files) {
  $source = Join-Path $root $file
  if (-not (Test-Path $source)) {
    throw "Missing required release file: $file"
  }
  Copy-Item -LiteralPath $source -Destination $packageDir
}

Copy-Item -LiteralPath (Join-Path $root "public") -Destination $packageDir -Recurse

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  $packageDir,
  $zipPath,
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)

Write-Host ""
Write-Host "Release package created:"
Write-Host $packageDir
Write-Host ""
Write-Host "Zip file created:"
Write-Host $zipPath
Write-Host ""
Write-Host "Send DailyStox.zip to first-time users."
