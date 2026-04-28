@echo off
echo Converting all MP3 files to OGG...

for %%f in (*.mp3) do (
    echo Converting: %%f
    ffmpeg -i "%%f" -c:a libvorbis -b:a 192k "%%~nf.ogg"
)

echo Done!
pause