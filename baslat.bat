@echo off
cd /d "%~dp0"
title VR Kiraathane - Multiplayer & VR Sunucu
color 0A

echo ================================================================
echo   VR KIRAATHANE (OKEY, BATAK, PISTI) - SUNUCU BASLATICI
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi!
    echo Lutfen https://nodejs.org adresinden Node.js kurun.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [*] Ilk kurulum: npm install calistiriliyor...
    call npm install
    if %errorlevel% neq 0 (
        echo [HATA] npm install sirasinda bir hata olustu.
        pause
        exit /b 1
    )
)

echo [*] Guncel VR paketi derleniyor...
call npm run build
if %errorlevel% neq 0 (
    echo [HATA] Derleme basarisiz!
    pause
    exit /b 1
)

echo.
echo [OK] Oyun ve Multiplayer/Ses Sunucusu baslatiliyor...
echo Tarayicida http://localhost:3000 veya Quest 3 ile https://[YEREL-IP]:3443 acin.
echo.

start "" "http://localhost:3000/"
node server/server.js

pause
