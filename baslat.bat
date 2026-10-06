@echo off
chcp 65001 > nul
title VR Kıraathane - Sunucu Başlatıcı
color 0A

echo ================================================================
echo   🎴 VR KIRAATHANE (OKEY & BATAK & PİŞTİ) - SUNUCU BAŞLATICI
echo ================================================================
echo.

:: Node.js Kontrolü
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadı! Lütfen https://nodejs.org adresinden kurun.
    pause
    exit /b 1
)

:: Bağımlılıkların Kontrolü
if not exist node_modules (
    echo [*] Ilk kurulum yapiliyor, paketler yukleniyor (npm install)...
    call npm install
    if %errorlevel% neq 0 (
        echo [HATA] Paketler yuklenirken hata olustu!
        pause
        exit /b 1
    )
    echo [*] Kurulum tamamlandi.
    echo.
)

echo [✓] Sunucu baslatiliyor...
echo [ℹ] Tarayici otomatik acilacak: http://localhost:5173/
echo [ℹ] Meta Quest 3 ayni Wi-Fi uzerinden baglanabilir: http://192.168.1.36:5173/
echo.
echo [!] Sunucuyu durdurmak icin pencereyi kapatabilir veya Ctrl + C yapabilirsiniz.
echo ================================================================
echo.

:: 2 saniye sonra varsayılan tarayıcıyı aç
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173/"

:: Vite geliştirme sunucusunu başlat (--host ile yerel ağa açık)
call npm run dev
pause
