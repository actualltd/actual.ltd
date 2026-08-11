import { mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDir = join(root, "source-assets", "animals");
const outputDir = join(root, "site-public", "animals", "posters");
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

const cluster8 = (() => {
  const points = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const dx = Math.min(Math.abs(x - 3.5), 8 - Math.abs(x - 3.5));
      const dy = Math.min(Math.abs(y - 3.5), 8 - Math.abs(y - 3.5));
      points.push({ x, y, distance: dx * dx + dy * dy });
    }
  }
  points.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const matrix = Array.from({ length: 8 }, () => Array(8).fill(0));
  points.forEach((point, rank) => { matrix[point.y][point.x] = rank; });
  return matrix;
})();

const scenes = [
  {
    file: "01-oryx.webp", slug: "01-oryx", color: "114bc6", pattern: "bayer", cell: 3,
    crop: { left: 80, top: 38, width: 1060, height: 960 }, supportY: 800, supportSpread: 1, cutBottom: 908,
    palette: ["f8edcf", "dfa32f", "142240"],
  },
  {
    file: "02-crane.webp", slug: "02-crane", color: "e52e14", pattern: "floyd", cell: 2,
    crop: { left: 610, top: 0, width: 920, height: 980 }, supportY: 750, supportSpread: 2,
    palette: ["f4ead3", "a9a08e", "242b2b"],
  },
  {
    file: "03-stag.webp", slug: "03-stag", color: "6038c4", pattern: "micrograin", cell: 1,
    crop: { left: 280, top: 24, width: 980, height: 1000 },
    palette: ["fff0c9", "d9c8c5", "5d3aa5"],
  },
  {
    file: "04-tiger.webp", slug: "04-tiger", color: "05a159", pattern: "softgrain", cell: 1,
    crop: { left: 18, top: 170, width: 1500, height: 800 }, greenGroundCleanupY: 620,
    palette: ["f2a33d", "f5e6c4", "152c28"],
  },
  {
    file: "05-thresher-shark.webp", slug: "05-thresher-shark", color: "d95622", sourceColor: "ee9704", pattern: "noise", cell: 2,
    crop: { left: 70, top: 80, width: 1420, height: 840 },
    palette: ["0a315f", "166ca0", "e9d4a3"],
  },
];

function hexToRgb(hex) {
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function hashThreshold(x, y, seed = 0) {
  let value = Math.imul(x + seed * 101, 374761393) + Math.imul(y + seed * 37, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function patternThreshold(scene, x, y) {
  const px = Math.floor(x / scene.cell);
  const py = Math.floor(y / scene.cell);
  if (scene.pattern === "cluster") return (cluster8[py % 8][px % 8] + 0.5) / 64;
  if (scene.pattern === "diagonal") return (((px + py * 3) % 16) + 0.5) / 16;
  if (scene.pattern === "micrograin") return hashThreshold(px, py, 31);
  if (scene.pattern === "softgrain") {
    const fine = hashThreshold(px, py, 47);
    const soft = hashThreshold(Math.floor(px / 5), Math.floor(py / 5), 53);
    return Math.min(1, Math.max(0, fine * 0.82 + soft * 0.18));
  }
  if (scene.pattern === "noise" || scene.pattern === "floyd") return hashThreshold(px, py, scenes.indexOf(scene) + 1);
  return (bayer8[py % 8][px % 8] + 0.5) / 64;
}

async function writeDitheredPoster(path, width, height, scene, startRatio, endRatio) {
  const color = hexToRgb(scene.color);
  const pixels = Buffer.allocUnsafe(width * height * 3);
  const start = height * startRatio;
  const end = height * endRatio;

  if (scene.pattern === "floyd") {
    let error = new Float32Array(width + 2);
    for (let y = 0; y < height; y += 1) {
      const nextError = new Float32Array(width + 2);
      const coverage = smoothstep((y - start) / (end - start));
      for (let x = 0; x < width; x += 1) {
        const value = Math.min(1, Math.max(0, coverage + error[x + 1]));
        const useColor = value >= 0.5;
        const quantizationError = value - (useColor ? 1 : 0);
        error[x + 2] += quantizationError * 7 / 16;
        nextError[x] += quantizationError * 3 / 16;
        nextError[x + 1] += quantizationError * 5 / 16;
        nextError[x + 2] += quantizationError / 16;
        const offset = (y * width + x) * 3;
        pixels[offset] = useColor ? color[0] : 255;
        pixels[offset + 1] = useColor ? color[1] : 255;
        pixels[offset + 2] = useColor ? color[2] : 255;
      }
      error = nextError;
    }
  } else {
    for (let y = 0; y < height; y += 1) {
      const coverage = smoothstep((y - start) / (end - start));
      for (let x = 0; x < width; x += 1) {
        const useColor = coverage >= patternThreshold(scene, x, y);
        const offset = (y * width + x) * 3;
        pixels[offset] = useColor ? color[0] : 255;
        pixels[offset + 1] = useColor ? color[1] : 255;
        pixels[offset + 2] = useColor ? color[2] : 255;
      }
    }
  }

  await sharp(pixels, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9, palette: true }).toFile(path);
}

function retainLargestComponent(alpha, width, height) {
  const size = width * height;
  const labels = new Int32Array(size);
  const queue = new Int32Array(size);
  let nextLabel = 0;
  let largestLabel = 0;
  let largestSize = 0;

  for (let start = 0; start < size; start += 1) {
    if (alpha[start] === 0 || labels[start] !== 0) continue;
    nextLabel += 1;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    labels[start] = nextLabel;
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (alpha[neighbor] === 0 || labels[neighbor] !== 0) continue;
          labels[neighbor] = nextLabel;
          queue[tail++] = neighbor;
        }
      }
    }
    if (tail > largestSize) {
      largestSize = tail;
      largestLabel = nextLabel;
    }
  }

  for (let index = 0; index < size; index += 1) {
    if (labels[index] !== largestLabel) alpha[index] = 0;
  }
}

