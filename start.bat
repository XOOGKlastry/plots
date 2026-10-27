@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

if not defined PLOTS_DSN set PLOTS_DSN=postgresql://postgres@localhost/gisss
if not defined PLOTS_PORT set PLOTS_PORT=5001

set "PYW=%USERPROFILE%\dzialki\.venv\Scripts\pythonw.exe"
set "PY=%USERPROFILE%\dzialki\.venv\Scripts\python.exe"
if not exist "%PYW%" set "PYW=%PY%"
if not exist "%PYW%" set "PYW=pythonw"
if not exist "%PY%" set "PY=python"

REM Ensure tray deps (quiet, once)
"%PY%" -c "import pystray,PIL" 2>nul
if errorlevel 1 (
  echo Instaluje pystray + Pillow...
  "%PY%" -m pip install pystray Pillow --quiet
)

echo Startuje Dzialki EGiB w zasobniku systemowym (tray)...
start "" "%PYW%" "%~dp0tray_app.py"
exit /b 0
