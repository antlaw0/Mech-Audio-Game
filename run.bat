@echo off
setlocal EnableExtensions
title Mech Audio Game - Dev Server

set LOCKFILE=%TEMP%\mech_audio_dev.lock
set EXIT_CODE=0

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

where npm >nul 2>&1
if errorlevel 1 (
    set EXIT_CODE=9009
    echo [ERROR] npm was not found in PATH.
    echo Install Node.js 20+ and reopen this terminal window.
    goto cleanup
)

REM =========================
REM Run dev server
REM =========================
call npm run dev:playtest
set EXIT_CODE=%ERRORLEVEL%

REM =========================
REM Cleanup on exit
REM =========================
:cleanup
echo.
echo Cleaning up...
del "%LOCKFILE%" >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Could not delete lock file: %LOCKFILE%
)

echo.
if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Playtest stack failed or stopped with exit code %EXIT_CODE%.
    echo Review the first error above for the root cause.
) else (
    echo [OK] Playtest services exited cleanly.
)

echo.
if not "%MECH_NO_PAUSE%"=="1" (
    echo Press any key to close this window...
    pause >nul
)

exit /b %EXIT_CODE%