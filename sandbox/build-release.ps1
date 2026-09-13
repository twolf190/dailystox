$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
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

# Files copied from the project root, kept at the root of the shipped package.
$rootFiles = @(
  "package.json",
  "server.js",
  "RELEASE_INSTRUCTIONS.txt"
)

foreach ($file in $rootFiles) {
  $source = Join-Path $root $file
  if (-not (Test-Path $source)) {
    throw "Missing required release file: $file"
  }
  Copy-Item -LiteralPath $source -Destination $packageDir
}

# Local-run scripts live in sandbox/ during development, but end users still
# get them at the top level of the extracted package for double-click use.
$sandboxFiles = @(
  "start.bat",
  "start.ps1",
  "stop-dailystox.bat",
  "stop-dailystox.ps1",
  "install-node-local.bat",
  "install-node-local.ps1"
)

foreach ($file in $sandboxFiles) {
  $source = Join-Path $scriptDir $file
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
