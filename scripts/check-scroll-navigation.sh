#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-scroll-loop"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser close >/dev/null 2>&1 || true
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser wait --load networkidle >/dev/null
browser wait 350 >/dev/null

result="$(browser eval --stdin <<'EVALEOF'
(async () => {
  const record = () => document.querySelector("#record-index")?.textContent ?? "MISSING";
  const wheel = (deltaY) => window.dispatchEvent(new WheelEvent("wheel", {
    deltaY,
    bubbles: true,
    cancelable: true,
  }));
  const pause = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

  const before = record();
  wheel(120);
  await pause(230);
  const afterFirst = record();
  wheel(70);
  await pause(120);
  const afterTail = record();

  await pause(1100);
  wheel(120);
  await pause(120);
  const afterNewGesture = record();

  return { before, afterFirst, afterTail, afterNewGesture };
})()
EVALEOF
)"

if ACTUAL_SCROLL_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_SCROLL_RESULT);
  const passed = result.before === "[001/003]"
    && result.afterFirst === "[002/003]"
    && result.afterTail === "[002/003]"
    && result.afterNewGesture === "[003/003]";
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: one gesture advances one scene; a fresh gesture advances the next"
  exit 0
fi

echo "FAIL: $result"
exit 1
