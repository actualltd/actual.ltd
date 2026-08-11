import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const animalDirectory = path.join(root, "site-public", "animals");
const galleryDirectory = path.join(animalDirectory, "gallery");
const previewDirectory = path.join(galleryDirectory, "previews");
const animals = [
  "01-oryx",
  "02-crane",
  "03-stag",
  "04-tiger",
  "05-thresher-shark",
];

await mkdir(previewDirectory, { recursive: true });

for (const animal of animals) {
  const cardName = animal === "05-thresher-shark" ? `${animal}-orange.webp` : `${animal}.webp`;
  const card = path.join(animalDirectory, "cards", cardName);
  const studyOne = path.join(galleryDirectory, `${animal}-study-01.webp`);
  const studyTwo = path.join(galleryDirectory, `${animal}-study-02.webp`);

  for (const [kind, source] of [["plate", card], ["study-01", studyOne], ["study-02", studyTwo]]) {
    await sharp(source)
      .resize(240, 160, { fit: "cover", position: "attention" })
      .webp({ quality: 64, effort: 6 })
      .toFile(path.join(previewDirectory, `${animal}-${kind}.webp`));
  }
}

console.log("Built previews for fifteen independent archive plates.");
