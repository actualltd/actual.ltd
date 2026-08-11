import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const markup = await readFile(path.join(root, "index.html"), "utf8");
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const failures = [];

if (/\.site\{[^}]*min-height/.test(styles) || /\.site\{min-height/.test(styles)) {
  failures.push("The fixed page cannot impose a minimum height that pushes controls outside short viewports.");
}

const highContrast = styles.match(/@media\(prefers-contrast:more\)\{([\s\S]*?)\n\}/)?.[1] ?? "";
for (const selector of [".top-meta", ".scene-control", ".company-record", ".wordmark", ".animal-card__content"]) {
  if (!highContrast.includes(selector)) failures.push(`${selector} needs a text-only increased-contrast treatment.`);
}
if (!/color:#000/.test(highContrast)
  || !/mix-blend-mode:normal/.test(highContrast)
  || !/-webkit-text-stroke:1px #fff/.test(highContrast)) {
  failures.push("Increased-contrast mode must replace image blending with outlined glyphs, never a reading plate.");
}

const portrait = styles.match(/@media\(max-width:760px\), \(max-width:900px\) and \(orientation:portrait\)\{([\s\S]*?)\n\}/)?.[1] ?? "";
if (!portrait.includes(".top-meta{font-size:.61rem;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:.35rem}")
  || !portrait.includes(".field-note-control{width:100%;min-width:0}")
  || !portrait.includes(".top-meta .overlay-plate__text{white-space:normal;overflow-wrap:anywhere}")) {
  failures.push("Portrait metadata must reserve three bounded columns so long scientific names never collide with FIELD NOTE.");
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
console.log("Text-only overlays provide an outlined increased-contrast mode, short viewports reflow, controls have reliable targets, and native keyboard behavior is preserved.");
