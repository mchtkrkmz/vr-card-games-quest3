@echo off
chcp 65001 > nul
title VR Kıraathane - GitHub Pages Canlı Yayın Dağıtıcısı
color 0B

echo ================================================================
echo   🚀 VR KIRAATHANE - GITHUB PAGES CANLI YAYIN GÜNCELLEME
echo ================================================================
echo.
echo [*] Proje derleniyor (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [HATA] Derleme basarisiz oldu!
    pause
    exit /b 1
)

echo.
echo [*] Canli yayina (gh-pages) yukleniyor...
pushd dist
git init >nul 2>nul
git checkout -b gh-pages >nul 2>nul
git config user.name "mchtkrkmz"
git config user.email "m_korkmaz@outlook.com"
git remote add origin https://github.com/mchtkrkmz/vr-card-games-quest3.git >nul 2>nul
git add -A
git commit -m "Deploy WebXR updates" >nul 2>nul
git push origin gh-pages --force
rmdir /s /q .git >nul 2>nul
popd

echo.
echo ================================================================
echo   [✓] BASARIYLA YUKLENDI!
echo   🌐 Canli Link: https://mchtkrkmz.github.io/vr-card-games-quest3/
echo ================================================================
echo.
pause
