@echo off
title Mech Audio Game - Stop Playtest

cd /d "%~dp0"

set "LOCK_FILE=.mech-audio\.dev-playtest.lock.json"
set "LEGACY_LOCK_FILE=%TEMP%\mech_audio_dev.lock"
set "LOCK_PID="

if exist "%LEGACY_LOCK_FILE%" (
    del /f /q "%LEGACY_LOCK_FILE%" >nul 2>&1
)

if not exist "%LOCK_FILE%" (
    echo [INFO] No active playtest lock found. Nothing to stop.
    exit /b 0
)

for /f "tokens=2 delims=:, " %%p in ('findstr /R /C:"\"pid\"" "%LOCK_FILE%"') do set "LOCK_PID=%%p"

if not defined LOCK_PID (
    echo [INFO] Lock file is invalid. Cleaning up stale lock.
    del /f /q "%LOCK_FILE%" >nul 2>&1
    exit /b 0
)

tasklist /FI "PID eq %LOCK_PID%" | findstr /R /C:" %LOCK_PID% " >nul
if errorlevel 1 (
    echo [INFO] Lock PID %LOCK_PID% is not running. Cleaning up stale lock.
    del /f /q "%LOCK_FILE%" >nul 2>&1
    exit /b 0
)

echo [INFO] Stopping playtest session (PID %LOCK_PID%)...
taskkill /PID %LOCK_PID% /T /F >nul 2>&1
if errorlevel 1 (
    echo [WARN] Could not terminate PID %LOCK_PID%. You may need elevated permissions.
    exit /b 1
)

del /f /q "%LOCK_FILE%" >nul 2>&1

echo [OK] Playtest session stopped.
exit /b 0
