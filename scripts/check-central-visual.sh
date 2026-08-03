#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-art-loop"
screenshot_path="/tmp/actual-art-loop.png"

npx -y agent-browser --session "$session" open "$url" >/dev/null
npx -y agent-browser --session "$session" wait --load networkidle >/dev/null
npx -y agent-browser --session "$session" wait 1500 >/dev/null
npx -y agent-browser --session "$session" screenshot "$screenshot_path" >/dev/null

stats="$({
  ffmpeg -v error -i "$screenshot_path" \
    -vf "crop=iw*0.5:ih*0.48:iw*0.25:ih*0.08,signalstats,metadata=print:file=-" \
    -frames:v 1 -f null -
} 2>&1)"

ymin="$(printf '%s\n' "$stats" | awk -F= '/lavfi.signalstats.YMIN/{print $2; exit}')"
ymax="$(printf '%s\n' "$stats" | awk -F= '/lavfi.signalstats.YMAX/{print $2; exit}')"
dark_percent="$({
  ffmpeg -v error -i "$screenshot_path" \
    -vf "crop=iw*0.5:ih*0.48:iw*0.25:ih*0.08,format=gray" \
    -frames:v 1 -f rawvideo -
} 2>/dev/null | od -An -tu1 -v | awk '
  {
    for (field = 1; field <= NF; field++) {
      total++
      if ($field < 80) dark++
    }
  }
  END { printf "%.3f", total ? (dark * 100 / total) : 0 }
')"

if [[ -z "$ymin" || -z "$ymax" ]]; then
  echo "FAIL: could not measure the central visual"
  exit 1
fi

if (( ymin < 80 && ymax - ymin > 100 )) && awk "BEGIN { exit !($dark_percent > 1.5) }"; then
  echo "PASS: central visual has visible dither coverage (dark=$dark_percent%, YMIN=$ymin, YMAX=$ymax)"
  exit 0
fi

echo "FAIL: central visual is empty or illegible (dark=$dark_percent%, YMIN=$ymin, YMAX=$ymax)"
exit 1
