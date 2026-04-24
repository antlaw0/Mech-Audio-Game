@echo on
setlocal enabledelayedexpansion

echo === Gunshot Burst Generator ===

ffmpeg -version
pause

REM --- User Input ---
set /p input=Enter input WAV file path:
set /p count=Number of shots:
set /p delay=Delay between shots (ms):

set output=burst.wav

REM --- Validate input ---
if not exist "%input%" (
    echo ERROR: Input file not found!
    pause
    exit /b
)

REM --- Create temp folder ---
set temp=temp_audio
if exist "%temp%" rmdir /s /q "%temp%"
mkdir "%temp%"

echo.
echo Creating delayed shots...

REM --- Generate delayed copies (0 to count-1) ---
for /L %%i in (0,1,%count%-1) do (
    set /a d=%%i * %delay%
    echo Creating shot %%i with delay !d! ms
    ffmpeg -y -i "%input%" -filter_complex "adelay=!d!|!d!" "%temp%\shot%%i.wav"
)

echo.
echo Mixing audio...

REM --- Build input list ---
set mix=
for /L %%i in (0,1,%count%-1) do (
    set mix=!mix! -i "%temp%\shot%%i.wav"
)

REM --- Mix all shots ---
ffmpeg -y !mix! -filter_complex "amix=inputs=%count%:normalize=0" "%output%"

echo.
echo Cleaning up temp files...
rmdir /s /q "%temp%"

echo.
echo Done! Output file: %output%
pause