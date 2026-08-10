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

const transitionMatch = styles.match(/\.animal-parallax\{[^}]*transition:filter\s+([\d.]+)s/);
if (!transitionMatch || Number(transitionMatch[1]) > 0.25) {
  failures.push("Animal glow must reach full brightness within 250ms.");
}

const restingRule = styles.match(/\.animal-parallax\{([^}]*)\}/)?.[1] ?? "";
const glowClearDefinitions = styles.match(/--glow-clear:/g)?.length ?? 0;
if (!restingRule.includes("rgb(255 255 255 / 0)") || (restingRule.match(/var\(--glow-clear\)/g)?.length ?? 0) < 2) {
  failures.push("Animal glow must start from an explicit color-preserving transparent shadow stack, never filter:none.");
}
if (glowClearDefinitions !== 6) {
  failures.push("Every scene and the default palette need a transparent version of their glow color.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log(`Animal hover keeps its alpha threshold at ${threshold} and transitions directly through its scene glow color.`);
