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
  const pause = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

  window.scrollTo(0, 0);
  await pause(200);
  const viewport = window.innerHeight;
  const scrollHeight = document.documentElement.scrollHeight;
  const sceneCount = document.querySelectorAll("[data-scroll-scene]").length;
  const first = { record: record(), y: window.scrollY };

  window.scrollTo(0, viewport);
  await pause(500);
  const second = { record: record(), y: window.scrollY };

  window.scrollTo(0, viewport * 2);
  await pause(500);
  const third = { record: record(), y: window.scrollY };

  window.scrollTo(0, 0);
  await pause(500);
  const returned = { record: record(), y: window.scrollY };

  return { viewport, scrollHeight, sceneCount, first, second, third, returned };
})()
EVALEOF
)"

if ACTUAL_SCROLL_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_SCROLL_RESULT);
  const near = (value, target) => Math.abs(value - target) <= result.viewport * 0.15;
  const passed = result.sceneCount === 3
    && result.scrollHeight >= result.viewport * 2.9
    && result.first.record === "[001/003]"
    && near(result.first.y, 0)
    && result.second.record === "[002/003]"
    && near(result.second.y, result.viewport)
    && result.third.record === "[003/003]"
    && near(result.third.y, result.viewport * 2)
    && result.returned.record === "[001/003]"
    && near(result.returned.y, 0);
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: native scroll positions map cleanly to all three artwork records"
  exit 0
fi

echo "FAIL: $result"
exit 1
