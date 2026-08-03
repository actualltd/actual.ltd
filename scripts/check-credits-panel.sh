#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-credits-panel"

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
  const trigger = document.querySelector("#credits-control");
  const dialog = document.querySelector("#credits-dialog");
  const close = document.querySelector("#credits-close");
  if (!(trigger instanceof HTMLButtonElement) || !(dialog instanceof HTMLDialogElement) || !(close instanceof HTMLButtonElement)) {
    return { ok: false };
  }

  const rawCreditsLinkVisible = [...document.querySelectorAll("a")]
    .some((link) => link.getAttribute("href")?.includes("llms.txt"));
  trigger.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const links = [...dialog.querySelectorAll(".credits-item")].map((link) => link.getAttribute("href"));
  const opened = {
    open: dialog.open,
    expanded: trigger.getAttribute("aria-expanded"),
    chapter: dialog.querySelector("#credits-chapter")?.textContent?.trim(),
    count: links.length,
    direct: links.every((href) => href?.startsWith("https://www.metmuseum.org/art/collection/search/")),
  };

  close.click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  const closed = { open: dialog.open, expanded: trigger.getAttribute("aria-expanded") };

  window.scrollTo(0, innerHeight);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  trigger.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const changed = {
    chapter: dialog.querySelector("#credits-chapter")?.textContent?.trim(),
    title: dialog.querySelector(".credits-item__title")?.textContent?.trim(),
  };

  return { ok: true, rawCreditsLinkVisible, opened, closed, changed };
})()
EVALEOF
)"

if ACTUAL_CREDITS_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_CREDITS_RESULT);
  const passed = result.ok
    && result.rawCreditsLinkVisible === false
    && result.opened.open === true
    && result.opened.expanded === "true"
    && result.opened.chapter === "001 / FORM"
    && result.opened.count === 3
    && result.opened.direct === true
    && result.closed.open === false
    && result.closed.expanded === "false"
    && result.changed.chapter === "002 / GESTURE"
    && result.changed.title === "The Dance Class";
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: the styled credits index opens, updates by record, and links directly to The Met"
  exit 0
fi

echo "FAIL: credits panel behavior is inconsistent: $result"
exit 1
