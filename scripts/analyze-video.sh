#!/usr/bin/env bash
# Measures what a viewer actually sees in a recorded playthrough.
#   scripts/analyze-video.sh captures/run.mp4 [outdir]
# Outputs (in outdir):
#   luma.csv         per-frame time, mean luma (YAVG), 10th/90th-ish spread proxy (YLOW/YHIGH), saturation
#   per_second.txt   one row per second: mean luma + a bar, so dark/flat/jumpy stretches are obvious
#   cuts.txt         detected cuts (scene score > 0.25)
#   sheet.jpg        contact sheet, one frame every 3 s (what the Reel would look like at a glance)
# Targets (docs/world/visual-quality.md): story frames YAVG 28–70 (8-bit, limited range), no flash > 40 between
# adjacent seconds unless it's a deliberate cut, YHIGH-YLOW spread ≥ 40 (else the frame is mud).
set -euo pipefail
in=$1
out=${2:-${in%.*}_analysis}
mkdir -p "$out"

ffmpeg -v error -i "$in" -vf "fps=10,signalstats,metadata=print:file=$out/stats.txt" -f null -
awk '
  /pts_time/ { split($0, a, "pts_time:"); t = a[2] }
  /YAVG/ { split($0, a, "="); y = a[2] }
  /YLOW/ { split($0, a, "="); lo = a[2] }
  /YHIGH/ { split($0, a, "="); hi = a[2] }
  /SATAVG/ { split($0, a, "="); printf "%.1f,%.1f,%s,%s,%.1f\n", t, y, lo, hi, a[2] }
' "$out/stats.txt" > "$out/luma.csv"

awk -F, '{ s = int($1); sum[s] += $2; lo[s] += $3; hi[s] += $4; n[s]++ } END {
  for (i = 0; i in n; i++) {
    y = sum[i] / n[i]; bar = ""; for (k = 0; k < y / 2; k++) bar = bar "#"
    printf "%4ds  Y=%5.1f  spread=%5.1f  %s\n", i, y, (hi[i] - lo[i]) / n[i], bar
  } }' "$out/luma.csv" > "$out/per_second.txt"

ffmpeg -v error -i "$in" -vf "select='gt(scene,0.25)',metadata=print:file=$out/cuts_raw.txt" -f null - || true
grep -o 'pts_time:[0-9.]*' "$out/cuts_raw.txt" 2>/dev/null | cut -d: -f2 > "$out/cuts.txt" || true

dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
rows=$(awk -v d="$dur" 'BEGIN { r = int(d / 3 / 8) + 1; print r }')
ffmpeg -v error -y -i "$in" -vf "fps=1/3,scale=150:-1,tile=8x${rows}:padding=4" -frames:v 1 "$out/sheet.jpg"

echo "frames: $(wc -l < "$out/luma.csv")  cuts: $(wc -l < "$out/cuts.txt")  → $out"
