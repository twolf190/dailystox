@echo off
setlocal
cd /d "%~dp0"

set "SCRIPT=%TEMP%\dailystox-stop-%RANDOM%%RANDOM%.ps1"

echo $ErrorActionPreference = "SilentlyContinue" > "%SCRIPT%"
echo $root = "%~dp0" >> "%SCRIPT%"
echo $pidFile = Join-Path $root ".runtime\dailystox.pid" >> "%SCRIPT%"
echo Set-Location $root >> "%SCRIPT%"
echo $stopped = $false >> "%SCRIPT%"
echo if (Test-Path $pidFile) { $pidText = Get-Content -LiteralPath $pidFile -Raw; $serverPid = 0; if ([int]::TryParse($pidText.Trim(), [ref]$serverPid)) { $proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue; if ($proc) { Write-Host "Stopping DailyStox server process $serverPid..."; Stop-Process -Id $serverPid -Force; $stopped = $true } }; Remove-Item -LiteralPath $pidFile -Force } >> "%SCRIPT%"
echo $listeners = netstat -ano ^| Select-String ":5177" ^| ForEach-Object { $parts = ($_ -split "\s+") ^| Where-Object { $_ }; if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") { [int]$parts[4] } } ^| Select-Object -Unique >> "%SCRIPT%"
echo foreach ($listenerPid in $listeners) { $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue; if ($proc) { Write-Host "Stopping process $listenerPid listening on port 5177..."; Stop-Process -Id $listenerPid -Force; $stopped = $true } } >> "%SCRIPT%"
echo if ($stopped) { Write-Host "DailyStox stopped." } else { Write-Host "No DailyStox server was running on port 5177." } >> "%SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
del "%SCRIPT%" >nul 2>nul
pause
exit /b %EXITCODE%
