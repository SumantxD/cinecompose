#!/usr/bin/env bash
# Mean luma (0–255) and spread of still images: scripts/luma.sh a.png b.png …
for f in "$@"; do
  ffmpeg -v error -i "$f" -vf "signalstats,metadata=print:file=-" -f null - 2>/dev/null \
    | awk -v f="$(basename "$f")" -F= '/YAVG/{y=$2} /YLOW/{lo=$2} /YHIGH/{hi=$2} END{printf "%-28s Y=%5.1f spread=%5.1f\n", f, y, hi-lo}'
done
