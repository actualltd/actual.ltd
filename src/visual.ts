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
  setScene(index: number): void;
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
const SCENE_TRANSITION_MS = 960;

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

  sourceContext.filter = "grayscale(1) contrast(1.18)";
  sourceContext.drawImage(image, 0, 0, width, height);
  const sourcePixels = sourceContext.getImageData(0, 0, width, height).data;

  if (technique === "halftone") {
    const cell = 8;
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
          ? clamp((luminance - 0.6) * 1.85, 0, 1)
          : clamp((0.57 - luminance) * 1.7, 0, 1);
        const radius = Math.sqrt(density) * cell * 0.5;
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
    tones[pixel] = clamp((tone - 0.5) * 1.08 + 0.5, 0, 1);
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
      setScene: () => undefined,
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
  let elapsed = 0;
  let lastTime: number | undefined;

  const hasTransition = (time: number): boolean => time - transitionStartedAt < SCENE_TRANSITION_MS;

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
    const driftX = motionEnabled ? Math.sin(time * 0.00013 + phase) * layer.depth * composition.width * 0.0025 : 0;
    const driftY = motionEnabled ? Math.cos(time * 0.00011 + phase * 1.4) * layer.depth * composition.height * 0.002 : 0;
    const x = layer.x + driftX;
    const y = layer.y + driftY;
    const sourceX = layer.crop.x * image.naturalWidth;
    const sourceY = layer.crop.y * image.naturalHeight;
    const sourceWidth = layer.crop.width * image.naturalWidth;
    const sourceHeight = layer.crop.height * image.naturalHeight;

    compositionContext.save();
    compositionContext.globalAlpha = layer.opacity * sceneAlpha;
    compositionContext.filter = "grayscale(1) contrast(1.18)";
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
    const y = composition.height * 0.45 - height * 0.5;

    const layers: Layer[] = [
      { x, y, width, height, crop: FULL_IMAGE, depth: 0.18, opacity: 0.92, shape: "rect" },
      { x: x + width * 0.54, y: y - height * 0.02, width: width * 0.4, height: height * 0.5, crop: { x: 0.48, y: 0.08, width: 0.45, height: 0.56 }, depth: 0.46, opacity: 0.18, shape: "rect" },
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
    const width = Math.min(composition.width * 0.64, composition.height * 1.08);
    const height = width * 0.79;
    const x = composition.width * 0.5 - width * 0.5;
    const y = composition.height * 0.42 - height * 0.5;
    const frame = motionEnabled ? Math.floor(elapsed / 360) % 20 : 7;

    const layers: Layer[] = [
      { x, y, width, height, crop: FULL_IMAGE, depth: 0.16, opacity: 0.9, shape: "rect" },
      { x: x + width * 0.37, y: y - height * 0.12, width: width * 0.26, height: height * 0.25, crop: horseCrop(frame), depth: 0.5, opacity: 0.25, shape: "rect" },
    ];

    layers.forEach((layer, index) => drawLayer(image, layer, alpha, time, index * 1.4));
  };

  const drawEarthrise = (alpha: number, time: number): void => {
    const image = images[2];
    const width = Math.min(composition.width * 0.72, composition.height * 1.18);
    const height = width * 0.625;
    const x = composition.width * 0.5 - width * 0.5;
    const y = composition.height * 0.45 - height * 0.5;

    const layers: Layer[] = [
      { x, y, width, height, crop: FULL_IMAGE, depth: 0.14, opacity: 0.9, shape: "rect" },
      { x: x - width * 0.03, y: y + height * 0.67, width: width * 1.03, height: height * 0.23, crop: { x: 0, y: 0.68, width: 1, height: 0.25 }, depth: 0.42, opacity: 0.2, shape: "rect" },
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
    const driftX = motionEnabled ? Math.sin(time * 0.00016 + phase) * layer.depth * canvas.width * 0.003 : 0;
    const driftY = motionEnabled ? Math.cos(time * 0.00012 + phase * 1.3) * layer.depth * canvas.height * 0.0024 : 0;
    const x = layer.x + driftX;
    const y = layer.y + driftY;
    const sourceX = layer.crop.x * media.width;
    const sourceY = layer.crop.y * media.height;
    const sourceWidth = layer.crop.width * media.width;
    const sourceHeight = layer.crop.height * media.height;

    context.save();
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
    const driftX = motionEnabled ? Math.sin(time * 0.00018) * width * 0.002 : 0;
    const driftY = motionEnabled ? Math.cos(time * 0.00015) * height * 0.0015 : 0;

    context.save();
    context.translate(driftX, driftY);
    context.globalAlpha = alpha * 0.16;
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
      context.globalAlpha = alpha * 0.12;
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
      context.globalAlpha = alpha * 0.1;
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
      context.globalAlpha = alpha * 0.12;
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
        figure = { x: width * 0.1, y: height * 0.31, width: width * 0.21, height: width * 0.5, crop: FULL_IMAGE, depth: 0.72, opacity: 0.64, paperWash: 0.24, shape: "rect" };
        object = { x: width * 0.7, y: height * 0.34, width: width * 0.15, height: width * 0.23, crop: FULL_IMAGE, depth: 0.92, opacity: 0.58, paperWash: 0.16, shape: "ellipse" };
      } else if (sceneIndex === 1) {
        figure = { x: width * 0.72, y: height * 0.3, width: width * 0.17, height: width * 0.48, crop: FULL_IMAGE, depth: 0.74, opacity: 0.62, paperWash: 0.24, shape: "rect" };
        object = { x: width * 0.12, y: height * 0.38, width: width * 0.16, height: width * 0.22, crop: FULL_IMAGE, depth: 0.94, opacity: 0.54, paperWash: 0.16, shape: "ellipse" };
      } else {
        figure = { x: width * 0.1, y: height * 0.34, width: width * 0.24, height: width * 0.48, crop: FULL_IMAGE, depth: 0.76, opacity: 0.66, paperWash: 0.34, shape: "rect" };
        object = { x: width * 0.7, y: height * 0.36, width: width * 0.17, height: width * 0.23, crop: FULL_IMAGE, depth: 0.96, opacity: 0.6, paperWash: 0.18, shape: "rect" };
      }
    } else if (sceneIndex === 0) {
      figure = { x: width * 0.12, y: height * 0.14, width: width * 0.17, height: height * 0.53, crop: FULL_IMAGE, depth: 0.72, opacity: 0.64, paperWash: 0.24, shape: "rect" };
      object = { x: width * 0.73, y: height * 0.31, width: width * 0.13, height: height * 0.24, crop: FULL_IMAGE, depth: 0.92, opacity: 0.58, paperWash: 0.16, shape: "ellipse" };
    } else if (sceneIndex === 1) {
      figure = { x: width * 0.71, y: height * 0.16, width: width * 0.15, height: height * 0.48, crop: FULL_IMAGE, depth: 0.74, opacity: 0.62, paperWash: 0.24, shape: "rect" };
      object = { x: width * 0.16, y: height * 0.34, width: width * 0.13, height: height * 0.2, crop: FULL_IMAGE, depth: 0.94, opacity: 0.54, paperWash: 0.16, shape: "ellipse" };
    } else {
      figure = { x: width * 0.14, y: height * 0.24, width: width * 0.18, height: height * 0.4, crop: FULL_IMAGE, depth: 0.76, opacity: 0.66, paperWash: 0.34, shape: "rect" };
      object = { x: width * 0.72, y: height * 0.31, width: width * 0.14, height: height * 0.22, crop: FULL_IMAGE, depth: 0.96, opacity: 0.6, paperWash: 0.18, shape: "rect" };
    }

    drawEffectLayer(sceneIndex, alpha, time);
    drawPreparedLayer(media.figure, figure, alpha, time, sceneIndex * 1.7 + 0.8);
    drawPreparedLayer(media.object, object, alpha, time, sceneIndex * 1.7 + 2.4);
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
      const progress = easeInOut(clamp((time - transitionStartedAt) / SCENE_TRANSITION_MS, 0, 1));
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

    const transitioning = hasTransition(time);
    if (time - lastFrameAt >= FRAME_INTERVAL || transitioning) {
      render(time);
      lastFrameAt = time;
    }

    if (motionEnabled || transitioning) scheduleFrame();
    else lastTime = undefined;
  }

  const goToScene = (nextIndex: number): void => {
    const normalizedIndex = (nextIndex + VISUAL_STATES.length) % VISUAL_STATES.length;
    if (destroyed || normalizedIndex === activeStateIndex) return;
    const now = performance.now();
    previousStateIndex = activeStateIndex;
    activeStateIndex = normalizedIndex;
    transitionStartedAt = now;
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

    setScene(index: number): void {
      goToScene(index);
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