function removeUnsupportedGround(alpha, width, height, startY, spread) {
  if (startY === undefined) return;
  for (let y = startY; y < height; y += 1) {
    const previous = alpha.slice((y - 1) * width, y * width);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (alpha[index] === 0) continue;
      let supported = false;
      for (let dx = -spread; dx <= spread; dx += 1) {
        const px = x + dx;
        if (px >= 0 && px < width && previous[px] > 0) {
          supported = true;
          break;
        }
      }
      if (!supported) alpha[index] = 0;
    }
  }
}

function applySceneCleanup(alpha, width, height, scene) {
  const contourLimit = (x) => {
    if (!scene.bottomContour) return undefined;
    for (let index = 1; index < scene.bottomContour.length; index += 1) {
      const [x1, y1] = scene.bottomContour[index - 1];
      const [x2, y2] = scene.bottomContour[index];
      if (x <= x2) return y1 + (y2 - y1) * ((x - x1) / Math.max(1, x2 - x1));
    }
    return scene.bottomContour.at(-1)[1];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (scene.cutBottom !== undefined && y > scene.cutBottom) alpha[index] = 0;
      const limit = contourLimit(x);
      if (limit !== undefined && y > limit) alpha[index] = 0;
      if (scene.eraseRegions?.some((region) => x >= region.left && x < region.right && y > region.top)) alpha[index] = 0;
    }
  }
}

function removeGreenGround(data, alpha, width, height, startY) {
  if (startY === undefined) return;
  for (let y = startY; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (alpha[pixel] === 0) continue;
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (green > red * 1.35 && green > blue * 1.18) alpha[pixel] = 0;
    }
  }
}

function ditherAnimal(data, alpha, width, height, scene) {
  const palette = scene.palette.map(hexToRgb);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const sourceOffset = pixel * 4;
      const threshold = patternThreshold(scene, x, y);
      if (alpha[pixel] / 255 < threshold) {
        data[sourceOffset + 3] = 0;
        continue;
      }

      const source = [data[sourceOffset], data[sourceOffset + 1], data[sourceOffset + 2]];
      const ranked = palette.map((color, index) => ({
        color,
        index,
        distance: (source[0] - color[0]) ** 2 + (source[1] - color[1]) ** 2 + (source[2] - color[2]) ** 2,
      })).sort((a, b) => a.distance - b.distance);
      const first = ranked[0];
      const second = ranked[1];
      const secondWeight = first.distance / Math.max(1, first.distance + second.distance);
      const chosen = threshold < secondWeight ? second.color : first.color;
      data[sourceOffset] = chosen[0];
      data[sourceOffset + 1] = chosen[1];
      data[sourceOffset + 2] = chosen[2];
      data[sourceOffset + 3] = 255;
    }
  }
}

async function writeAnimalCutout(scene) {
  const background = hexToRgb(scene.sourceColor ?? scene.color);
  const { data, info } = await sharp(join(sourceDir, scene.file))
    .extract(scene.crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);

  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const offset = pixel * 4;
    const distance = Math.hypot(
      data[offset] - background[0],
      data[offset + 1] - background[1],
      data[offset + 2] - background[2],
    );
    const matte = Math.round(255 * smoothstep((distance - 27) / 43));
    alpha[pixel] = matte < 64 ? 0 : matte;
  }

  retainLargestComponent(alpha, info.width, info.height);
  removeUnsupportedGround(alpha, info.width, info.height, scene.supportY, scene.supportSpread ?? 4);
  removeGreenGround(data, alpha, info.width, info.height, scene.greenGroundCleanupY);
  applySceneCleanup(alpha, info.width, info.height, scene);
  retainLargestComponent(alpha, info.width, info.height);
  ditherAnimal(data, alpha, info.width, info.height, scene);

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(outputDir, `cutout-${scene.slug}.png`));
}

for (const scene of scenes) {
  await writeDitheredPoster(join(outputDir, `portrait-${scene.slug}.png`), 1080, 1920, scene, 0.10, 0.34);
  await writeDitheredPoster(join(outputDir, `landscape-${scene.slug}.png`), 1920, 1080, scene, 0.08, 0.36);
  await writeAnimalCutout(scene);
}

console.log(`Built five distinct dither systems and clean animal cutouts in ${basename(outputDir)}/`);
