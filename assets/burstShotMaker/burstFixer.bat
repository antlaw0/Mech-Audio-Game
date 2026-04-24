@echo off
cd /d "%~dp0"

echo Processing OGG files...

for %%F in (*.ogg) do (

    echo Processing: %%F

    ffmpeg -y -i "%%F" ^
    -af loudnorm "%%~nF_processed.ogg"

    if %errorlevel% neq 0 (
        echo ERROR processing %%F
    ) else (
        echo OK: %%F
    )
)

pause