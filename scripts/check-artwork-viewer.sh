#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-artwork-viewer"

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
  const dialog = document.querySelector("#artwork-dialog");
  const close = document.querySelector("#artwork-close");
  const engine = document.querySelector(".art-engine");
  const surface = document.querySelector("#art-interaction-surface");
  if (!(dialog instanceof HTMLDialogElement) || !(close instanceof HTMLButtonElement)
    || !(engine instanceof HTMLElement) || !(surface instanceof HTMLElement)) {
    return { ok: false };
  }

  const pointer = (type, x, y, pointerType = "mouse", buttons = 0, pointerId = 17) => surface.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons,
    clientX: x,
    clientY: y,
  }));

  pointer("pointermove", 980, 485);
  pointer("pointerdown", 980, 485, "mouse", 1);
  pointer("pointerup", 980, 485);
  await new Promise((resolve) => setTimeout(resolve, 180));
  const image = dialog.querySelector("#artwork-detail-image");
  const objectView = {
    open: dialog.open,
    title: dialog.querySelector("#artwork-detail-title")?.textContent?.trim(),
    role: dialog.querySelector("#artwork-detail-role")?.textContent?.trim(),
    index: dialog.querySelector("#artwork-detail-index")?.textContent?.trim(),
    image: image?.getAttribute("src"),
    loaded: image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
    source: dialog.querySelector("#artwork-detail-source")?.getAttribute("href"),
    backdrop: getComputedStyle(dialog, "::backdrop").backgroundColor,
  };

  close.click();
  await new Promise((resolve) => setTimeout(resolve, 240));
  pointer("pointermove", 980, 485);
  pointer("pointerdown", 980, 485, "mouse", 1);
  pointer("pointermove", 1040, 445, "mouse", 1);
  pointer("pointerup", 1040, 445);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const drag = {
    opened: dialog.open,
    offset: engine.dataset.layerOffset,
  };

  const [left, top, right, bottom] = String(engine.dataset.layerBounds).split(",").map(Number);
  const touchX = (left + right) / 2;
  const touchY = (top + bottom) / 2;
  pointer("pointerdown", touchX, touchY, "touch", 1, 29);
  pointer("pointerup", touchX, touchY, "touch", 0, 29);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const touchView = { open: dialog.open, title: dialog.querySelector("#artwork-detail-title")?.textContent?.trim() };
  close.click();
  await new Promise((resolve) => setTimeout(resolve, 240));

  pointer("pointermove", 700, 280);
  pointer("pointerdown", 700, 280, "mouse", 1, 31);
  pointer("pointerup", 700, 280, "mouse", 0, 31);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const environmentView = {
    open: dialog.open,
    title: dialog.querySelector("#artwork-detail-title")?.textContent?.trim(),
    image: dialog.querySelector("#artwork-detail-image")?.getAttribute("src"),
  };

  return { ok: true, objectView, drag, touchView, environmentView };
})()
EVALEOF
)"

if ACTUAL_ARTWORK_VIEWER_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_ARTWORK_VIEWER_RESULT);
  const [offsetX, offsetY] = String(result.drag.offset).split(",").map(Number);
  const passed = result.ok
    && result.objectView.open === true
    && result.objectView.title === "Terracotta amphora (jar)"
    && result.objectView.role === "object"
    && result.objectView.index === "001.03 / object"
    && result.objectView.image === "/art/archive/form-object.webp"
    && result.objectView.loaded === true
    && result.objectView.source === "https://www.metmuseum.org/art/collection/search/255154"
    && result.objectView.backdrop !== "rgba(0, 0, 0, 0)"
    && result.drag.opened === false
    && Math.hypot(offsetX, offsetY) > 0.05
    && result.touchView.open === true
    && result.touchView.title === "Terracotta amphora (jar)"
    && result.environmentView.open === true
    && result.environmentView.title === "The Death of Socrates"
    && result.environmentView.image === "/art/archive/form-environment.webp";
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: click and tap open the correct full artwork while dragging stays a manipulation"
  exit 0
fi

echo "FAIL: artwork viewer behavior is inconsistent: $result"
exit 1
