import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(root, "site-public", "animals");
const outputDir = join(sourceDir, "posters");
mkdirSync(outputDir, { recursive: true });

const bayer8 = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

const scenes = [
  { file: "01-oryx.webp", slug: "01-oryx", color: "114bc6", crop: "1060:960:80:38", key: 0.24 },
  { file: "02-crane.webp", slug: "02-crane", color: "e52e14", crop: "920:980:610:0", key: 0.23 },
  { file: "03-stag.webp", slug: "03-stag", color: "6038c4", crop: "980:1000:280:24", key: 0.22 },
  { file: "04-tiger.webp", slug: "04-tiger", color: "05a159", crop: "1500:800:18:170", key: 0.24 },
  { file: "05-sailfish.webp", slug: "05-sailfish", color: "ee9704", crop: "1020:850:0:105", key: 0.23 },
];

function hexToRgb(hex) {
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function writeDitheredPoster(path, width, height, hex, startRatio, endRatio) {
  const color = hexToRgb(hex);
  const pixels = Buffer.allocUnsafe(width * height * 3);
  const start = height * startRatio;
  const end = height * endRatio;
  const cell = 2;
  let offset = 0;

  for (let y = 0; y < height; y += 1) {
    const coverage = smoothstep((y - start) / (end - start));
    for (let x = 0; x < width; x += 1) {
      const threshold = (bayer8[Math.floor(y / cell) % 8][Math.floor(x / cell) % 8] + 0.5) / 64;
      const useColor = coverage >= threshold;
      pixels[offset++] = useColor ? color[0] : 255;
      pixels[offset++] = useColor ? color[1] : 255;
      pixels[offset++] = useColor ? color[2] : 255;
    }
  }

  const ppm = `${path}.ppm`;
  writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", ppm, "-frames:v", "1", "-compression_level", "9", path]);
  rmSync(ppm);
}

for (const scene of scenes) {
  writeDitheredPoster(join(outputDir, `portrait-${scene.slug}.png`), 1080, 1920, scene.color, 0.28, 0.48);
  writeDitheredPoster(join(outputDir, `landscape-${scene.slug}.png`), 1920, 1080, scene.color, 0.24, 0.52);

  execFileSync("ffmpeg", [
    "-y",
    "-loglevel", "error",
    "-i", join(sourceDir, scene.file),
    "-vf", `format=rgba,colorkey=0x${scene.color}:${scene.key}:0.08,crop=${scene.crop}`,
    "-frames:v", "1",
    join(outputDir, `cutout-${scene.slug}.png`),
  ]);
}

console.log(`Built dither posters and animal cutouts in ${basename(outputDir)}/`);
