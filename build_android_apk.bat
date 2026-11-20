@echo off
title Lumina Photos - Build Android APK
cd /d "%~dp0\mobile"

echo =======================================================
echo          BUILD STANDALONE ANDROID APK (.apk)
echo =======================================================
echo.
echo This script packages Lumina Photos into a standalone .apk
echo that you can directly install on any Android phone!
echo.

set PATH=C:\Program Files\nodejs;%PATH%
cmd.exe /c "npx --yes eas-cli build --platform android --profile preview"
pause
