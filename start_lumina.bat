@echo off
title Lumina Photos - System Tray App
cd /d "%~dp0"

echo =======================================================
echo          LUMINA PHOTOS - SELF-HOSTED CLOUD
echo =======================================================
echo.

if not exist ".venv" (
    echo [Setup] Creating Python virtual environment...
    python -m venv .venv
    echo [Setup] Installing server dependencies...
    .\.venv\Scripts\pip.exe install -r server\requirements.txt pystray
)

echo [Desktop] Starting Lumina Photos in Windows System Tray...
set PYTHONPATH=.

:: Launch with pythonw.exe so no console window remains open after starting
start "" ".\.venv\Scripts\pythonw.exe" desktop_app.py

echo.
echo [Desktop] Lumina Photos is running in the background!
echo Look for the Lumina icon in your Windows System Tray (near the clock).
echo.
timeout /t 3 >nul
exit
