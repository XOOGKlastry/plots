@echo off
chcp 65001 >nul
REM Start: API MVT (:5001) + Cloudflare Tunnel (HTTPS dla GitHub Pages)
cd /d "%~dp0"
setlocal

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
set "HELPER=%USERPROFILE%\dzialki\plots\_start_tunnel.ps1"

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
  pause
  exit /b 1
)

echo Restartuje cloudflared trycloud ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER%" -Cloudflared "%CF%" -Port %PLOTS_PORT% -LogPath "%LOG%" -UrlFile "%URLFILE%" -ConfigJs "%CFG%"
set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo.
  echo Blad tunelu. Log:
  if exist "%LOG%" type "%LOG%"
  pause
  exit /b %EC%
)

echo.
echo OptimusPrime musi byc wlaczony + ten skrypt/tunel dzialajacy, zeby biuro widzialo dzialki.
echo Stabilny URL: cloudflared tunnel login + named tunnel (konto Cloudflare).
echo.
pause
