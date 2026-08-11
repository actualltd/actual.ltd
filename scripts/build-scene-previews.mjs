import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const posterDirectory = path.join(root, "site-public", "animals", "posters");
const outputDirectory = path.join(root, "site-public", "animals", "previews");
const animals = ["01-oryx", "02-crane", "03-stag", "04-tiger", "05-thresher-shark"];

await mkdir(outputDirectory, { recursive: true });

for (const animal of animals) {
  for (const kind of ["portrait", "landscape"]) {
    await sharp(path.join(posterDirectory, `${kind}-${animal}.png`))
      .resize({ width: 64, withoutEnlargement: true })
      .webp({ quality: 42, effort: 6 })
      .toFile(path.join(outputDirectory, `${kind}-${animal}.webp`));
  }

  await sharp(path.join(posterDirectory, `cutout-${animal}.png`))
    .resize({ width: 112, withoutEnlargement: true })
    .webp({ quality: 48, alphaQuality: 72, effort: 6 })
    .toFile(path.join(outputDirectory, `cutout-${animal}.webp`));
}

console.log("Built 15 cached scene previews.");
