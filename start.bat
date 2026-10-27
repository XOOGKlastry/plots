@echo off
REM Lokalny serwer MVT + mapa (PostGIS gisss.egib.dzialki) na porcie 5001
cd /d "%~dp0"
if not defined PLOTS_DSN set PLOTS_DSN=postgresql://postgres@localhost/gisss
if not defined PLOTS_PORT set PLOTS_PORT=5001
echo.
echo === Dzialki EGiB ===
echo Mapa+API: http://127.0.0.1:%PLOTS_PORT%/
echo GitHub Pages jest HTTPS - do kafli HTTP uzywaj lokalnego URL powyzej
echo.
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" server\public_api.py
) else if exist "%USERPROFILE%\dzialki\.venv\Scripts\python.exe" (
  "%USERPROFILE%\dzialki\.venv\Scripts\python.exe" server\public_api.py
) else (
  python server\public_api.py
)
pause
