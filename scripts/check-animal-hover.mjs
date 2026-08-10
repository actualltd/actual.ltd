import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const thresholdMatch = source.match(/ANIMAL_HIT_ALPHA_THRESHOLD\s*=\s*(\d+)/);

if (!thresholdMatch) throw new Error("Animal alpha hit threshold must be explicit and testable.");

const threshold = Number(thresholdMatch[1]);
const failures = [];

if (threshold < 1 || threshold > 255) failures.push(`Animal alpha hit threshold ${threshold} is invalid.`);

if (!/drop-shadow\(0 0 [^)]+#fff\)/.test(styles)) {
  failures.push("Animal hover needs a white inner halo so the glow remains visibly bright in every scene.");
}

const restingRule = styles.match(/\.animal-parallax\{([^}]*)\}/)?.[1] ?? "";
if (restingRule.includes("transition:filter")) {
  failures.push("Animal glow cannot transition the filter property; browsers may interpolate its shadow colors through black.");
}

const activeRule = styles.match(/\.animal-parallax\[data-hit="true"\][^{]*\{([^}]*)\}/)?.[1] ?? "";
if (!activeRule.includes("animation:animal-glow-in")) {
  failures.push("Animal hover must use the color-safe glow keyframes.");
}

const keyframes = styles.match(/@keyframes animal-glow-in\{([\s\S]*?)\}\}/)?.[1] ?? "";
if (!keyframes || keyframes.includes("transparent") || /\/\s*0\)/.test(keyframes)) {
  failures.push("Glow keyframes must use the final opaque scene colors from their first frame.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log(`Animal hover keeps its alpha threshold at ${threshold} and animates only color-safe glow radii.`);
