@echo off
REM Uruchamia lokalny serwer kafli MVT (PostGIS gisss.egib.dzialki) na porcie 5001
cd /d "%~dp0"
if not defined PLOTS_DSN set PLOTS_DSN=postgresql://postgres@localhost/gisss
if not defined PLOTS_PORT set PLOTS_PORT=5001
echo.
echo === Dzialki EGiB API ===
echo Port: %PLOTS_PORT%
echo Otworz mape: https://xoogklastry.github.io/plots/
echo (mapa domyslnie laczy sie z http://127.0.0.1:%PLOTS_PORT%)
echo.
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" server\public_api.py
) else if exist "%USERPROFILE%\dzialki\.venv\Scripts\python.exe" (
  "%USERPROFILE%\dzialki\.venv\Scripts\python.exe" server\public_api.py
) else (
  python server\public_api.py
)
pause
