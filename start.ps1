$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

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
  Write-Host "Pulling latest git changes..."
  git pull --ff-only
} else {
  Write-Host "No git repository found yet. Starting local app without pulling."
}

$url = "http://localhost:5177"
Write-Host "Starting DailyStox at $url"
Start-Job -ScriptBlock {
  param($target)
  Start-Sleep -Seconds 2
  Start-Process $target
} -ArgumentList $url | Out-Null

& $nodeCommand.FullName "server.js"
