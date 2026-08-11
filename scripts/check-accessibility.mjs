import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const markup = await readFile(path.join(root, "index.html"), "utf8");
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const failures = [];

function luminance([red, green, blue]) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const sceneColors = ["114bc6", "e52e14", "6038c4", "05a159", "d95622"];
for (const hex of sceneColors) {
  const background = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const plate = background.map((channel) => Math.round(channel * 0.1 + 255 * 0.9));
  const differenceText = plate.map((channel) => 255 - channel);
  const ratio = contrast(plate, differenceText);
  if (ratio < 4.5) failures.push(`Overlay plate contrast on #${hex} is only ${ratio.toFixed(2)}:1.`);
}

if (/\.site\{[^}]*min-height/.test(styles) || /\.site\{min-height/.test(styles)) {
  failures.push("The fixed page cannot impose a minimum height that pushes controls outside short viewports.");
}
if (!/\.overlay-plate__text\{[^}]*mix-blend-mode:difference/.test(styles)
  || !/\.overlay-plate\{[^}]*background:rgba\(255,255,255,\.9\)/.test(styles)) {
  failures.push("Small difference-blended text needs a high-contrast reading plate.");
}
if (!/\.animal-control:focus-visible::after\{/.test(styles)) {
  failures.push("The silhouette control needs a visible non-rectangular keyboard focus treatment.");
}
if (!/\.company-close,\.animal-close\{[^}]*min-height:2\.75rem/.test(styles)
  || !/\.company-control\{[^}]*min-height:2\.75rem/.test(styles)
  || !/\.contact\{[^}]*min-height:2\.75rem/.test(styles)) {
  failures.push("Frequent controls must expose 44px hit targets without enlarging their visual labels.");
}
if (!/<button class="field-note-control"[^>]*aria-controls="animal-dialog"/.test(markup)) {
  failures.push("FIELD NOTE / OPEN must be a real dialog control rather than inert action-like text.");
}
if (/function preserveKeyboardActivation/.test(source)) {
  failures.push("Native buttons must retain their browser-provided keyboard activation without duplicate key handlers.");
}

if (failures.length) throw new Error(failures.join("\n"));
console.log("Overlay text passes AA contrast, short viewports reflow, controls have reliable targets, and native keyboard behavior is preserved.");
