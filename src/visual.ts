export interface VisualState {
  index: number;
  code: string;
  label: string;
  line: string;
  title: string;
  artist: string;
  date: string;
  imageUrl: string;
  sourceLabel: string;
  sourceUrl: string;
}

export const VISUAL_STATES: readonly VisualState[] = [
  {
    index: 1,
    code: "001",
    label: "FORCE",
    line: "THE WORLD ARRIVES IN WAVES.",
    title: "THE GREAT WAVE",
    artist: "KATSUSHIKA HOKUSAI",
    date: "C. 1830–32",
    imageUrl: "/art/great-wave.jpg",
    sourceLabel: "3 SOURCES — OPEN ACCESS",
    sourceUrl: "/llms.txt",
  },
  {
    index: 2,
    code: "002",
    label: "MOTION",
    line: "TIME, MADE VISIBLE.",
    title: "HORSES. RUNNING",
    artist: "EADWEARD MUYBRIDGE",
    date: "C. 1881",
    imageUrl: "/art/horses-running.jpg",
    sourceLabel: "3 SOURCES — OPEN ACCESS",
    sourceUrl: "/llms.txt",
  },
  {
    index: 3,
    code: "003",
    label: "PRESENCE",
    line: "THE WORLD, MADE PRESENT.",
    title: "EARTHRISE",
    artist: "WILLIAM ANDERS / APOLLO 8",
    date: "24 DECEMBER 1968",
    imageUrl: "/art/earthrise.jpg",
    sourceLabel: "3 SOURCES — PUBLIC RELEASE",
    sourceUrl: "/llms.txt",
  },
] as const;

export interface VisualController {
  setMotionEnabled(enabled: boolean): void;
  setPointer(x: number, y: number): void;
  nextScene(): void;
  previousScene(): void;
  destroy(): void;
}

interface VisualOptions {
  motionEnabled: boolean;
  onStateChange: (state: VisualState) => void;
  onUnavailable: () => void;
  onAvailable?: () => void;
}

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

type LayerShape = "rect" | "ellipse" | "slant-left" | "slant-right";

interface Layer {
  x: number;
  y: number;
  width: number;
  height: number;
  crop: Crop;
  depth: number;
  opacity: number;
  paperWash?: number;
  rotation?: number;
  shape?: LayerShape;
}

type DitherTechnique = "halftone" | "diffusion";

interface MixedMediaSource {
  figureUrl: string;
  figureTechnique: DitherTechnique;
  figureInvert: boolean;
  objectUrl: string;
  objectTechnique: DitherTechnique;
  objectInvert: boolean;
}

interface PreparedMedia {
  figure: HTMLCanvasElement;
  object: HTMLCanvasElement;
}

const MIXED_MEDIA_SOURCES: readonly MixedMediaSource[] = [
  {
    figureUrl: "/art/sharaku.jpg",
    figureTechnique: "halftone",
    figureInvert: false,
    objectUrl: "/art/conch-trumpet.jpg",
    objectTechnique: "diffusion",
    objectInvert: false,
  },
  {
    figureUrl: "/art/spanish-dancer.jpg",
    figureTechnique: "halftone",
    figureInvert: false,
    objectUrl: "/art/chronometer-dial.jpg",
    objectTechnique: "diffusion",
    objectInvert: false,
  },
  {
    figureUrl: "/art/thinker.jpg",
    figureTechnique: "halftone",
    figureInvert: false,
    objectUrl: "/art/lunar-module.jpg",
    objectTechnique: "diffusion",
    objectInvert: true,
  },
] as const;

const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
] as const;

