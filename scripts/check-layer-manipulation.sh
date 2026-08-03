#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-layer-manipulation"

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
browser wait 1200 >/dev/null

result="$(browser eval --stdin <<'EVALEOF'
(async () => {
  window.scrollTo(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const engine = document.querySelector(".art-engine");
  if (!(engine instanceof HTMLElement)) return { ok: false };

  const pointer = (type, x, y, buttons = 0) => window.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  }));

  pointer("pointermove", 980, 485);
  pointer("pointerdown", 980, 485, 1);
  pointer("pointermove", 1210, 100, 1);
  pointer("pointerup", 1210, 100);
  const dragged = { role: engine.dataset.activeLayer, offset: engine.dataset.layerOffset, bounds: engine.dataset.layerBounds };

  window.dispatchEvent(new WheelEvent("wheel", { clientX: 1210, clientY: 100, deltaY: -85, ctrlKey: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  const pinched = { scale: engine.dataset.layerScale, bounds: engine.dataset.layerBounds };
  const resizeScroll = new WheelEvent("wheel", { clientX: 1210, clientY: 100, deltaY: 90, cancelable: true });
  window.dispatchEvent(resizeScroll);
  const resizeLock = { active: document.documentElement.dataset.artResizing, blocked: resizeScroll.defaultPrevented };

  window.dispatchEvent(new MouseEvent("dblclick", { clientX: 1210, clientY: 100, bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 900));
  const reset = { scale: engine.dataset.layerScale, offset: engine.dataset.layerOffset, resizing: document.documentElement.dataset.artResizing };

  window.dispatchEvent(new WheelEvent("wheel", { clientX: 980, clientY: 485, deltaX: 52, deltaY: 3, cancelable: true }));
  const trackpad = { offset: engine.dataset.layerOffset };
  return { ok: true, dragged, pinched, resizeLock, reset, trackpad };
})()
EVALEOF
)"

if ACTUAL_LAYER_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_LAYER_RESULT);
  const parseOffset = (value) => String(value).split(",").map(Number);
  const withinPage = (value) => {
    const [left, top, right, bottom] = String(value).split(",").map(Number);
    return left >= 23.5 && top >= 23.5 && right <= 1256.5 && bottom <= 696.5;
  };
  const dragged = parseOffset(result.dragged.offset);
  const reset = parseOffset(result.reset.offset);
  const trackpad = parseOffset(result.trackpad.offset);
  const passed = result.ok
    && result.dragged.role === "object"
    && Math.abs(dragged[0]) > 0.4
    && Math.abs(dragged[1]) > 0.7
    && withinPage(result.dragged.bounds)
    && Number(result.pinched.scale) > 1
    && Number(result.pinched.scale) <= 1.32
    && withinPage(result.pinched.bounds)
    && result.resizeLock.active === "true"
    && result.resizeLock.blocked === true
    && Number(result.reset.scale) === 1
    && result.reset.resizing === undefined
    && Math.abs(reset[0]) < 0.001
    && Math.abs(reset[1]) < 0.001
    && Math.abs(trackpad[0]) > 0.02
    && Math.abs(trackpad[0]) <= 0.2;
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: layers drag across the page, stay on-screen, pinch, reset, and trackpad-slide"
  exit 0
fi

echo "FAIL: page-bounded layer manipulation is inconsistent: $result"
exit 1
