@echo off
for %%f in (*.wav) do (
    ffmpeg -i "%%f" -c:a libvorbis "%%~nf.ogg"
)
pause