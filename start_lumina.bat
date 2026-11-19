@echo off
title Lumina Photos - Your PC Server
echo =======================================================
echo          LUMINA PHOTOS - SELF-HOSTED CLOUD
echo =======================================================
echo.

cd /d "%~dp0"

if not exist ".venv" (
    echo [Setup] Creating Python virtual environment...
    python -m venv .venv
    echo [Setup] Installing server dependencies...
    .\.venv\Scripts\pip.exe install -r server\requirements.txt
)

echo [Server] Starting Lumina PC Server Engine...
start "" "http://localhost:8000"
set PYTHONPATH=.
.\.venv\Scripts\python.exe server\run_server.py
pause
