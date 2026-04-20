@echo off
title Mech Audio Game - Dev Server

echo [MECH AUDIO GAME] Starting local playtest services...
echo.

REM Move to the directory this batch file lives in
cd /d "%~dp0"

REM Validate required ports are available before starting services
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do set PORT8080_PID=%%p
if defined PORT8080_PID (
    echo [INFO] Port 8080 is in use by PID %PORT8080_PID%. Stopping it...
    taskkill /PID %PORT8080_PID% /F >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Could not stop PID %PORT8080_PID% on port 8080.
        echo Try running this script as Administrator or stop it manually.
        pause
        exit /b 1
    )
)

for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do set PORT3000_PID=%%p
if defined PORT3000_PID (
    echo [INFO] Port 3000 is in use by PID %PORT3000_PID%. Stopping it...
    taskkill /PID %PORT3000_PID% /F >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Could not stop PID %PORT3000_PID% on port 3000.
        echo Try running this script as Administrator or stop it manually.
        pause
        exit /b 1
    )
)

REM Build client and server packages before starting playtest services
echo [1/3] Building server package...
call npm run build:server
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Fix errors above and re-run.
    pause
    exit /b 1
)

echo.
echo [2/3] Building client package...
call npm run build:client
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Fix errors above and re-run.
    pause
    exit /b 1
)

echo.
echo [3/3] Starting playtest services...
echo.
echo HTTP:       http://localhost:3000
echo Test map:   http://localhost:3000/test-map.html
echo WebSocket:  ws://localhost:8080
echo.
echo No browser will be opened automatically.
echo Press Ctrl+C to stop all services.
echo.
npm run dev:playtest
