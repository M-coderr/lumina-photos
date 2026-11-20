@echo off
title Lumina Photos - Mobile App Bundler
cd /d "%~dp0\mobile"

echo =======================================================
echo          LUMINA PHOTOS - MOBILE APP (EXPO)
echo =======================================================
echo.
echo Instructions:
echo 1. Install 'Expo Go' app from Google Play Store or iOS App Store.
echo 2. Make sure your phone is connected to the same Wi-Fi as your PC.
echo 3. Scan the QR code shown below with Expo Go (Android) or Camera (iOS).
echo.

set PATH=C:\Program Files\nodejs;%PATH%
cmd.exe /c "npx expo start"
pause
