@echo off
chcp 65001 >nul
REM Start: API MVT (:5001) + Cloudflare Tunnel (HTTPS dla GitHub Pages)
cd /d "%~dp0"
setlocal EnableDelayedExpansion

if not defined PLOTS_DSN set PLOTS_DSN=postgresql://postgres@localhost/gisss
if not defined PLOTS_PORT set PLOTS_PORT=5001

set "CF=%USERPROFILE%\dzialki\tools\cloudflared.exe"
if not exist "%CF%" set "CF=%~dp0..\tools\cloudflared.exe"
if not exist "%CF%" set "CF=%~dp0tools\cloudflared.exe"

set "PY="
if exist "%~dp0.venv\Scripts\python.exe" set "PY=%~dp0.venv\Scripts\python.exe"
if not defined PY if exist "%USERPROFILE%\dzialki\.venv\Scripts\python.exe" set "PY=%USERPROFILE%\dzialki\.venv\Scripts\python.exe"
if not defined PY set "PY=python"

set "LOG=%USERPROFILE%\dzialki\cloudflare.out"
set "URLFILE=%USERPROFILE%\dzialki\tunnel_url.txt"
set "CFG=%~dp0docs\config.js"

echo.
echo === Dzialki EGiB: API + tunel HTTPS ===
echo.

REM --- API na :5001 ---
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:%PLOTS_PORT%/health -TimeoutSec 2).StatusCode } catch { 0 }" | findstr /C:"200" >nul
if errorlevel 1 (
  echo Startuje API na porcie %PLOTS_PORT% ...
  start "DzialkiPublicApi" /MIN cmd /c "cd /d \"%~dp0\" && set PLOTS_DSN=%PLOTS_DSN%&& set PLOTS_PORT=%PLOTS_PORT%&& \"%PY%\" server\public_api.py"
  timeout /t 3 /nobreak >nul
) else (
  echo API juz dziala na :%PLOTS_PORT%
)

if not exist "%CF%" (
  echo BRAK cloudflared: %CF%
  echo Zainstaluj: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
  pause
  exit /b 1
)

REM --- restart quick tunnel ---
echo Restartuje cloudflared trycloud ...
taskkill /IM cloudflared.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul
if exist "%LOG%" del /f /q "%LOG%" >nul 2>&1

start "DzialkiTunnel" /MIN cmd /c "\"%CF%\" tunnel --url http://127.0.0.1:%PLOTS_PORT% --no-autoupdate > \"%LOG%\" 2>&1"

echo Czekam na URL tunelu...
set "TUN="
for /L %%i in (1,1,40) do (
  if not defined TUN if exist "%LOG%" (
    for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "if (Test-Path '%LOG%') { $m = Select-String -Path '%LOG%' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | Select-Object -Last 1; if ($m) { $m.Matches[0].Value } }"`) do set "TUN=%%u"
  )
  if defined TUN goto have_url
  timeout /t 1 /nobreak >nul
)

echo Nie udalo sie odczytac URL z %LOG%
type "%LOG%" 2>nul
pause
exit /b 1

:have_url
echo !TUN!> "%URLFILE%"
echo.
echo ============================================
echo  TUNEL HTTPS: !TUN!
echo  Lokalnie:    http://127.0.0.1:%PLOTS_PORT%/
echo  Pages:       https://xoogklastry.github.io/plots/
echo ============================================
echo.
echo Uwaga: trycloud URL ZMIENIA SIE po kazdym restarcie.
echo Zaktualizowano docs\config.js — wypchnij do GitHub, zeby Pages widzialo nowy URL.
echo Albo wspolpracownicy: !TUN!/  (mapa z tego samego originu)
echo.

REM aktualizuj config.js (TILES_URL)
powershell -NoProfile -Command ^
  "$u='!TUN!'; $p='%CFG%'; $c=Get-Content -Raw -Encoding UTF8 $p; $n=[regex]::Replace($c,'TILES_URL:\s*\"[^\"]*\"','TILES_URL: \"'+$u+'\"'); [IO.File]::WriteAllText($p,$n,(New-Object Text.UTF8Encoding $false)); Write-Host 'config.js TILES_URL =' $u"

echo.
echo OptimusPrime musi byc wlaczony + ten skrypt dzialajacy, zeby biuro widzialo dzialki.
echo Stabilny URL: cloudflared tunnel login + named tunnel (wymaga konta Cloudflare).
echo.
pause
