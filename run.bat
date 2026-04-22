@echo off
title Mech Audio Game - Dev Server

echo [MECH AUDIO GAME] Starting local playtest services...
echo.

REM Move to the directory this batch file lives in
cd /d "%~dp0"

REM =========================
REM Start services
REM =========================

echo.
echo [1/1] Starting guarded playtest services...
echo.
echo HTTP:       http://localhost:3000
echo Test map:   http://localhost:3000/test-map.html
echo WebSocket:  ws://localhost:8080
echo.
echo No browser will be opened automatically.
echo Press Ctrl+C to stop all services.
echo.

call npm run dev:playtest
if errorlevel 1 (
    echo.
    echo [ERROR] Playtest stack failed to start. Check logs above.
    pause
    exit /b 1
)