const INK = [17, 16, 14] as const;
const PAPER = [231, 224, 212] as const;
const FULL_IMAGE: Crop = { x: 0, y: 0, width: 1, height: 1 };
const FRAME_INTERVAL = 1000 / 24;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeInOut(value: number): number {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${url}`));
    image.src = url;
  });
}

function prepareDitheredAsset(
  image: HTMLImageElement,
  technique: DitherTechnique,
  invert: boolean,
): HTMLCanvasElement {
  const maximumWidth = 520;
  const scale = Math.min(1, maximumWidth / image.naturalWidth);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const source = document.createElement("canvas");
  const output = document.createElement("canvas");
  source.width = width;
  source.height = height;
  output.width = width;
  output.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const outputContext = output.getContext("2d");
  if (!sourceContext || !outputContext) return output;

  sourceContext.filter = "grayscale(1) contrast(1.34)";
  sourceContext.drawImage(image, 0, 0, width, height);
  const sourcePixels = sourceContext.getImageData(0, 0, width, height).data;

  if (technique === "halftone") {
    const cell = 7;
    outputContext.fillStyle = `rgb(${INK[0]} ${INK[1]} ${INK[2]})`;
    for (let y = 0; y < height; y += cell) {
      for (let x = 0; x < width; x += cell) {
        const sampleX = Math.min(width - 1, x + Math.floor(cell / 2));
        const sampleY = Math.min(height - 1, y + Math.floor(cell / 2));
        const offset = (sampleY * width + sampleX) * 4;
        const red = sourcePixels[offset] ?? 255;
        const green = sourcePixels[offset + 1] ?? 255;
        const blue = sourcePixels[offset + 2] ?? 255;
        const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
        const density = invert
          ? clamp((luminance - 0.56) * 2.35, 0, 1)
          : clamp((0.62 - luminance) * 2.1, 0, 1);
        const radius = Math.sqrt(density) * cell * 0.54;
        if (radius < 0.4) continue;
        outputContext.beginPath();
        outputContext.arc(x + cell / 2, y + cell / 2, radius, 0, Math.PI * 2);
        outputContext.fill();
      }
    }
    return output;
  }

  const tones = new Float32Array(width * height);
  for (let pixel = 0; pixel < tones.length; pixel += 1) {
    const offset = pixel * 4;
    const red = sourcePixels[offset] ?? 255;
    const green = sourcePixels[offset + 1] ?? 255;
    const blue = sourcePixels[offset + 2] ?? 255;
    const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
    const tone = invert ? 1 - luminance : luminance;
    tones[pixel] = clamp((tone - 0.5) * 1.28 + 0.5, 0, 1);
  }

  const outputPixels = outputContext.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldTone = tones[index] ?? 1;
      const newTone = oldTone < 0.5 ? 0 : 1;
      const error = oldTone - newTone;
      if (newTone === 0) {
        const offset = index * 4;
        outputPixels.data[offset] = INK[0];
        outputPixels.data[offset + 1] = INK[1];
        outputPixels.data[offset + 2] = INK[2];
        outputPixels.data[offset + 3] = 255;
      }
      if (x + 1 < width) tones[index + 1] = (tones[index + 1] ?? 0) + error * 7 / 16;
      if (y + 1 < height) {
        if (x > 0) tones[index + width - 1] = (tones[index + width - 1] ?? 0) + error * 3 / 16;
        tones[index + width] = (tones[index + width] ?? 0) + error * 5 / 16;
        if (x + 1 < width) tones[index + width + 1] = (tones[index + width + 1] ?? 0) + error / 16;
      }
    }
  }
  outputContext.putImageData(outputPixels, 0, 0);
  return output;
}

export function createVisual(container: HTMLElement, options: VisualOptions): VisualController {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  container.append(canvas);

  const context = canvas.getContext("2d", { alpha: false, desynchronized: true, willReadFrequently: true });
  const composition = document.createElement("canvas");
  const compositionContext = composition.getContext("2d", { alpha: false, willReadFrequently: true });

  if (!context || !compositionContext) {
    canvas.remove();
    container.classList.add("is-unavailable");
    options.onUnavailable();
    return {
      setMotionEnabled: () => undefined,
      setPointer: () => undefined,
      nextScene: () => undefined,
      previousScene: () => undefined,
      destroy: () => undefined,
    };
  }

  const images: HTMLImageElement[] = [];
  const preparedMedia: PreparedMedia[] = [];
  let motionEnabled = options.motionEnabled;
  let destroyed = false;
  let loaded = false;
  let frameRequest = 0;
  let lastFrameAt = 0;
  let activeStateIndex = 0;
  let previousStateIndex = 0;
  let transitionStartedAt = -Infinity;
  let pointerX = 0.5;
  let pointerY = 0.5;
  let pointerTargetX = 0.5;
  let pointerTargetY = 0.5;
  let elapsed = 0;
  let lastTime: number | undefined;

  const hasTransition = (time: number): boolean => time - transitionStartedAt < 960;

  const clipLayer = (ctx: CanvasRenderingContext2D, layer: Layer): void => {
    const { x, y, width, height } = layer;
    ctx.beginPath();
    if (layer.shape === "ellipse") {
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    } else if (layer.shape === "slant-left") {
      ctx.moveTo(x + width * 0.08, y);
      ctx.lineTo(x + width, y + height * 0.03);
      ctx.lineTo(x + width * 0.9, y + height);
      ctx.lineTo(x, y + height * 0.92);
      ctx.closePath();
    } else if (layer.shape === "slant-right") {
      ctx.moveTo(x, y + height * 0.05);
      ctx.lineTo(x + width * 0.92, y);
      ctx.lineTo(x + width, y + height * 0.9);
      ctx.lineTo(x + width * 0.08, y + height);
      ctx.closePath();
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.clip();
  };

  const drawLayer = (
    image: HTMLImageElement,
    layer: Layer,
    sceneAlpha: number,
    time: number,
    phase: number,
  ): void => {
    const pointerOffsetX = (pointerX - 0.5) * layer.depth * composition.width * 0.052;
    const pointerOffsetY = (pointerY - 0.5) * layer.depth * composition.height * 0.045;
    const driftX = motionEnabled ? Math.sin(time * 0.00013 + phase) * layer.depth * composition.width * 0.008 : 0;
    const driftY = motionEnabled ? Math.cos(time * 0.00011 + phase * 1.4) * layer.depth * composition.height * 0.007 : 0;
    const x = layer.x + pointerOffsetX + driftX;
    const y = layer.y + pointerOffsetY + driftY;
    const sourceX = layer.crop.x * image.naturalWidth;
    const sourceY = layer.crop.y * image.naturalHeight;
    const sourceWidth = layer.crop.width * image.naturalWidth;
    const sourceHeight = layer.crop.height * image.naturalHeight;

    compositionContext.save();
    compositionContext.globalAlpha = layer.opacity * sceneAlpha;
    compositionContext.filter = "grayscale(1) contrast(1.14)";
    compositionContext.translate(x + layer.width / 2, y + layer.height / 2);
    compositionContext.rotate(layer.rotation ?? 0);
    compositionContext.translate(-x - layer.width / 2, -y - layer.height / 2);
    clipLayer(compositionContext, { ...layer, x, y });
    compositionContext.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      layer.width,
      layer.height,
    );
    compositionContext.restore();
  };

  const drawWave = (alpha: number, time: number): void => {
    const image = images[0];
    const width = Math.min(composition.width * 0.72, composition.height * 1.25);
    const height = width * 0.675;
    const x = composition.width * 0.5 - width * 0.5;
    const y = composition.height * 0.47 - height * 0.5;

    const layers: Layer[] = [
      { x: x - width * 0.09, y: y + height * 0.02, width: width * 0.9, height: height * 0.9, crop: FULL_IMAGE, depth: 0.32, opacity: 0.22, rotation: -0.025, shape: "slant-left" },
      { x: x + width * 0.03, y: y - height * 0.04, width: width * 0.94, height: height * 0.94, crop: FULL_IMAGE, depth: 0.58, opacity: 0.8, rotation: 0.012, shape: "slant-right" },
      { x: x - width * 0.12, y: y + height * 0.01, width: width * 0.52, height: height * 0.72, crop: { x: 0.02, y: 0.06, width: 0.58, height: 0.82 }, depth: 1, opacity: 0.58, rotation: -0.018, shape: "slant-left" },
      { x: x + width * 0.55, y: y + height * 0.45, width: width * 0.31, height: height * 0.29, crop: { x: 0.48, y: 0.42, width: 0.32, height: 0.28 }, depth: 0.78, opacity: 0.64, rotation: 0.032, shape: "rect" },
    ];

    layers.forEach((layer, index) => drawLayer(image, layer, alpha, time, index * 1.9));
  };

  const horseCrop = (frame: number): Crop => {
    const column = frame % 5;
    const row = Math.floor(frame / 5) % 4;
    return {
      x: 0.247 + column * 0.108,
      y: 0.292 + row * 0.118,
      width: 0.099,
      height: 0.101,
    };
  };

  const drawHorses = (alpha: number, time: number): void => {
    const image = images[1];
    const width = Math.min(composition.width * 0.59, composition.height * 1.03);
    const height = width * 0.79;
    const x = composition.width * 0.5 - width * 0.5;
    const y = composition.height * 0.42 - height * 0.5;
    const frame = motionEnabled ? Math.floor(elapsed / 360) % 20 : 7;

    const layers: Layer[] = [
      { x: x - width * 0.08, y: y - height * 0.02, width: width * 0.89, height, crop: FULL_IMAGE, depth: 0.22, opacity: 0.24, rotation: -0.018, shape: "slant-right" },
      { x: x + width * 0.08, y: y + height * 0.02, width: width * 0.84, height: height * 0.83, crop: { x: 0.19, y: 0.2, width: 0.62, height: 0.58 }, depth: 0.5, opacity: 0.74, rotation: 0.009, shape: "rect" },
      { x: x - width * 0.1, y: y + height * 0.07, width: width * 0.31, height: height * 0.38, crop: horseCrop(frame), depth: 1, opacity: 0.74, rotation: -0.026, shape: "slant-left" },
      { x: x + width * 0.68, y: y + height * 0.5, width: width * 0.27, height: height * 0.33, crop: horseCrop((frame + 6) % 20), depth: 0.82, opacity: 0.68, rotation: 0.034, shape: "slant-right" },
      { x: x + width * 0.42, y: y - height * 0.1, width: width * 0.23, height: height * 0.28, crop: horseCrop((frame + 13) % 20), depth: 0.68, opacity: 0.5, rotation: -0.012, shape: "rect" },
    ];

    layers.forEach((layer, index) => drawLayer(image, layer, alpha, time, index * 1.4));
  };

  const drawEarthrise = (alpha: number, time: number): void => {
    const image = images[2];
    const width = Math.min(composition.width * 0.72, composition.height * 1.18);
    const height = width * 0.625;
    const x = composition.width * 0.5 - width * 0.5;
    const y = composition.height * 0.47 - height * 0.5;

    const layers: Layer[] = [
      { x: x - width * 0.06, y: y - height * 0.02, width: width * 0.96, height: height * 0.94, crop: FULL_IMAGE, depth: 0.15, opacity: 0.72, rotation: -0.012, shape: "slant-left" },
      { x: x + width * 0.53, y: y + height * 0.03, width: width * 0.34, height: height * 0.48, crop: { x: 0.44, y: 0.15, width: 0.28, height: 0.5 }, depth: 0.92, opacity: 0.78, rotation: 0.02, shape: "ellipse" },
      { x: x - width * 0.11, y: y + height * 0.62, width: width * 1.03, height: height * 0.3, crop: { x: 0, y: 0.67, width: 1, height: 0.3 }, depth: 1, opacity: 0.78, rotation: -0.016, shape: "slant-right" },
      { x: x + width * 0.03, y: y + height * 0.12, width: width * 0.48, height: height * 0.36, crop: { x: 0.32, y: 0.12, width: 0.5, height: 0.48 }, depth: 0.48, opacity: 0.32, rotation: 0.012, shape: "rect" },
    ];

    layers.forEach((layer, index) => drawLayer(image, layer, alpha, time, index * 2.1));
  };

  const drawScene = (sceneIndex: number, alpha: number, time: number): void => {
    if (sceneIndex === 0) drawWave(alpha, time);
    else if (sceneIndex === 1) drawHorses(alpha, time);
    else drawEarthrise(alpha, time);
  };

  const applyDither = (): void => {
    const frame = compositionContext.getImageData(0, 0, composition.width, composition.height);
    const pixels = frame.data;
    const width = composition.width;

    for (let offset = 0, pixel = 0; offset < pixels.length; offset += 4, pixel += 1) {
      const red = pixels[offset] ?? 255;
      const green = pixels[offset + 1] ?? 255;
      const blue = pixels[offset + 2] ?? 255;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const luminance = (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
      const tone = clamp((luminance - 0.055) / 0.9, 0, 1);
      const threshold = ((BAYER_8[(x & 7) + (y & 7) * 8] ?? 0) + 0.5) / 64;
      const usePaper = luminance > 0.985 || tone >= threshold;
      const color = usePaper ? PAPER : INK;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }

    context.putImageData(frame, 0, 0);
  };

  const drawPreparedLayer = (
    media: HTMLCanvasElement,
    layer: Layer,
    sceneAlpha: number,
    time: number,
    phase: number,
  ): void => {
    const pointerOffsetX = (pointerX - 0.5) * layer.depth * canvas.width * 0.075;
    const pointerOffsetY = (pointerY - 0.5) * layer.depth * canvas.height * 0.055;
    const driftX = motionEnabled ? Math.sin(time * 0.00016 + phase) * layer.depth * canvas.width * 0.012 : 0;
    const driftY = motionEnabled ? Math.cos(time * 0.00012 + phase * 1.3) * layer.depth * canvas.height * 0.009 : 0;
    const x = layer.x + pointerOffsetX + driftX;
    const y = layer.y + pointerOffsetY + driftY;
    const sourceX = layer.crop.x * media.width;
    const sourceY = layer.crop.y * media.height;
    const sourceWidth = layer.crop.width * media.width;
    const sourceHeight = layer.crop.height * media.height;

    context.save();
    context.translate(x + layer.width / 2, y + layer.height / 2);
    context.rotate(layer.rotation ?? 0);
    context.translate(-x - layer.width / 2, -y - layer.height / 2);
    clipLayer(context, { ...layer, x, y });
    context.globalAlpha = sceneAlpha * (layer.paperWash ?? 0.14);
    context.fillStyle = `rgb(${PAPER[0]} ${PAPER[1]} ${PAPER[2]})`;
    context.fillRect(x, y, layer.width, layer.height);
    context.globalAlpha = sceneAlpha * layer.opacity;
    context.drawImage(
      media,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      layer.width,
      layer.height,
    );
    context.restore();
  };

  const drawEffectLayer = (sceneIndex: number, alpha: number, time: number): void => {
    const width = canvas.width;
    const height = canvas.height;
    const compact = height > width * 1.35;
    const driftX = (pointerX - 0.5) * width * 0.05 + (motionEnabled ? Math.sin(time * 0.00018) * width * 0.008 : 0);
    const driftY = (pointerY - 0.5) * height * 0.035 + (motionEnabled ? Math.cos(time * 0.00015) * height * 0.006 : 0);

    context.save();
    context.translate(driftX, driftY);
    context.globalAlpha = alpha * 0.42;
    context.strokeStyle = `rgb(${INK[0]} ${INK[1]} ${INK[2]})`;
    context.fillStyle = `rgb(${INK[0]} ${INK[1]} ${INK[2]})`;
    context.lineWidth = 0.7;
    context.font = `${Math.max(6, width * 0.009)}px "Geist Mono Variable", monospace`;

    if (sceneIndex === 0) {
      const centerX = width * 0.69;
      const centerY = height * (compact ? 0.39 : 0.34);
      for (let ring = 0; ring < 5; ring += 1) {
        context.beginPath();
        context.ellipse(
          centerX,
          centerY,
          width * (0.09 + ring * 0.025),
          (compact ? width : height) * (0.055 + ring * 0.016),
          -0.42,
          Math.PI * 0.16,
          Math.PI * 1.82,
        );
        context.stroke();
      }
      context.globalAlpha = alpha * 0.32;
      context.fillText(".  :  *  %  ~  ~", width * 0.12, height * (compact ? 0.47 : 0.22));
      context.fillText("~  ~  %  *  :  .", width * 0.58, height * (compact ? 0.31 : 0.57));
    } else if (sceneIndex === 1) {
      context.setLineDash([2, 5]);
      const top = height * (compact ? 0.29 : 0.16);
      const bottom = height * (compact ? 0.54 : 0.63);
      for (let line = 0; line < 7; line += 1) {
        const x = width * (0.18 + line * 0.105);
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x, bottom);
        context.stroke();
        context.fillText(String(line + 1).padStart(2, "0"), x - 4, top - 6);
      }
      context.setLineDash([]);
      context.globalAlpha = alpha * 0.24;
      for (let line = 0; line < 4; line += 1) {
        const y = top + (bottom - top) * (line / 3);
        context.fillRect(width * 0.13, y, width * 0.74, 1);
      }
    } else {
      const centerX = width * 0.58;
      const centerY = height * (compact ? 0.39 : 0.34);
      context.setLineDash([4, 5]);
      for (let orbit = 0; orbit < 3; orbit += 1) {
        context.beginPath();
        context.ellipse(
          centerX,
          centerY,
          width * (0.15 + orbit * 0.07),
          (compact ? width : height) * (0.07 + orbit * 0.045),
          -0.2 + orbit * 0.16,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(centerX - width * 0.045, centerY);
      context.lineTo(centerX + width * 0.045, centerY);
      context.moveTo(centerX, centerY - width * 0.045);
      context.lineTo(centerX, centerY + width * 0.045);
      context.stroke();
      context.globalAlpha = alpha * 0.34;
      context.fillText("LAT 00.0 / LON 00.0", width * 0.13, height * (compact ? 0.53 : 0.58));
    }

    context.restore();
  };

  const drawMixedMedia = (sceneIndex: number, alpha: number, time: number): void => {
    const media = preparedMedia[sceneIndex];
    if (!media || alpha <= 0.001) return;
    const width = canvas.width;
    const height = canvas.height;
    const compact = height > width * 1.35;
    let figure: Layer;
    let object: Layer;

    if (compact) {
      if (sceneIndex === 0) {
        figure = { x: width * 0.12, y: height * 0.27, width: width * 0.26, height: width * 0.55, crop: FULL_IMAGE, depth: 1.12, opacity: 0.94, rotation: -0.025, shape: "slant-left" };
        object = { x: width * 0.64, y: height * 0.32, width: width * 0.23, height: width * 0.31, crop: FULL_IMAGE, depth: 1.58, opacity: 0.88, rotation: 0.075, shape: "ellipse" };
      } else if (sceneIndex === 1) {
        figure = { x: width * 0.61, y: height * 0.27, width: width * 0.27, height: width * 0.53, crop: FULL_IMAGE, depth: 1.18, opacity: 0.94, rotation: 0.018, shape: "slant-right" };
        object = { x: width * 0.12, y: height * 0.32, width: width * 0.25, height: width * 0.25, crop: FULL_IMAGE, depth: 1.62, opacity: 0.9, rotation: -0.055, shape: "ellipse" };
      } else {
        figure = { x: width * 0.11, y: height * 0.31, width: width * 0.33, height: width * 0.45, crop: FULL_IMAGE, depth: 1.2, opacity: 0.96, paperWash: 0.58, rotation: -0.02, shape: "slant-left" };
        object = { x: width * 0.61, y: height * 0.3, width: width * 0.28, height: width * 0.28, crop: { x: 0.28, y: 0.18, width: 0.62, height: 0.62 }, depth: 1.7, opacity: 0.94, rotation: 0.035, shape: "ellipse" };
      }
    } else if (sceneIndex === 0) {
      figure = { x: width * 0.18, y: height * 0.1, width: width * 0.22, height: height * 0.62, crop: FULL_IMAGE, depth: 1.12, opacity: 0.94, rotation: -0.025, shape: "slant-left" };
      object = { x: width * 0.68, y: height * 0.24, width: width * 0.18, height: height * 0.34, crop: FULL_IMAGE, depth: 1.58, opacity: 0.88, rotation: 0.075, shape: "ellipse" };
    } else if (sceneIndex === 1) {
      figure = { x: width * 0.62, y: height * 0.09, width: width * 0.21, height: height * 0.63, crop: FULL_IMAGE, depth: 1.18, opacity: 0.94, rotation: 0.018, shape: "slant-right" };
      object = { x: width * 0.16, y: height * 0.22, width: width * 0.2, height: height * 0.32, crop: FULL_IMAGE, depth: 1.62, opacity: 0.9, rotation: -0.055, shape: "ellipse" };
    } else {
      figure = { x: width * 0.16, y: height * 0.2, width: width * 0.29, height: height * 0.49, crop: FULL_IMAGE, depth: 1.2, opacity: 0.96, paperWash: 0.58, rotation: -0.02, shape: "slant-left" };
      object = { x: width * 0.62, y: height * 0.17, width: width * 0.25, height: height * 0.36, crop: { x: 0.28, y: 0.18, width: 0.62, height: 0.62 }, depth: 1.7, opacity: 0.94, rotation: 0.035, shape: "ellipse" };
    }

    drawPreparedLayer(media.figure, figure, alpha, time, sceneIndex * 1.7 + 0.8);
    drawPreparedLayer(media.object, object, alpha, time, sceneIndex * 1.7 + 2.4);
    drawEffectLayer(sceneIndex, alpha, time);
  };

  const render = (time: number): void => {
    if (!loaded || destroyed) return;
    compositionContext.save();
    compositionContext.setTransform(1, 0, 0, 1, 0, 0);
    compositionContext.filter = "none";
    compositionContext.globalAlpha = 1;
    compositionContext.fillStyle = "#ffffff";
    compositionContext.fillRect(0, 0, composition.width, composition.height);

    let previousAlpha = 0;
    let activeAlpha = 1;
    if (hasTransition(time)) {
      const progress = easeInOut(clamp((time - transitionStartedAt) / 960, 0, 1));
      previousAlpha = 1 - progress;
      activeAlpha = progress;
      drawScene(previousStateIndex, previousAlpha, time);
      drawScene(activeStateIndex, activeAlpha, time);
    } else {
      drawScene(activeStateIndex, 1, time);
    }

    compositionContext.restore();
    applyDither();
    if (previousAlpha > 0.001) drawMixedMedia(previousStateIndex, previousAlpha, time);
    drawMixedMedia(activeStateIndex, activeAlpha, time);
  };

  const needsInteractionFrame = (): boolean =>
    Math.abs(pointerX - pointerTargetX) > 0.0006 || Math.abs(pointerY - pointerTargetY) > 0.0006;

  const scheduleFrame = (): void => {
    if (frameRequest === 0 && loaded && !destroyed && !document.hidden) {
      frameRequest = window.requestAnimationFrame(onFrame);
    }
  };

  function onFrame(time: number): void {
    frameRequest = 0;
    if (destroyed || document.hidden || !loaded) {
      lastTime = undefined;
      return;
    }

    if (lastTime !== undefined && motionEnabled) elapsed += Math.min(time - lastTime, 50);
    lastTime = time;
    pointerX += (pointerTargetX - pointerX) * 0.075;
    pointerY += (pointerTargetY - pointerY) * 0.075;

    const transitioning = hasTransition(time);
    if (time - lastFrameAt >= FRAME_INTERVAL || transitioning || needsInteractionFrame()) {
      render(time);
      lastFrameAt = time;
    }

    if (motionEnabled || transitioning || needsInteractionFrame()) scheduleFrame();
    else lastTime = undefined;
  }

  const goToScene = (nextIndex: number): void => {
    if (destroyed || nextIndex === activeStateIndex) return;
    previousStateIndex = activeStateIndex;
    activeStateIndex = (nextIndex + VISUAL_STATES.length) % VISUAL_STATES.length;
    transitionStartedAt = performance.now();
    options.onStateChange(VISUAL_STATES[activeStateIndex]);
    scheduleFrame();
  };

  const resize = (): void => {
    if (destroyed) return;
    const bounds = container.getBoundingClientRect();
    const renderWidth = Math.round(clamp(bounds.width * 0.52, 340, 740));
    const renderHeight = Math.max(1, Math.round(renderWidth * (bounds.height / Math.max(bounds.width, 1))));
    if (canvas.width === renderWidth && canvas.height === renderHeight) return;
    canvas.width = renderWidth;
    canvas.height = renderHeight;
    composition.width = renderWidth;
    composition.height = renderHeight;
    context.imageSmoothingEnabled = false;
    compositionContext.imageSmoothingEnabled = true;
    render(performance.now());
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const handleVisibilityChange = (): void => {
    lastTime = undefined;
    if (document.hidden) {
      if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    } else {
      render(performance.now());
      scheduleFrame();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  resize();
  options.onStateChange(VISUAL_STATES[0]);

  const imageUrls = [
    ...VISUAL_STATES.map((state) => state.imageUrl),
    ...MIXED_MEDIA_SOURCES.flatMap((source) => [source.figureUrl, source.objectUrl]),
  ];

  void Promise.all(imageUrls.map((url) => loadImage(url)))
    .then((loadedImages) => {
      if (destroyed) return;
      images.push(...loadedImages.slice(0, VISUAL_STATES.length));
      MIXED_MEDIA_SOURCES.forEach((source, index) => {
        const figure = loadedImages[VISUAL_STATES.length + index * 2];
        const object = loadedImages[VISUAL_STATES.length + index * 2 + 1];
        if (!figure || !object) throw new Error(`Missing mixed-media assets for scene ${index + 1}`);
        preparedMedia.push({
          figure: prepareDitheredAsset(figure, source.figureTechnique, source.figureInvert),
          object: prepareDitheredAsset(object, source.objectTechnique, source.objectInvert),
        });
      });
      loaded = true;
      container.classList.remove("is-unavailable");
      container.classList.add("is-ready");
      options.onAvailable?.();
      resize();
      render(performance.now());
      scheduleFrame();
    })
    .catch(() => {
      if (destroyed) return;
      container.classList.add("is-unavailable");
      options.onUnavailable();
    });

  return {
    setMotionEnabled(enabled: boolean): void {
      if (destroyed || motionEnabled === enabled) return;
      motionEnabled = enabled;
      lastTime = undefined;
      render(performance.now());
      scheduleFrame();
    },

    setPointer(x: number, y: number): void {
      if (destroyed) return;
      pointerTargetX = clamp(x, 0, 1);
      pointerTargetY = clamp(y, 0, 1);
      scheduleFrame();
    },

    nextScene(): void {
      goToScene(activeStateIndex + 1);
    },

    previousScene(): void {
      goToScene(activeStateIndex - 1);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      container.classList.remove("is-ready");
      canvas.remove();
    },
  };
}
