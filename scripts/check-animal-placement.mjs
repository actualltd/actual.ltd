import { resolveAnimalPlacement } from "../src/scene-placement.ts";

const scenes = [
  {
    ranges: {
      landscape: { left: [1, 14], bottom: [-4, 3], width: [76, 92] },
      portrait: { left: [-18, 4], bottom: [2, 10], width: [116, 136] },
    },
    artwork: { aspectRatio: 0.9057, alpha: { left: 0.0453, top: 0.025, right: 0.8679, bottom: 0.9469 } },
  },
  {
    ranges: {
      landscape: { left: [31, 44], bottom: [-6, 2], width: [55, 68] },
      portrait: { left: [-6, 15], bottom: [0, 8], width: [94, 114] },
    },
    artwork: { aspectRatio: 1.0652, alpha: { left: 0.0587, top: 0.0102, right: 0.95, bottom: 0.8806 } },
  },
  {
    ranges: {
      landscape: { left: [13, 32], bottom: [-8, 1], width: [53, 70] },
      portrait: { left: [-15, 8], bottom: [-4, 4], width: [104, 124] },
    },
    artwork: { aspectRatio: 1.0204, alpha: { left: 0.0612, top: 0.047, right: 0.9347, bottom: 1 } },
  },
  {
    ranges: {
      landscape: { left: [-4, 10], bottom: [-4, 2], width: [86, 102] },
      portrait: { left: [-8, 10], bottom: [5, 13], width: [94, 114] },
    },
    artwork: { aspectRatio: 0.5333, alpha: { left: 0.0373, top: 0.0512, right: 0.9833, bottom: 0.9437 } },
  },
  {
    ranges: {
      landscape: { left: [-15, 12], bottom: [-1, 9], width: [74, 96] },
      portrait: { left: [-34, -6], bottom: [3, 12], width: [120, 146] },
    },
    artwork: { aspectRatio: 0.5915, alpha: { left: 0.0176, top: 0.0524, right: 0.9838, bottom: 0.9595 } },
  },
];

const viewports = [
  { width: 390, height: 844, layout: "portrait" },
  { width: 844, height: 390, layout: "landscape" },
  { width: 1440, height: 900, layout: "landscape" },
];
const entropyValues = [0, 0.5, 1];

for (const [sceneIndex, scene] of scenes.entries()) {
  for (const viewport of viewports) {
    for (const left of entropyValues) {
      for (const bottom of entropyValues) {
        for (const widthEntropy of entropyValues) {
          const placement = resolveAnimalPlacement(
            scene.ranges[viewport.layout],
            scene.artwork,
            { left, bottom, width: widthEntropy },
            viewport,
          );
          const elementHeight = placement.width * viewport.width / viewport.height * scene.artwork.aspectRatio;
          const visible = {
            left: placement.left + scene.artwork.alpha.left * placement.width,
            right: placement.left + scene.artwork.alpha.right * placement.width,
            top: 100 - placement.bottom - (1 - scene.artwork.alpha.top) * elementHeight,
            bottom: 100 - placement.bottom - (1 - scene.artwork.alpha.bottom) * elementHeight,
          };
          if (visible.left < -0.01 || visible.right > 100.01 || visible.top < -0.01 || visible.bottom > 100.01) {
            throw new Error(`Scene ${sceneIndex} escapes ${viewport.width}x${viewport.height}: ${JSON.stringify(visible)}`);
          }
        }
      }
    }
  }
}

console.log("All five randomized animal silhouettes remain fully visible in desktop, portrait, and short landscape viewports.");
