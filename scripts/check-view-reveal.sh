#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-view-reveal"

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

result="$(browser eval --stdin <<'EVALEOF'
(async () => {
  const view = document.querySelector("#view-control");
  const motion = document.querySelector("#motion-control");
  const engine = document.querySelector(".art-engine");
  if (!(view instanceof HTMLButtonElement) || !(motion instanceof HTMLButtonElement) || !(engine instanceof HTMLElement)) return { ok: false };
  const initial = { pressed: view.getAttribute("aria-pressed"), text: view.textContent?.trim(), view: engine.dataset.view };
  view.click();
  await new Promise((resolve) => setTimeout(resolve, 550));
  const actual = { pressed: view.getAttribute("aria-pressed"), text: view.textContent?.trim(), view: engine.dataset.view };
  window.scrollTo(0, innerHeight);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const persisted = { pressed: view.getAttribute("aria-pressed"), text: view.textContent?.trim(), view: engine.dataset.view };
  motion.click();
  window.scrollTo(0, innerHeight * 2);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const motionOffDuring = { transitioning: engine.dataset.transitioning, motion: motion.getAttribute("aria-pressed") };
  await new Promise((resolve) => setTimeout(resolve, 1600));
  const motionOffSettled = { transitioning: engine.dataset.transitioning, scene: engine.dataset.scene, view: engine.dataset.view };
  return { ok: true, initial, actual, persisted, motionOffDuring, motionOffSettled };
})()
EVALEOF
)"

if ACTUAL_VIEW_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_VIEW_RESULT);
  const passed = result.ok
    && result.initial.pressed === "false"
    && result.initial.text === "VIEW—DITHER"
    && result.actual.pressed === "true"
    && result.actual.text === "VIEW—ACTUAL"
    && result.actual.view === "actual"
    && result.persisted.pressed === "true"
    && result.persisted.text === "VIEW—ACTUAL"
    && result.persisted.view === "actual"
    && result.motionOffDuring.transitioning === "true"
    && result.motionOffDuring.motion === "false"
    && result.motionOffSettled.transitioning === "false"
    && result.motionOffSettled.scene === "2"
    && result.motionOffSettled.view === "actual";
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: the selected view persists and MOTION—OFF keeps a short record transition"
  exit 0
fi

echo "FAIL: view reveal state is inconsistent: $result"
exit 1
