import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const files = [
  "site-public/animals/cards/05-thresher-shark-orange.webp",
  "site-public/animals/gallery/05-thresher-shark-study-01.webp",
  "site-public/animals/gallery/05-thresher-shark-study-02.webp",
  "site-public/animals/gallery/previews/05-thresher-shark-plate.webp",
  "site-public/animals/gallery/previews/05-thresher-shark-study-01.webp",
  "site-public/animals/gallery/previews/05-thresher-shark-study-02.webp",
];

function hue(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const raw = max === r
    ? ((g - b) / delta) % 6
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  return (raw * 60 + 360) % 360;
}

async function cornerColor(file) {
  const image = sharp(file);
  const { width, height } = await image.metadata();
  const size = Math.max(4, Math.min(48, Math.floor(Math.min(width, height) * 0.08)));
  const corners = [
    [0, 0],
    [width - size, 0],
    [0, height - size],
    [width - size, height - size],
  ];
  const channels = [0, 0, 0];
  for (const [left, top] of corners) {
    const { data } = await sharp(file)
      .extract({ left, top, width: size, height: size })
      .resize(1, 1)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    channels[0] += data[0];
    channels[1] += data[1];
    channels[2] += data[2];
  }
  return channels.map((channel) => Math.round(channel / corners.length));
}

if (!/05-thresher-shark-orange\.webp/.test(source)) {
  throw new Error("The shark card must use the corrected burnt-orange archive plate.");
}

for (const relative of files) {
  const file = path.join(root, relative);
  await access(file);
  const [red, green, blue] = await cornerColor(file);
  const angle = hue(red, green, blue);
  if (angle > 25 || red <= green || green <= blue) {
    throw new Error(`${path.basename(file)} still reads as yellow instead of burnt orange: rgb(${red}, ${green}, ${blue}), hue ${angle.toFixed(1)}°.`);
  }
}

console.log("All shark card plates and previews use the same burnt-orange color family.");
