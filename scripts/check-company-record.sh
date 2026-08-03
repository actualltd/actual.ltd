#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-company-record"

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
  const trigger = document.querySelector("#company-control");
  const dialog = document.querySelector("#company-dialog");
  const close = document.querySelector("#company-close");
  const overlay = document.querySelector(".vite-error-overlay, #webpack-dev-server-client-overlay, [data-nextjs-dialog]");
  const schemaNode = document.querySelector('script[type="application/ld+json"]');
  if (!(trigger instanceof HTMLButtonElement) || !(dialog instanceof HTMLDialogElement) || !(close instanceof HTMLButtonElement) || !schemaNode) {
    return { ok: false };
  }

  const schema = JSON.parse(schemaNode.textContent || "{}");
  trigger.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const opened = {
    open: dialog.open,
    expanded: trigger.getAttribute("aria-expanded"),
    title: dialog.querySelector("h2")?.textContent?.trim(),
    address: dialog.querySelector("address")?.textContent?.replace(/\s+/g, " ").trim(),
    contact: dialog.querySelector('a[href="mailto:hello@actual.ltd"]')?.textContent?.trim(),
  };

  close.click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  const closed = { open: dialog.open, expanded: trigger.getAttribute("aria-expanded") };

  return {
    ok: true,
    overlay: Boolean(overlay),
    bodyLength: document.body.innerText.trim().length,
    schema: {
      name: schema.name,
      email: schema.email,
      street: schema.address?.streetAddress,
      city: schema.address?.addressLocality,
      postalCode: schema.address?.postalCode,
      country: schema.address?.addressCountry,
    },
    opened,
    closed,
  };
})()
EVALEOF
)"

if ACTUAL_COMPANY_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_COMPANY_RESULT);
  const passed = result.ok
    && result.overlay === false
    && result.bodyLength > 100
    && result.schema.name === "ACTUAL LTD."
    && result.schema.email === "hello@actual.ltd"
    && result.schema.street === "25 Chidlom, Ploenchit, Lumpini, Patumwan"
    && result.schema.city === "Bangkok"
    && result.schema.postalCode === "10330"
    && result.schema.country === "TH"
    && result.opened.open === true
    && result.opened.expanded === "true"
    && result.opened.title === "ACTUAL LTD."
    && result.opened.address === "25 CHIDLOM, PLOENCHIT LUMPINI, PATUMWAN BANGKOK 10330, THAILAND"
    && result.opened.contact.startsWith("hello@actual.ltd")
    && result.closed.open === false
    && result.closed.expanded === "false";
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: ACTUAL LTD. company identity, address, metadata, and dialog are aligned"
  exit 0
fi

echo "FAIL: company record is inconsistent: $result"
exit 1
