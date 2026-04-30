$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $root ".runtime"
$nodeVersion = "v24.15.0"
$zipName = "node-$nodeVersion-win-x64.zip"
$downloadUrl = "https://nodejs.org/dist/$nodeVersion/$zipName"
$zipPath = Join-Path $runtimeDir $zipName
$extractPath = Join-Path $runtimeDir "download"
$nodeTarget = Join-Path $runtimeDir "node"

Set-Location $root
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

Write-Host "Downloading Node.js $nodeVersion LTS from nodejs.org..."
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath

if (Test-Path $extractPath) {
  Remove-Item -LiteralPath $extractPath -Recurse -Force
}

Write-Host "Extracting Node.js..."
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

$expanded = Get-ChildItem -Path $extractPath -Directory | Select-Object -First 1
if (-not $expanded) {
  throw "Could not find extracted Node.js directory."
}

if (Test-Path $nodeTarget) {
  Remove-Item -LiteralPath $nodeTarget -Recurse -Force
}

Move-Item -LiteralPath $expanded.FullName -Destination $nodeTarget
Remove-Item -LiteralPath $zipPath -Force
Remove-Item -LiteralPath $extractPath -Recurse -Force

$nodeExe = Join-Path $nodeTarget "node.exe"
Write-Host ""
Write-Host "Installed:"
& $nodeExe --version
Write-Host ""
Write-Host "DailyStox will now use local Node at:"
Write-Host $nodeExe
