import {
  ShaderFitOptions,
  ShaderMount,
  getShaderColorFromString,
  heatmapFragmentShader,
  toProcessedHeatmap,
  type ShaderMountUniforms,
} from "@paper-design/shaders";

type ProcessedMask = {
  image: HTMLImageElement;
  objectUrl: string;
  layout: MaskLayout;
};

type MaskLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type GlowController = {
  prepare(sceneKey: string, cutoutUrl: string, glowColor: string): Promise<void>;
  setHovered(active: boolean): void;
  setDocumentVisible(visible: boolean): void;
  dispose(): void;
};

const MASK_ALPHA_THRESHOLD = 48;
const MAX_SHADER_PIXELS = 1_500_000;
const GLOW_MASK_PADDING = 0.5;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error(`Unable to load glow source: ${source}`)), { once: true });
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode the animal alpha mask."));
    }, "image/png");
  });
}

async function createAlphaLuminanceMask(cutoutUrl: string): Promise<{ blob: Blob; layout: MaskLayout }> {
  const cutout = await loadImage(cutoutUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = cutout.naturalWidth;
  sourceCanvas.height = cutout.naturalHeight;
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to read the animal alpha channel.");

  context.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  context.drawImage(cutout, 0, 0);
  const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const pixels = imageData.data;
  let minX = sourceCanvas.width;
  let minY = sourceCanvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let offset = 0; offset < pixels.length; offset += 4) {
    const opaque = pixels[offset + 3] >= MASK_ALPHA_THRESHOLD;
    const luminance = opaque ? 0 : 255;
    pixels[offset] = luminance;
    pixels[offset + 1] = luminance;
    pixels[offset + 2] = luminance;
    pixels[offset + 3] = 255;
    if (opaque) {
      const pixelIndex = offset / 4;
      const x = pixelIndex % sourceCanvas.width;
      const y = Math.floor(pixelIndex / sourceCanvas.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) throw new Error("The animal cutout has no visible alpha mask.");
  context.putImageData(imageData, 0, 0);

  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = Math.ceil(Math.max(contentWidth, contentHeight) * GLOW_MASK_PADDING);
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = contentWidth + padding * 2;
  maskCanvas.height = contentHeight + padding * 2;
  const maskContext = maskCanvas.getContext("2d");
  if (!maskContext) throw new Error("Unable to pad the animal alpha mask.");
  maskContext.fillStyle = "white";
  maskContext.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  maskContext.drawImage(
    sourceCanvas,
    minX,
    minY,
    contentWidth,
    contentHeight,
    padding,
    padding,
    contentWidth,
    contentHeight,
  );
  return {
    blob: await canvasToBlob(maskCanvas),
    layout: {
      left: (minX - padding) / sourceCanvas.width,
      top: (minY - padding) / sourceCanvas.height,
      width: maskCanvas.width / sourceCanvas.width,
      height: maskCanvas.height / sourceCanvas.height,
    },
  };
}

async function processMask(cutoutUrl: string): Promise<ProcessedMask> {
  const { blob: luminanceBlob, layout } = await createAlphaLuminanceMask(cutoutUrl);
  const luminanceUrl = URL.createObjectURL(luminanceBlob);

  try {
    const { blob } = await toProcessedHeatmap(luminanceUrl);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await loadImage(objectUrl);
      return { image, objectUrl, layout };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  } finally {
    URL.revokeObjectURL(luminanceUrl);
  }
}

function heatmapUniforms(image: HTMLImageElement, glowColor: string): ShaderMountUniforms {
  const glow = getShaderColorFromString(glowColor);
  return {
    u_image: image,
    u_imageAspectRatio: image.naturalWidth / image.naturalHeight,
    u_fit: ShaderFitOptions.contain,
    u_scale: 1,
    u_rotation: 0,
    u_originX: 0.5,
    u_originY: 0.5,
    u_offsetX: 0,
    u_offsetY: 0,
    u_worldWidth: 0,
    u_worldHeight: 0,
    u_contour: 0.14,
    u_angle: 0,
    u_noise: 0,
    u_innerGlow: 0,
    u_outerGlow: 0.5,
    u_colorBack: [0, 0, 0, 0],
    u_colors: [glow, glow, [1, 1, 1, 1]],
    u_colorsCount: 3,
  };
}

export function createAnimalGlowController(
  host: HTMLElement,
  prefersReducedMotion: MediaQueryList,
): GlowController {
  const processedMasks = new Map<string, Promise<ProcessedMask>>();
  let mount: ShaderMount | null = null;
  let opacityAnimation: Animation | null = null;
  let prepareToken = 0;
  let presentationToken = 0;
  let hovered = false;
  let documentVisible = !document.hidden;
  let ready = false;
  let disposed = false;
  let presentedActive = false;
  let presentedReducedMotion = prefersReducedMotion.matches;

  host.style.opacity = "0";

  const setSpeed = (active: boolean): void => {
    mount?.setSpeed(active ? 0.12 : 0);
  };

  const setOpacity = (target: 0 | 1, duration: number): void => {
    presentationToken += 1;
    const token = presentationToken;
    opacityAnimation?.cancel();
    opacityAnimation = null;

    if (duration === 0) {
      host.style.opacity = String(target);
      if (target === 0) setSpeed(false);
      return;
    }

    const current = Number.parseFloat(getComputedStyle(host).opacity) || 0;
    const animation = host.animate(
      [{ opacity: current }, { opacity: target }],
      { duration, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" },
    );
    opacityAnimation = animation;
    animation.addEventListener("finish", () => {
      if (token !== presentationToken) return;
      host.style.opacity = String(target);
      animation.cancel();
      opacityAnimation = null;
      if (target === 0) setSpeed(false);
    }, { once: true });
  };

  const updatePresentation = (): void => {
    const active = ready && hovered && documentVisible;
    const reduced = prefersReducedMotion.matches;
    if (active === presentedActive && reduced === presentedReducedMotion) return;
    presentedActive = active;
    presentedReducedMotion = reduced;
    if (!documentVisible) {
      setSpeed(false);
      setOpacity(0, 0);
      return;
    }
    if (active) setSpeed(!reduced);
    setOpacity(active ? 1 : 0, reduced ? 0 : active ? 140 : 100);
  };

  const activateMask = (mask: ProcessedMask, glowColor: string): void => {
    host.style.left = `${mask.layout.left * 100}%`;
    host.style.top = `${mask.layout.top * 100}%`;
    host.style.width = `${mask.layout.width * 100}%`;
    host.style.height = `${mask.layout.height * 100}%`;
    const uniforms = heatmapUniforms(mask.image, glowColor);
    if (!mount) {
      mount = new ShaderMount(
        host,
        heatmapFragmentShader,
        uniforms,
        { alpha: true, premultipliedAlpha: true },
        0,
        0,
        1,
        MAX_SHADER_PIXELS,
        ["u_image"],
      );
      mount.canvasElement.setAttribute("aria-hidden", "true");
      mount.canvasElement.tabIndex = -1;
    } else {
      mount.setUniforms(uniforms);
    }
    ready = true;
    updatePresentation();
  };

  return {
    async prepare(sceneKey, cutoutUrl, glowColor) {
      if (disposed) return;
      const token = ++prepareToken;
      ready = false;
      updatePresentation();

      let pending = processedMasks.get(sceneKey);
      if (!pending) {
        pending = processMask(cutoutUrl);
        processedMasks.set(sceneKey, pending);
      }

      try {
        const mask = await pending;
        if (disposed || token !== prepareToken) return;
        activateMask(mask, glowColor);
      } catch {
        processedMasks.delete(sceneKey);
        if (disposed || token !== prepareToken) return;
        ready = false;
        updatePresentation();
      }
    },
    setHovered(active) {
      hovered = active;
      updatePresentation();
    },
    setDocumentVisible(visible) {
      documentVisible = visible;
      updatePresentation();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      prepareToken += 1;
      presentationToken += 1;
      opacityAnimation?.cancel();
      mount?.dispose();
      mount = null;
      for (const pending of processedMasks.values()) {
        void pending.then(({ objectUrl }) => URL.revokeObjectURL(objectUrl), () => {});
      }
      processedMasks.clear();
    },
  };
}
