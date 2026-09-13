$ErrorActionPreference = "Stop"
# In the dev repo this script lives in sandbox/, one level below the project
# root. In a shipped release zip (see build-release.ps1) it sits alongside
# server.js at the package root instead. Detect which layout applies so the
# script works from either location.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $scriptDir "server.js")) {
  $root = $scriptDir
} else {
  $root = Split-Path -Parent $scriptDir
}
Set-Location $root

$runtimeDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeDir "dailystox.pid"
$localNode = Join-Path $root ".runtime\node\node.exe"
$nodeCommand = $null

if (Test-Path $localNode) {
  $nodeCommand = Get-Item $localNode
} else {
  $nodeCommand = Get-Command node -All -ErrorAction SilentlyContinue | Where-Object {
  try {
    & $_.Source --version *> $null
    $true
  } catch {
    $false
  }
  } | Select-Object -First 1
}

if (-not $nodeCommand) {
  Write-Host ""
  Write-Host "Node.js 18+ is required to run DailyStox."
  Write-Host "Run install-node-local.ps1 or install Node from https://nodejs.org/ and run this script again."
  Read-Host "Press Enter to close"
  exit 1
}

$url = "http://localhost:5177"
Write-Host "Starting DailyStox at $url"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$portBusy = netstat -ano | Select-String ":5177" | Select-String "LISTENING"
if ($portBusy) {
  Write-Host ""
  Write-Host "Port 5177 is already in use."
  Write-Host "Run stop-dailystox.bat first, then run start.bat again."
  Read-Host "Press Enter to close"
  exit 1
}

Start-Job -ScriptBlock {
  param($target)
  Start-Sleep -Seconds 2
  Start-Process $target
} -ArgumentList $url | Out-Null

Set-Content -LiteralPath $pidFile -Value $PID
& $nodeCommand.FullName "server.js"
