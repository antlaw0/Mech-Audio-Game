@echo off
title Mech Audio Game - Dev Server

set LOCKFILE=%TEMP%\mech_audio_dev.lock

REM =========================
REM Prevent duplicate runs
REM =========================
if exist "%LOCKFILE%" (
    echo.
    echo [WARNING] Dev server already running!
    echo If it's not, delete this file:
    echo %LOCKFILE%
    echo.
    pause
    exit /b 1
)

echo running > "%LOCKFILE%"

echo [MECH AUDIO GAME] Starting local playtest services...
echo.

REM Move to script directory
cd /d "%~dp0"

echo.
echo [1/1] Starting guarded playtest services...
echo.
echo HTTP:       http://localhost:3000
echo Test map:   http://localhost:3000/test-map.html
echo WebSocket:  ws://localhost:8080
echo.
echo Press Ctrl+C to stop all services.
echo.

REM =========================
REM Run dev server
REM =========================
call npm run dev:playtest

REM =========================
REM Cleanup on exit
REM =========================
echo.
echo Cleaning up...
del "%LOCKFILE%" >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] Playtest stack failed to start. Check logs above.
    pause
    exit /b 1
)