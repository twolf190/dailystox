$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
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

if (Test-Path ".git") {
  $branch = git rev-parse --abbrev-ref HEAD
  Write-Host "Current git branch: $branch"

  $upstream = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
  if ($LASTEXITCODE -eq 0 -and $upstream) {
    Write-Host "Pulling latest changes for $branch from $upstream..."
    git pull --ff-only
  } else {
    Write-Host "No upstream configured for $branch. Skipping git pull."
  }
} else {
  Write-Host "No git repository found yet. Starting local app without pulling."
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
