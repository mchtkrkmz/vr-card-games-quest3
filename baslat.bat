@echo off
cd /d "%~dp0"
title VR Kiraathane - Sunucu Baslatici
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

echo [OK] Sunucu baslatiliyor...
echo.
echo   Bilgisayar Tarayici:   http://localhost:5173/
echo   Meta Quest 3 (Wi-Fi):  http://192.168.1.36:5173/
echo.
echo Sunucuyu durdurmak icin bu pencereyi kapatabilirsiniz.
echo ================================================================
echo.

start http://localhost:5173/
call npm run dev

pause
