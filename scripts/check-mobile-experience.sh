#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-mobile-experience"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser close >/dev/null 2>&1 || true
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser set viewport 393 852 >/dev/null
browser reload >/dev/null
browser wait --load networkidle >/dev/null
browser wait 1200 >/dev/null

result="$(browser eval --stdin <<'EVALEOF'
(async () => {
  const pause = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const engine = document.querySelector(".art-engine");
  const plate = document.querySelector(".art-plate");
  const surface = document.querySelector("#art-interaction-surface");
  const soundControl = document.querySelector("#sound-control");
  const soundLevel = document.querySelector("#sound-level");
  const soundLevelControl = document.querySelector("#sound-level-control");
  const artworkDialog = document.querySelector("#artwork-dialog");
  if (!(engine instanceof HTMLElement)
    || !(plate instanceof HTMLElement)
    || !(surface instanceof HTMLElement)
    || !(soundControl instanceof HTMLElement)
    || !(soundLevel instanceof HTMLInputElement)
    || !(soundLevelControl instanceof HTMLElement)
    || !(artworkDialog instanceof HTMLDialogElement)) return { ok: false };

  const plateBounds = plate.getBoundingClientRect();
  const centerX = plateBounds.left + plateBounds.width * 0.76;
  const centerY = plateBounds.top + plateBounds.height * 0.72;
  const pointer = (type, id, x, y, primary = false) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: primary,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      clientX: x,
      clientY: y,
    });
    surface.dispatchEvent(event);
    return event;
  };

  pointer("pointerdown", 11, centerX - 38, centerY, true);
  pointer("pointerdown", 12, centerX + 38, centerY);
  pointer("pointermove", 11, centerX - 84, centerY - 12, true);
  pointer("pointermove", 12, centerX + 84, centerY + 12);
  const blockedWheel = new WheelEvent("wheel", { deltaY: 90, cancelable: true });
  window.dispatchEvent(blockedWheel);
  const pinch = {
    resizing: document.documentElement.dataset.artResizing,
    blocked: blockedWheel.defaultPrevented,
  };
  pointer("pointerup", 11, centerX - 84, centerY - 12, true);
  pointer("pointerup", 12, centerX + 84, centerY + 12);
  await pause(320);

  const pinchedScale = Number(engine.dataset.layerScale);
  const [left, top, right, bottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  const layerX = (left + right) * 0.5;
  const layerY = (top + bottom) * 0.5;
  pointer("pointerdown", 21, layerX, layerY, true);
  pointer("pointermove", 21, layerX + 44, layerY + 3, true);
  const dragging = document.documentElement.dataset.artDragging;
  pointer("pointerup", 21, layerX + 44, layerY + 3, true);
  const draggedOffset = engine.dataset.layerOffset;

  const [dragLeft, dragTop, dragRight, dragBottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  const tapX = (dragLeft + dragRight) * 0.5;
  const tapY = (dragTop + dragBottom) * 0.5;
  pointer("pointerdown", 31, tapX, tapY, true);
  pointer("pointerup", 31, tapX, tapY, true);

  const bodyFits = document.body.scrollWidth <= document.body.clientWidth;
  const plateFits = plateBounds.left >= 0 && plateBounds.right <= innerWidth
    && plateBounds.top >= 0 && plateBounds.bottom <= innerHeight;

  return {
    ok: true,
    bodyFits,
    plateFits,
    renderDpr: Number(engine.dataset.renderDpr),
    sound: {
      mode: soundControl.dataset.mode,
      levelHidden: soundLevelControl.hidden,
      levelDisabled: soundLevel.disabled,
    },
    pinch,
    pinchedScale,
    dragging,
    draggedOffset,
    viewerOpen: artworkDialog.open,
  };
})()
EVALEOF
)"

if ACTUAL_MOBILE_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_MOBILE_RESULT);
  const offset = String(result.draggedOffset).split(",").map(Number);
  const passed = result.ok
    && result.bodyFits
    && result.plateFits
    && result.renderDpr <= 1
    && result.sound.mode === "device"
    && result.sound.levelHidden
    && result.sound.levelDisabled
    && result.pinch.resizing === "true"
    && result.pinch.blocked
    && result.pinchedScale > 1.25
    && typeof result.dragging === "string"
    && offset.some((value) => Math.abs(value) > 0.02)
    && result.viewerOpen;
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: mobile layout, device-led sound, pinch, drag, scroll lock, and tap viewer are coherent"
  exit 0
fi

echo "FAIL: $result"
exit 1
