#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-layered-art"
work_dir="$(mktemp -d)"
screenshot_dir="${ACTUAL_LAYER_SCREENSHOT_DIR:-$work_dir}"
browser_started=0

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  if (( browser_started )); then
    browser close >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

dark_percent() {
  local image="$1"
  local crop="$2"
  ffmpeg -v error -i "$image" -vf "crop=$crop,format=gray" -frames:v 1 -f rawvideo - 2>/dev/null \
    | od -An -tu1 -v \
    | awk '{ for (i = 1; i <= NF; i++) { total++; if ($i < 80) dark++ } } END { printf "%.3f", total ? 100 * dark / total : 0 }'
}

if [[ -z "${ACTUAL_LAYER_SCREENSHOT_DIR:-}" ]]; then
  browser open "$url" >/dev/null
  browser_started=1
  browser wait --load networkidle >/dev/null
  browser wait 1400 >/dev/null
fi

failed=0
for scene in 1 2 3; do
  image="$screenshot_dir/scene-$scene.png"
  if (( browser_started )); then
    browser eval "window.scrollTo(0, innerHeight * $((scene - 1))); true" >/dev/null
    browser wait 1150 >/dev/null
    browser screenshot "$image" >/dev/null
  fi

  center="$(dark_percent "$image" 'iw*0.56:ih*0.54:iw*0.22:ih*0.12')"
  left="$(dark_percent "$image" 'iw*0.25:ih*0.56:iw*0.04:ih*0.13')"
  right="$(dark_percent "$image" 'iw*0.25:ih*0.56:iw*0.71:ih*0.13')"
  story="$(dark_percent "$image" 'iw*0.44:ih*0.17:iw*0.28:ih*0.70')"

  if awk "BEGIN { exit !($center > 1.5 && $center < 48 && $left > 0.02 && $left < 42 && $right > 0.01 && $right < 42 && $story < 12) }"; then
    echo "SCENE $scene PASS center=$center% left=$left% right=$right% story=$story%"
  else
    echo "SCENE $scene FAIL center=$center% left=$left% right=$right% story=$story%"
    failed=1
  fi
done

if (( failed )); then
  echo "FAIL: artwork collapses into the center or obscures the story copy"
  exit 1
fi

echo "PASS: all scenes retain visible center/left/right layers and a clear story zone"
