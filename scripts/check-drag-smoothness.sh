#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-drag-smoothness"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser close >/dev/null 2>&1 || true
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser set viewport 1280 720 >/dev/null
browser reload >/dev/null
browser wait --load networkidle >/dev/null
browser wait 900 >/dev/null

result="$(browser eval --stdin <<'EVALEOF'
(async () => {
  window.scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const engine = document.querySelector(".art-engine");
  if (!(engine instanceof HTMLElement)) return { ok: false };

  const pointer = (type, x, y, buttons = 0) => window.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 27,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  }));

  pointer("pointermove", 980, 485);
  pointer("pointerdown", 980, 485, 1);
  pointer("pointermove", 1080, 420, 1);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const during = {
    role: engine.dataset.activeLayer,
    dragging: document.documentElement.dataset.artDragging,
    scrollerStopped: document.documentElement.classList.contains("lenis-stopped"),
    offset: engine.dataset.layerOffset,
  };

  pointer("pointerup", 1080, 420);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const released = {
    dragging: document.documentElement.dataset.artDragging,
    scrollerStopped: document.documentElement.classList.contains("lenis-stopped"),
    offset: engine.dataset.layerOffset,
  };
  return { ok: true, during, released };
})()
EVALEOF
)"

if ACTUAL_DRAG_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_DRAG_RESULT);
  const [offsetX, offsetY] = String(result.released?.offset).split(",").map(Number);
  const passed = result.ok
    && result.during.role === "object"
    && result.during.dragging === "object"
    && result.during.scrollerStopped === true
    && Math.abs(offsetX) > 0.1
    && Math.abs(offsetY) > 0.1
    && result.released.dragging === undefined
    && result.released.scrollerStopped === false;
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: active drag owns the frame and pauses page motion until release"
  exit 0
fi

echo "FAIL: drag competes with page motion: $result"
exit 1
