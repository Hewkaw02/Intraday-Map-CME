@echo off
title Deploy Intraday CME Map to GitHub Pages
cd /d "%~dp0"
echo ================================================================================
echo   Exporting Latest Vol2Vol Data and Deploying to GitHub Pages...
echo ================================================================================
python scripts/export_cme_static.py
if %ERRORLEVEL% NEQ 0 (
    echo Error during data export!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Building frontend production bundle...
cd frontend
call npm run build
cd ..
if %ERRORLEVEL% NEQ 0 (
    echo Error during frontend build!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Committing and pushing to GitHub repository...
git add .
git commit -m "update: refresh CME Vol2Vol static data for GitHub Pages"
git push origin main

echo.
echo ================================================================================
echo   SUCCESS! Pushed to GitHub.
echo   GitHub Pages will deploy automatically in 1-2 minutes at:
echo   https://hewkaw02.github.io/Intraday-Map-CME/
echo ================================================================================
pause
