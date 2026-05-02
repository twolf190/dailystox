@echo off
setlocal
cd /d "%~dp0"

set "SCRIPT=%TEMP%\dailystox-install-node-%RANDOM%%RANDOM%.ps1"

echo $ErrorActionPreference = "Stop" > "%SCRIPT%"
echo $root = "%~dp0" >> "%SCRIPT%"
echo $runtimeDir = Join-Path $root ".runtime" >> "%SCRIPT%"
echo $nodeVersion = "v24.15.0" >> "%SCRIPT%"
echo $zipName = "node-$nodeVersion-win-x64.zip" >> "%SCRIPT%"
echo $downloadUrl = "https://nodejs.org/dist/$nodeVersion/$zipName" >> "%SCRIPT%"
echo $zipPath = Join-Path $runtimeDir $zipName >> "%SCRIPT%"
echo $extractPath = Join-Path $runtimeDir "download" >> "%SCRIPT%"
echo $nodeTarget = Join-Path $runtimeDir "node" >> "%SCRIPT%"
echo Set-Location $root >> "%SCRIPT%"
echo New-Item -ItemType Directory -Force -Path $runtimeDir ^| Out-Null >> "%SCRIPT%"
echo Write-Host "Downloading Node.js $nodeVersion LTS from nodejs.org..." >> "%SCRIPT%"
echo Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath >> "%SCRIPT%"
echo if (Test-Path $extractPath) { Remove-Item -LiteralPath $extractPath -Recurse -Force } >> "%SCRIPT%"
echo Write-Host "Extracting Node.js..." >> "%SCRIPT%"
echo Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force >> "%SCRIPT%"
echo $expanded = Get-ChildItem -Path $extractPath -Directory ^| Select-Object -First 1 >> "%SCRIPT%"
echo if (-not $expanded) { throw "Could not find extracted Node.js directory." } >> "%SCRIPT%"
echo if (Test-Path $nodeTarget) { Remove-Item -LiteralPath $nodeTarget -Recurse -Force } >> "%SCRIPT%"
echo Move-Item -LiteralPath $expanded.FullName -Destination $nodeTarget >> "%SCRIPT%"
echo Remove-Item -LiteralPath $zipPath -Force >> "%SCRIPT%"
echo Remove-Item -LiteralPath $extractPath -Recurse -Force >> "%SCRIPT%"
echo $nodeExe = Join-Path $nodeTarget "node.exe" >> "%SCRIPT%"
echo Write-Host "" >> "%SCRIPT%"
echo Write-Host "Installed:" >> "%SCRIPT%"
echo ^& $nodeExe --version >> "%SCRIPT%"
echo Write-Host "" >> "%SCRIPT%"
echo Write-Host "DailyStox will now use local Node at:" >> "%SCRIPT%"
echo Write-Host $nodeExe >> "%SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "EXITCODE=%ERRORLEVEL%"
del "%SCRIPT%" >nul 2>nul
if not "%EXITCODE%"=="0" (
  echo.
  echo Install failed.
)
pause
exit /b %EXITCODE%
