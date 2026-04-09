@echo off
title Mech Audio Game - Dev Server

echo [MECH AUDIO GAME] Starting development environment...
echo.

REM Move to the directory this batch file lives in
cd /d "%~dp0"

REM Build all packages once before serving
echo [1/3] Building TypeScript packages...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed. Fix errors above and re-run.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting WebSocket game server on ws://localhost:8080...
start "WS Game Server" cmd /k "npm run dev:server"

echo.
echo [3/3] Starting static file server and TypeScript watch...
echo.
echo  > Test map:  http://localhost:3000/test-map.html
echo  > Index:     http://localhost:3000
echo.

REM Give the static server a moment to bind, then open the browser
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM Run watch + static serve in this window
npm run dev
