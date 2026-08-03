#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-drag-animation"
scratch="$(mktemp -d)"
before="$scratch/before.png"
after="$scratch/after.png"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser mouse up >/dev/null 2>&1 || true
  browser close >/dev/null 2>&1 || true
  find "$scratch" -type f -delete
  rmdir "$scratch"
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser set viewport 1280 720 >/dev/null
browser reload >/dev/null
browser wait --load networkidle >/dev/null
browser wait 900 >/dev/null
browser mouse move 980 485 >/dev/null
browser wait 700 >/dev/null
browser mouse down >/dev/null
browser wait 120 >/dev/null
browser screenshot "$before" >/dev/null
browser mouse move 1160 315 >/dev/null
browser wait 260 >/dev/null
browser screenshot "$after" >/dev/null
browser mouse up >/dev/null

motion_score="$({
  ffmpeg -hide_banner -loglevel error -i "$before" -i "$after" \
    -filter_complex '[0:v][1:v]blend=all_mode=difference,crop=220:320:155:188,signalstats,metadata=print:file=-' \
    -frames:v 1 -f null -
} | awk -F= '/lavfi.signalstats.YAVG=/{print $2; exit}')"

if MOTION_SCORE="$motion_score" node -e '
  const score = Number(process.env.MOTION_SCORE);
  process.exit(Number.isFinite(score) && score >= 2.0 ? 0 : 1);
'; then
  echo "PASS: non-dragged artwork keeps responding to live motion during direct manipulation ($motion_score)"
  exit 0
fi

echo "FAIL: dragging freezes surrounding artwork motion ($motion_score)"
exit 1
