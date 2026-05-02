@echo off
setlocal
cd /d "%~dp0"

set "SCRIPT=%TEMP%\dailystox-start-%RANDOM%%RANDOM%.ps1"

echo $ErrorActionPreference = "Stop" > "%SCRIPT%"
echo $root = "%~dp0" >> "%SCRIPT%"
echo Set-Location $root >> "%SCRIPT%"
echo $runtimeDir = Join-Path $root ".runtime" >> "%SCRIPT%"
echo $pidFile = Join-Path $runtimeDir "dailystox.pid" >> "%SCRIPT%"
echo $localNode = Join-Path $root ".runtime\node\node.exe" >> "%SCRIPT%"
echo $nodeCommand = $null >> "%SCRIPT%"
echo if (Test-Path $localNode) { $nodeCommand = Get-Item $localNode } else { $nodeCommand = Get-Command node -All -ErrorAction SilentlyContinue ^| Where-Object { try { ^& $_.Source --version *^> $null; $true } catch { $false } } ^| Select-Object -First 1 } >> "%SCRIPT%"
echo if (-not $nodeCommand) { Write-Host ""; Write-Host "Node.js 18+ is required to run DailyStox."; Write-Host "Run install-node-local.bat first, then run this again."; Read-Host "Press Enter to close"; exit 1 } >> "%SCRIPT%"
echo if (Test-Path ".git") { $branch = git rev-parse --abbrev-ref HEAD; Write-Host "Current git branch: $branch"; $upstream = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2^> $null; if ($LASTEXITCODE -eq 0 -and $upstream) { Write-Host "Pulling latest changes for $branch from $upstream..."; git pull --ff-only } else { Write-Host "No upstream configured for $branch. Skipping git pull." } } else { Write-Host "No git repository found yet. Starting local app without pulling." } >> "%SCRIPT%"
echo $url = "http://localhost:5177" >> "%SCRIPT%"
echo Write-Host "Starting DailyStox at $url" >> "%SCRIPT%"
echo New-Item -ItemType Directory -Force -Path $runtimeDir ^| Out-Null >> "%SCRIPT%"
echo $portBusy = netstat -ano ^| Select-String ":5177" ^| Select-String "LISTENING" >> "%SCRIPT%"
echo if ($portBusy) { Write-Host ""; Write-Host "Port 5177 is already in use."; Write-Host "Run stop-dailystox.bat first, then run start.bat again."; Read-Host "Press Enter to close"; exit 1 } >> "%SCRIPT%"
echo Start-Job -ScriptBlock { param($target) Start-Sleep -Seconds 2; Start-Process $target } -ArgumentList $url ^| Out-Null >> "%SCRIPT%"
echo Set-Content -LiteralPath $pidFile -Value $PID >> "%SCRIPT%"
echo ^& $nodeCommand.FullName "server.js" >> "%SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
del "%SCRIPT%" >nul 2>nul
pause
exit /b %EXITCODE%
