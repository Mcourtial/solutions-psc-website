#!/bin/sh
# Contact sheet of every still in out/stills → out/sheet.png (3 columns, in time order)
cd "$(dirname "$0")/out/stills" || exit 1
ffmpeg -y -loglevel error -pattern_type glob -i 't*.png' -vf "scale=640:360,tile=3x${ROWS:-3}:padding=4:color=white" -frames:v 1 ../sheet.png
