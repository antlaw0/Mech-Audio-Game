@echo off
for %%f in (*.ogg) do (
    ffmpeg -i "%%f" -af "acompressor=threshold=-20dB:ratio=2:attack=10:release=150,alimiter=limit=0.891,loudnorm=I=-18:TP=-1:LRA=7" -c:a libvorbis -qscale:a 5 "normalized_%%~nf.ogg"
)
pause