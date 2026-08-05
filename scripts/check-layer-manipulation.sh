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
  const surface = document.querySelector("#art-interaction-surface");
  if (!(engine instanceof HTMLElement) || !(surface instanceof HTMLElement)) return { ok: false };

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

  window.dispatchEvent(new WheelEvent("wheel", { clientX: 1210, clientY: 100, deltaY: -170, ctrlKey: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  const pinched = { scale: engine.dataset.layerScale, bounds: engine.dataset.layerBounds };
  window.dispatchEvent(new WheelEvent("wheel", { clientX: 1210, clientY: 100, deltaY: 360, ctrlKey: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  const shrunk = { scale: engine.dataset.layerScale, bounds: engine.dataset.layerBounds };
  const resizeScroll = new WheelEvent("wheel", { clientX: 1210, clientY: 100, deltaY: 90, cancelable: true });
  window.dispatchEvent(resizeScroll);
  const resizeLock = { active: document.documentElement.dataset.artResizing, blocked: resizeScroll.defaultPrevented };

  const [shrinkLeft, shrinkTop, shrinkRight, shrinkBottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  window.dispatchEvent(new MouseEvent("dblclick", {
    clientX: (shrinkLeft + shrinkRight) / 2,
    clientY: (shrinkTop + shrinkBottom) / 2,
    bubbles: true,
  }));
  await new Promise((resolve) => setTimeout(resolve, 900));
  const reset = { scale: engine.dataset.layerScale, offset: engine.dataset.layerOffset, resizing: document.documentElement.dataset.artResizing };

  const [resetLeft, resetTop, resetRight, resetBottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  const gestureX = (resetLeft + resetRight) / 2;
  const gestureY = (resetTop + resetBottom) / 2;
  const gesture = (type, scale) => {
    const gestureEvent = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(gestureEvent, {
      scale: { value: scale },
      clientX: { value: gestureX },
      clientY: { value: gestureY },
    });
    surface.dispatchEvent(gestureEvent);
  };
  gesture("gesturestart", 1);
  gesture("gesturechange", 1.8);
  gesture("gestureend", 1.8);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const nativeGesture = { scale: engine.dataset.layerScale, bounds: engine.dataset.layerBounds };

  const [gestureLeft, gestureTop, gestureRight, gestureBottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  window.dispatchEvent(new MouseEvent("dblclick", {
    clientX: (gestureLeft + gestureRight) / 2,
    clientY: (gestureTop + gestureBottom) / 2,
    bubbles: true,
  }));
  await new Promise((resolve) => setTimeout(resolve, 900));
  const gestureReset = { scale: engine.dataset.layerScale, offset: engine.dataset.layerOffset };

  surface.dispatchEvent(new WheelEvent("wheel", { bubbles: true, clientX: 980, clientY: 485, deltaX: 52, deltaY: 3, cancelable: true }));
  const trackpad = { offset: engine.dataset.layerOffset };
  return { ok: true, dragged, pinched, shrunk, resizeLock, reset, nativeGesture, gestureReset, trackpad };
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
    && Number(result.pinched.scale) > 2.4
    && Number(result.pinched.scale) <= 2.8
    && withinPage(result.pinched.bounds)
    && Number(result.shrunk.scale) >= 0.28
    && Number(result.shrunk.scale) < 0.45
    && withinPage(result.shrunk.bounds)
    && result.resizeLock.active === "true"
    && result.resizeLock.blocked === true
    && Number(result.reset.scale) === 1
    && result.reset.resizing === undefined
    && Math.abs(reset[0]) < 0.001
    && Math.abs(reset[1]) < 0.001
    && Number(result.nativeGesture.scale) > 1.8
    && Number(result.nativeGesture.scale) <= 2.8
    && withinPage(result.nativeGesture.bounds)
    && Number(result.gestureReset.scale) === 1
    && Math.abs(trackpad[0]) > 0.02
    && Math.abs(trackpad[0]) <= 0.2;
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: layers drag across the page, zoom generously in both directions, reset, and trackpad-slide"
  exit 0
fi

echo "FAIL: page-bounded layer manipulation is inconsistent: $result"
exit 1
