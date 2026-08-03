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
    sourceLabel: "THE MET — PUBLIC DOMAIN",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/56353",
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
    sourceLabel: "LIBRARY OF CONGRESS",
    sourceUrl: "https://www.loc.gov/pictures/item/2008681069/",
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
    sourceLabel: "NASA — AS08-14-2383",
    sourceUrl: "https://science.nasa.gov/resource/image-earthrise/",
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
  rotation?: number;
  shape?: LayerShape;
}

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

  const render = (time: number): void => {
    if (!loaded || destroyed) return;
    compositionContext.save();
    compositionContext.setTransform(1, 0, 0, 1, 0, 0);
    compositionContext.filter = "none";
    compositionContext.globalAlpha = 1;
    compositionContext.fillStyle = "#ffffff";
    compositionContext.fillRect(0, 0, composition.width, composition.height);

    if (hasTransition(time)) {
      const progress = easeInOut(clamp((time - transitionStartedAt) / 960, 0, 1));
      drawScene(previousStateIndex, 1 - progress, time);
      drawScene(activeStateIndex, progress, time);
    } else {
      drawScene(activeStateIndex, 1, time);
    }

    compositionContext.restore();
    applyDither();
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

  void Promise.all(VISUAL_STATES.map((state) => loadImage(state.imageUrl)))
    .then((loadedImages) => {
      if (destroyed) return;
      images.push(...loadedImages);
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
