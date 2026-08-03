#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-parallax-depth"
work_dir="$(mktemp -d)"
left_image="$work_dir/left.png"
right_image="$work_dir/right.png"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser close >/dev/null 2>&1 || true
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser wait --load networkidle >/dev/null
browser wait 1200 >/dev/null
browser mouse move 20 280 >/dev/null
browser wait 850 >/dev/null
browser screenshot "$left_image" >/dev/null
browser mouse move 1260 280 >/dev/null
browser wait 850 >/dev/null
browser screenshot "$right_image" >/dev/null

measurement="$({
  ffmpeg -v error -i "$left_image" -i "$right_image" \
    -lavfi 'blend=all_mode=difference,format=gray' -frames:v 1 -f rawvideo -
} 2>/dev/null | od -An -tu1 -v | awk '
  {
    for (i = 1; i <= NF; i++) {
      total++
      sum += $i
      if ($i > 20) changed++
    }
  }
  END { printf "%.3f %.3f", total ? 100 * changed / total : 0, total ? sum / total : 0 }
')"

changed_percent="${measurement%% *}"
mean_difference="${measurement##* }"

if awk "BEGIN { exit !($changed_percent > 2 && $mean_difference > 2.5) }"; then
  echo "PASS: foreground and background layers visibly separate with pointer movement (changed=$changed_percent%, mean=$mean_difference)"
  exit 0
fi

echo "FAIL: pointer movement does not create visible depth (changed=$changed_percent%, mean=$mean_difference)"
exit 1
