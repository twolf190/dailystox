$ErrorActionPreference = "SilentlyContinue"
# See start.ps1 for why this detects the dev (sandbox/) vs. shipped-release
# (package root) layout instead of assuming one fixed location.
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $scriptDir "server.js")) {
  $root = $scriptDir
} else {
  $root = Split-Path -Parent $scriptDir
}
$pidFile = Join-Path $root ".runtime\dailystox.pid"

Set-Location $root

$stopped = $false

if (Test-Path $pidFile) {
  $pidText = Get-Content -LiteralPath $pidFile -Raw
  $serverPid = 0
  if ([int]::TryParse($pidText.Trim(), [ref]$serverPid)) {
    $proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Stopping DailyStox server process $serverPid..."
      Stop-Process -Id $serverPid -Force
      $stopped = $true
    }
  }
  Remove-Item -LiteralPath $pidFile -Force
}

$listeners = netstat -ano | Select-String ":5177" | ForEach-Object {
  $parts = ($_ -split "\s+") | Where-Object { $_ }
  if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") {
    [int]$parts[4]
  }
} | Select-Object -Unique

foreach ($listenerPid in $listeners) {
  $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "Stopping process $listenerPid listening on port 5177..."
    Stop-Process -Id $listenerPid -Force
    $stopped = $true
  }
}

if ($stopped) {
  Write-Host "DailyStox stopped."
} else {
  Write-Host "No DailyStox server was running on port 5177."
}
