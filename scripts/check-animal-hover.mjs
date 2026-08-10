import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const thresholdMatch = source.match(/ANIMAL_HIT_ALPHA_THRESHOLD\s*=\s*(\d+)/);

if (!thresholdMatch) throw new Error("Animal alpha hit threshold must be explicit and testable.");

const threshold = Number(thresholdMatch[1]);
const residueCeiling = 143;
const cutouts = [
  "cutout-01-oryx.png",
  "cutout-02-crane.png",
  "cutout-03-stag.png",
  "cutout-04-tiger.png",
  "cutout-05-sailfish.png",
];

let hittableResiduePixels = 0;

for (const name of cutouts) {
  const input = path.join(root, "site-public/animals/posters", name);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const lowerBandStart = Math.floor(info.height * 0.68);

  for (let y = lowerBandStart; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha >= threshold && alpha <= residueCeiling) hittableResiduePixels += 1;
    }
  }
}

const failures = [];

if (hittableResiduePixels > 0) {
  failures.push(`${hittableResiduePixels.toLocaleString()} faint lower-edge pixels still trigger animal hover at alpha ${threshold}.`);
}

if (!/drop-shadow\(0 0 [^)]+#fff\)/.test(styles)) {
  failures.push("Animal hover needs a white inner halo so the glow remains visibly bright in every scene.");
}

const transitionMatch = styles.match(/\.animal-parallax\{[^}]*transition:filter\s+([\d.]+)s/);
if (!transitionMatch || Number(transitionMatch[1]) > 0.25) {
  failures.push("Animal glow must reach full brightness within 250ms.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log(`Animal hover rejects faint edge residue at alpha ${threshold} and always renders a bright inner halo.`);
