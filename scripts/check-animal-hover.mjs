import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const glowController = await readFile(path.join(root, "src/animal-glow.ts"), "utf8").catch(() => "");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const markup = await readFile(path.join(root, "index.html"), "utf8");
const thresholdMatch = source.match(/ANIMAL_HIT_ALPHA_THRESHOLD\s*=\s*(\d+)/);
const failures = [];

if (!thresholdMatch) failures.push("Animal alpha hit threshold must be explicit and testable.");
else {
  const threshold = Number(thresholdMatch[1]);
  if (threshold < 1 || threshold > 255) failures.push(`Animal alpha hit threshold ${threshold} is invalid.`);
}

if (!markup.includes('class="animal-sprite"') || !markup.includes('class="animal-glow"')) {
  failures.push("The animal and Paper shader need a shared sprite wrapper.");
}

if (!/class="animal-glow"[^>]*aria-hidden="true"/.test(markup)) {
  failures.push("The shader host must be accessibility-hidden.");
}

if (!/\.animal-glow\{[^}]*pointer-events:none/.test(styles)) {
  failures.push("The shader canvas must never intercept pointer events.");
}

const animalRules = [...styles.matchAll(/(?:^|\n)[^{\n]*\.(?:animal|animal-sprite|animal-parallax)(?=[\s,{\[])[^{]*\{([^}]*)\}/g)]
  .map((match) => match[1])
  .join("\n");
if (/\bfilter\s*:|drop-shadow|animation\s*:/.test(animalRules)) {
  failures.push("The animal stack cannot use CSS filters, drop-shadows, or glow animations.");
}

if (/animal-glow-in|drop-shadow/.test(styles)) {
  failures.push("Legacy CSS glow code must be removed completely.");
}

if (!/new ShaderMount\s*\(/.test(glowController)) {
  failures.push("The glow controller must create one reusable Paper ShaderMount.");
}

const mountCount = (glowController.match(/new ShaderMount\s*\(/g) ?? []).length;
if (mountCount !== 1) failures.push(`Expected one ShaderMount constructor, found ${mountCount}.`);

if (!/heatmapFragmentShader/.test(glowController) || !/toProcessedHeatmap/.test(glowController)) {
  failures.push("Paper Heatmap and its required preprocessing must power the glow.");
}

if (!/u_colorBack\s*:\s*\[0\s*,\s*0\s*,\s*0\s*,\s*0\]/.test(glowController)) {
  failures.push("The Heatmap background must be fully transparent.");
}

if (!/u_outerGlow\s*:\s*0\.5/.test(glowController)
  || !/u_contour\s*:\s*0\.14/.test(glowController)
  || !/u_innerGlow\s*:\s*0/.test(glowController)
  || !/u_noise\s*:\s*0/.test(glowController)) {
  failures.push("Heatmap uniforms must match the approved contour and glow settings.");
}

if (!/setSpeed\(active\s*\?\s*0\.12\s*:\s*0\)/.test(glowController)) {
  failures.push("Shader motion must run at 0.12 only while the glow is active.");
}

if (!/prepareToken/.test(glowController) || !/processedMasks/.test(glowController)) {
  failures.push("Processed masks must be cached and protected against stale async updates.");
}

if (!/glow\s*:\s*"#[0-9a-fA-F]{6}"/g.test(source)
  || (source.match(/glow\s*:\s*"#[0-9a-fA-F]{6}"/g) ?? []).length !== 5) {
  failures.push("Every scene must provide its own opaque glow color.");
}

const companyRecordRule = styles.match(/\.company-record\{([^}]*)\}/)?.[1] ?? "";
if (/border-top/.test(companyRecordRule)) {
  failures.push("The divider below ACTUAL must be removed.");
}

if (!/\.animal-source\{[^}]*border-top/.test(styles)) {
  failures.push("The popup REFERENCE divider must remain.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log("Animal hover uses one reusable transparent Paper Heatmap with cached alpha masks and no CSS glow fallback.");
