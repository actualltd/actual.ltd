import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const markup = await readFile(path.join(root, "index.html"), "utf8");
const ditherBuild = await readFile(path.join(root, "scripts/build-dither-posters.mjs"), "utf8");
const failures = [];

const renderScene = source.match(/async function renderScene[\s\S]*?\n}\n\nfunction randomIndex/)?.[0] ?? "";
const previewApply = renderScene.indexOf("applyScenePreview(");

if (previewApply < 0) {
  failures.push("NEXT must paint a cached low-resolution scene while full images and shader preparation continue separately.");
}

if (/await\s+Promise\.all\(\[\s*preload\(background\)[\s\S]*animalGlowController\.prepare/.test(renderScene)) {
  failures.push("NEXT still blocks its visible scene change on full-resolution downloads and glow preprocessing.");
}

if (!/const imageRequestCache\s*=\s*new Map/.test(source)
  || !/function warmSceneCache/.test(source)) {
  failures.push("Scene images need a shared in-memory request cache and idle prewarming.");
}

const previewSceneFunction = source.match(/function applyScenePreview[\s\S]*?\n}\n\nasync function upgradeSceneAssets/)?.[0] ?? "";
if (/populateAnimalCard/.test(previewSceneFunction)) {
  failures.push("Changing scenes cannot download the large card artwork before the card is opened.");
}

const upgradeSceneFunction = source.match(/async function upgradeSceneAssets[\s\S]*?\n}\n\nfunction populateAnimalCard/)?.[0] ?? "";
if (/animate\(\s*\[heroBackground,\s*heroAnimal\]/.test(upgradeSceneFunction)) {
  failures.push("The full-resolution upgrade cannot animate the same opacity tracks awaited by scene entrance; that leaves NEXT permanently switching.");
}

if (!/dataset\.resolution\s*=\s*["']preview["']/.test(source)
  || !/data-resolution=["']preview["']/.test(styles)
  || !/image-rendering:\s*pixelated/.test(styles)) {
  failures.push("The low-resolution scene must be visibly pixelated until its full asset is decoded.");
}

const previewKeys = ["previewPortrait", "previewLandscape", "previewAnimal"];
for (const key of previewKeys) {
  const count = source.match(new RegExp(`${key}:\\s*["'][^"']+["']`, "g"))?.length ?? 0;
  if (count !== 5) failures.push(`Expected five ${key} entries, found ${count}.`);
}

const animals = ["01-oryx", "02-crane", "03-stag", "04-tiger", "05-thresher-shark"];
for (const animal of animals) {
  for (const kind of ["portrait", "landscape", "cutout"]) {
    const file = path.join(root, "site-public", "animals", "previews", `${kind}-${animal}.webp`);
    try {
      await access(file);
      const { size } = await stat(file);
      if (size > 16_000) failures.push(`${path.basename(file)} is ${size} bytes; previews must stay under 16 KB.`);
    } catch {
      failures.push(`Missing low-resolution preview: ${path.basename(file)}.`);
    }
  }
}

if ((source.match(/cardImages:\s*cardImages\(/g) ?? []).length !== 5) {
  failures.push("Every animal must provide a three-image card archive.");
}

if ((markup.match(/data-animal-card-image=/g) ?? []).length !== 3) {
  failures.push("The animal card must expose three immediate thumbnail controls.");
}

if (!/function applyAnimalPlacement/.test(source)
  || !/resolveAnimalPlacement\(range, scene\.artwork, placementEntropy/.test(source)
  || !/placementEntropy\s*=\s*\{ left: randomUnit\(\), bottom: randomUnit\(\), width: randomUnit\(\) \}/.test(source)) {
  failures.push("Animal position and scale must stay art-directed and randomly varied inside silhouette-safe bounds.");
}

if (!/let sceneAdvancePending\s*=\s*false/.test(source)
  || /queuedSceneAdvances/.test(source)) {
  failures.push("Rapid NEXT input must coalesce to one pending scene instead of building an animation backlog.");
}

for (const animal of animals) {
  for (const kind of ["study-01", "study-02"]) {
    const study = path.join(root, "site-public", "animals", "gallery", `${animal}-${kind}.webp`);
    try {
      await access(study);
    } catch {
      failures.push(`Missing independent gallery study: ${path.basename(study)}.`);
    }
  }

  for (const kind of ["plate", "study-01", "study-02"]) {
    const file = path.join(root, "site-public", "animals", "gallery", "previews", `${animal}-${kind}.webp`);
    try {
      await access(file);
      const { size } = await stat(file);
      if (size > 32_000) failures.push(`${path.basename(file)} is ${size} bytes; gallery previews must stay under 32 KB.`);
    } catch {
      failures.push(`Missing gallery preview: ${path.basename(file)}.`);
    }
  }
}

const cardImagesFunction = source.match(/function cardImages[\s\S]*?\n}/)?.[0] ?? "";
if (/src:\s*`\/animals\/\$\{slug\}\.webp`/.test(cardImagesFunction)
  || /-detail\.webp/.test(cardImagesFunction)) {
  failures.push("The animal card gallery must use independent studies instead of hero-image crops or derived detail crops.");
}

const sharkDither = ditherBuild.match(/file:\s*"05-thresher-shark\.webp"[^\n]+/)?.[0] ?? "";
if (!/pattern:\s*"noise"/.test(sharkDither)
  || /pattern:\s*"diagonal"/.test(sharkDither)
  || !/color:\s*"d95622"/.test(sharkDither)) {
  failures.push("The thresher shark must use burnt orange with irregular noise, never the yellow diagonal dither.");
}

if (/sailfish/i.test(source + markup)) {
  failures.push("The field index still references the replaced sailfish scene.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log("NEXT paints cached pixel previews immediately, upgrades after decode, and never waits for glow preprocessing.");
