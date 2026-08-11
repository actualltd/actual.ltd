import { readFile } from "node:fs/promises";
import path from "node:path";

const styles = await readFile(path.join(process.cwd(), "src/styles.css"), "utf8");

function declarationsFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`(?:^|\\n)${escaped}\\{([^}]*)\\}`));
  if (!match) throw new Error(`Unable to find the ${selector} rule.`);
  return match[1];
}

const topOverlay = declarationsFor(".top-overlay");
const bottomOverlay = declarationsFor(".bottom-overlay");
const wordmark = declarationsFor(".wordmark");
const topMeta = declarationsFor(".top-meta");
const sceneControl = declarationsFor(".scene-control");
const companyRecord = declarationsFor(".company-record");
const fieldNoteControl = declarationsFor(".field-note-control");
const overlayPlate = declarationsFor(".overlay-plate");
const overlayPlateText = declarationsFor(".overlay-plate__text");

for (const [name, declarations] of [["top", topOverlay], ["bottom", bottomOverlay]]) {
  if (/\bz-index\s*:\s*(?!auto\b)[^;]+/.test(declarations)) {
    throw new Error(`The ${name} overlay must not isolate its text from the scene in Firefox.`);
  }
}

if (!/\bmix-blend-mode\s*:\s*difference\b/.test(wordmark)) {
  throw new Error("The ACTUAL wordmark must keep its live difference blend mode.");
}

if (!/\bz-index\s*:\s*3\b/.test(wordmark)
  || !/\bz-index\s*:\s*5\b/.test(topMeta)
  || !/\bz-index\s*:\s*4\b/.test(sceneControl)
  || !/\bz-index\s*:\s*4\b/.test(companyRecord)) {
  throw new Error("Each text-only blend group must carry its own intended scene layer.");
}

for (const [name, declarations] of [["top metadata", topMeta], ["scene control", sceneControl], ["company rail", companyRecord]]) {
  if (!/\bmix-blend-mode\s*:\s*difference\b/.test(declarations)) {
    throw new Error(`The ${name} must blend its text-only group directly with the scene.`);
  }
}

if (!/\bbackground\s*:\s*transparent\b/.test(overlayPlate) || !/\bbox-shadow\s*:\s*none\b/.test(overlayPlate)) {
  throw new Error("Overlay labels must not paint white boxes behind their text.");
}

if (!/\bmix-blend-mode\s*:\s*normal\b/.test(overlayPlateText)) {
  throw new Error("Label glyphs must inherit the group blend instead of nesting a second blend operation.");
}

if (!/\bposition\s*:\s*relative\b/.test(fieldNoteControl) || !/\bz-index\s*:\s*1\b/.test(fieldNoteControl)) {
  throw new Error("The field-note control must remain above the NEXT control's expanded pointer target.");
}

console.log("Firefox blends text-only overlay groups directly with the scene without painting label boxes.");
