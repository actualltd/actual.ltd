import {
  GLSL3,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import {
  DitheringTypes,
  imageDitheringFragmentShader,
} from "@paper-design/shaders";
import {
  animate,
  motionValue,
  springValue,
  type AnimationPlaybackControls,
} from "motion";

export interface ArtworkCredit {
  role: "environment" | "figure" | "object";
  title: string;
  artist: string;
  date: string;
  sourceUrl: string;
}

export interface VisualState {
  index: number;
  code: string;
  label: string;
  line: string;
  title: string;
  artist: string;
  date: string;
  imageUrl: string;
  credits: readonly ArtworkCredit[];
}

export interface ArtworkSelection {
  state: VisualState;
  credit: ArtworkCredit;
  imageUrl: string;
  imageElement?: HTMLImageElement;
}

export const VISUAL_STATES: readonly VisualState[] = [
  {
    index: 1,
    code: "001",
    label: "FORM",
    line: "MATTER TAKES A POSITION.",
    title: "THE DEATH OF SOCRATES",
    artist: "JACQUES LOUIS DAVID",
    date: "1787",
    imageUrl: "/art/archive/form-environment.webp",
    credits: [
      { role: "environment", title: "The Death of Socrates", artist: "Jacques Louis David", date: "1787", sourceUrl: "https://www.metmuseum.org/art/collection/search/436105" },
      { role: "figure", title: "Marble statue of a kouros (youth)", artist: "Greek", date: "ca. 590–580 BCE", sourceUrl: "https://www.metmuseum.org/art/collection/search/253370" },
      { role: "object", title: "Terracotta amphora (jar)", artist: "Andokides", date: "ca. 530 BCE", sourceUrl: "https://www.metmuseum.org/art/collection/search/255154" },
    ],
  },
  {
    index: 2,
    code: "002",
    label: "GESTURE",
    line: "THE BODY INVENTS THE LINE.",
    title: "THE DANCE CLASS",
    artist: "EDGAR DEGAS",
    date: "1874",
    imageUrl: "/art/archive/gesture-environment.webp",
    credits: [
      { role: "environment", title: "The Dance Class", artist: "Edgar Degas", date: "1874", sourceUrl: "https://www.metmuseum.org/art/collection/search/438817" },
      { role: "figure", title: "The Little Fourteen-Year-Old Dancer", artist: "Edgar Degas", date: "modeled 1881; cast 1922", sourceUrl: "https://www.metmuseum.org/art/collection/search/196439" },
      { role: "object", title: "Fan", artist: "Bertrand", date: "mid-19th century", sourceUrl: "https://www.metmuseum.org/art/collection/search/209540" },
    ],
  },
  {
    index: 3,
    code: "003",
    label: "AFTERIMAGE",
    line: "LIGHT OUTLIVES THE MOMENT.",
    title: "WHEAT FIELD WITH CYPRESSES",
    artist: "VINCENT VAN GOGH",
    date: "1889",
    imageUrl: "/art/archive/afterimage-environment.webp",
    credits: [
      { role: "environment", title: "Wheat Field with Cypresses", artist: "Vincent van Gogh", date: "1889", sourceUrl: "https://www.metmuseum.org/art/collection/search/436535" },
      { role: "figure", title: "Self-Portrait with a Straw Hat", artist: "Vincent van Gogh", date: "1887", sourceUrl: "https://www.metmuseum.org/art/collection/search/436532" },
      { role: "object", title: "Irises", artist: "Vincent van Gogh", date: "1890", sourceUrl: "https://www.metmuseum.org/art/collection/search/436528" },
    ],
  },
] as const;

export interface VisualController {
  setActualView(enabled: boolean): void;
  setMotionEnabled(enabled: boolean): void;
  setReducedMotion(enabled: boolean): void;
  setScene(index: number): void;
  destroy(): void;
}

interface VisualOptions {
  motionEnabled: boolean;
  reducedMotion: boolean;
  onStateChange: (state: VisualState) => void;
  onUnavailable: () => void;
  onAvailable?: () => void;
  onInteractionStateChange?: (active: boolean) => void;
  onArtworkOpen?: (selection: ArtworkSelection) => void;
}

type LayerRole = ArtworkCredit["role"];

interface LayerLayout {
  x: number;
  y: number;
  width: number;
  maxHeight: number;
  rotation?: number;
}

interface LayerConfig {
  role: LayerRole;
  source: string;
  aspect: number;
  opacity: number;
  layout: LayerLayout;
  mobile: LayerLayout;
  dither: {
    type: number;
    pixelSize: number;
    colorSteps: number;
  };
}

interface SceneConfig {
  layers: readonly LayerConfig[];
  effect: "crop" | "sequence" | "scan";
}

interface LayerRecord {
  role: LayerRole;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  material: MeshBasicMaterial;
  baseX: number;
  baseY: number;
  baseScaleX: number;
  baseScaleY: number;
  userOffsetX: number;
  userOffsetY: number;
  userScale: number;
  minScale: number;
  maxScale: number;
}

interface SceneRecord {
  group: Group;
  layers: LayerRecord[];
  effectMeshes: Array<Mesh<RingGeometry | PlaneGeometry, MeshBasicMaterial>>;
}

interface MagnifyGestureEvent extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

const PAPER = new Vector4(238 / 255, 232 / 255, 220 / 255, 0);
const INK = new Vector4(20 / 255, 18 / 255, 15 / 255, 1);
const ROLE_LAYERS: Record<LayerRole, number> = { environment: 0, figure: 1, object: 2 };
const EFFECT_LAYER = 3;
const MAX_DPR = 1.35;
const PAGE_EDGE_INSET = 24;
const SCALE_LIMITS: Record<LayerRole, { minScale: number; maxScale: number }> = {
  environment: { minScale: 0.48, maxScale: 1.80 },
  figure: { minScale: 0.38, maxScale: 2.35 },
  object: { minScale: 0.28, maxScale: 2.80 },
};

const sharedDither = {
  environment: { type: DitheringTypes["8x8"], pixelSize: 1.8, colorSteps: 1 },
  figure: { type: DitheringTypes["4x4"], pixelSize: 1.35, colorSteps: 2 },
};

const SCENES: readonly SceneConfig[] = [
  {
    effect: "crop",
    layers: [
      { role: "environment", source: "/art/archive/form-environment.webp", aspect: 1600 / 1065, opacity: 0.92, layout: { x: 0.04, y: 0.06, width: 0.84, maxHeight: 0.78 }, mobile: { x: 0.05, y: 0.07, width: 0.92, maxHeight: 0.68 }, dither: sharedDither.environment },
      { role: "figure", source: "/art/archive/form-figure.webp", aspect: 806 / 1200, opacity: 0.94, layout: { x: -0.43, y: 0.02, width: 0.25, maxHeight: 0.92 }, mobile: { x: -0.39, y: -0.03, width: 0.30, maxHeight: 0.82 }, dither: sharedDither.figure },
      { role: "object", source: "/art/archive/form-object.webp", aspect: 788 / 1050, opacity: 0.72, layout: { x: 0.39, y: -0.27, width: 0.18, maxHeight: 0.42, rotation: 1.5 }, mobile: { x: 0.35, y: -0.28, width: 0.23, maxHeight: 0.38, rotation: 1.5 }, dither: { type: DitheringTypes["2x2"], pixelSize: 2.7, colorSteps: 1 } },
    ],
  },
  {
    effect: "sequence",
    layers: [
      { role: "environment", source: "/art/archive/gesture-environment.webp", aspect: 1484 / 1600, opacity: 0.90, layout: { x: -0.03, y: 0.04, width: 0.56, maxHeight: 0.82 }, mobile: { x: -0.04, y: 0.06, width: 0.68, maxHeight: 0.73 }, dither: sharedDither.environment },
      { role: "figure", source: "/art/archive/gesture-figure.webp", aspect: 877 / 1200, opacity: 0.94, layout: { x: 0.36, y: 0.02, width: 0.25, maxHeight: 0.88, rotation: -1.5 }, mobile: { x: 0.33, y: -0.02, width: 0.31, maxHeight: 0.78, rotation: -1 }, dither: sharedDither.figure },
      { role: "object", source: "/art/archive/gesture-object.webp", aspect: 1100 / 703, opacity: 0.68, layout: { x: -0.35, y: -0.30, width: 0.29, maxHeight: 0.31, rotation: -4 }, mobile: { x: -0.31, y: -0.30, width: 0.35, maxHeight: 0.28, rotation: -4 }, dither: { type: DitheringTypes.random, pixelSize: 2.7, colorSteps: 1 } },
    ],
  },
  {
    effect: "scan",
    layers: [
      { role: "environment", source: "/art/archive/afterimage-environment.webp", aspect: 1600 / 1274, opacity: 0.90, layout: { x: 0.05, y: 0.07, width: 0.82, maxHeight: 0.78 }, mobile: { x: 0.05, y: 0.07, width: 0.91, maxHeight: 0.68 }, dither: sharedDither.environment },
      { role: "figure", source: "/art/archive/afterimage-figure.webp", aspect: 964 / 1200, opacity: 0.92, layout: { x: -0.39, y: 0.01, width: 0.25, maxHeight: 0.72, rotation: -2 }, mobile: { x: -0.34, y: -0.01, width: 0.31, maxHeight: 0.66, rotation: -2 }, dither: sharedDither.figure },
      { role: "object", source: "/art/archive/afterimage-object.webp", aspect: 1200 / 952, opacity: 0.72, layout: { x: 0.35, y: -0.27, width: 0.28, maxHeight: 0.34, rotation: 2.5 }, mobile: { x: 0.31, y: -0.28, width: 0.35, maxHeight: 0.31, rotation: 2 }, dither: { type: DitheringTypes["2x2"], pixelSize: 2.7, colorSteps: 1 } },
    ],
  },
] as const;

const FULLSCREEN_VERTEX_SHADER = `precision mediump float;
in vec3 position;
void main() { gl_Position = vec4(position, 1.0); }`;

const PAPER_FRAGMENT_SHADER = imageDitheringFragmentShader
  .replace(/^#version 300 es\s*/, "")
  .replace("imageUV.y = 1. - imageUV.y;", "");

const COMPOSITE_FRAGMENT_SHADER = `precision highp float;
uniform vec2 u_resolution;
uniform sampler2D u_environment;
uniform sampler2D u_figure;
uniform sampler2D u_object;
uniform sampler2D u_effects;
uniform sampler2D u_raw;
uniform vec3 u_paper;
uniform vec2 u_pointer;
uniform vec4 u_plate;
uniform float u_pointerActive;
uniform float u_fullReveal;
uniform float u_revealRadius;
uniform float u_registration;
uniform float u_transitionMotion;
out vec4 fragColor;

vec3 over(vec3 base, vec4 layer) {
  return layer.rgb + base * (1.0 - layer.a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float transitionPeak = sin(u_registration * 3.14159265);
  float shift = transitionPeak * 10.0 * u_transitionMotion;
  vec2 shiftUv = vec2(shift / u_resolution.x, 0.0);
  vec2 slideUv = vec2(transitionPeak * 12.0 * u_transitionMotion / u_resolution.x, 0.0);
  vec4 environment = texture(u_environment, uv - slideUv - shiftUv * 0.35);
  vec4 figure = texture(u_figure, uv - slideUv + shiftUv);
  vec4 objectLayer = texture(u_object, uv - slideUv - shiftUv * 0.72);
  vec4 effects = texture(u_effects, uv);
  vec4 raw = texture(u_raw, uv);

  vec3 dithered = u_paper;
  dithered = over(dithered, environment);
  dithered = over(dithered, figure);
  dithered = over(dithered, objectLayer);
  dithered = over(dithered, effects);

  vec2 plateMin = u_plate.xy;
  vec2 plateMax = u_plate.xy + u_plate.zw;
  float inside = step(plateMin.x, uv.x) * step(plateMin.y, uv.y)
    * step(uv.x, plateMax.x) * step(uv.y, plateMax.y);
  float distancePx = distance(uv * u_resolution, u_pointer * u_resolution);
  float aperture = 1.0 - smoothstep(u_revealRadius * 0.70, u_revealRadius, distancePx);
  aperture *= u_pointerActive * inside;
  float reveal = max(aperture, u_fullReveal * inside);
  vec3 actual = raw.rgb + u_paper * (1.0 - raw.a);
  vec3 color = mix(dithered, actual, reveal);
  float veil = transitionPeak * mix(0.34, 0.16, u_transitionMotion);
  color = mix(color, u_paper, veil);
  fragColor = vec4(color, 1.0);
}`;

function clampIndex(index: number): number {
  return Math.max(0, Math.min(SCENES.length - 1, index));
}

export function createVisual(container: HTMLElement, options: VisualOptions): VisualController {
  const stage = document.createElement("div");
  stage.className = "art-engine";
  stage.dataset.renderer = "three-paper-signal-archive";
  stage.dataset.depthPlanes = "4";
  stage.dataset.ditherProvider = "paper-shaders";
  stage.dataset.layerProcessing = "semantic-render-targets";
  stage.dataset.scene = "0";
  stage.dataset.view = "dither";
  stage.dataset.transitioning = "false";
  stage.setAttribute("aria-hidden", "true");
  container.append(stage);

  const records: Array<SceneRecord | null> = [null, null, null];
  const recordLoads: Array<Promise<SceneRecord> | null> = [null, null, null];
  const textures = new Map<string, Texture>();
  const renderTargets: WebGLRenderTarget[] = [];
  const ditherTargets: Record<LayerRole, WebGLRenderTarget | null> = { environment: null, figure: null, object: null };
  const targetRoles: readonly LayerRole[] = ["environment", "figure", "object"];
  const planeGeometry = new PlaneGeometry(1, 1);

  let renderer: WebGLRenderer | null = null;
  let camera: OrthographicCamera | null = null;
  let scene: Scene | null = null;
  let scratchTarget: WebGLRenderTarget | null = null;
  let rawTarget: WebGLRenderTarget | null = null;
  let effectsTarget: WebGLRenderTarget | null = null;
  let ditherMaterial: RawShaderMaterial | null = null;
  let compositeMaterial: RawShaderMaterial | null = null;
  let quad: FullScreenQuad | null = null;
  let motionEnabled = options.motionEnabled;
  let reducedMotion = options.reducedMotion;
  let desiredSceneIndex = 0;
  let activeSceneIndex = -1;
  let destroyed = false;
  let ready = false;
  let frame = 0;
  let lastTime = 0;
  let contextLost = false;
  let platePixels = { x: 0, y: 0, width: 1, height: 1 };
  let registrationAnimation: AnimationPlaybackControls | null = null;
  let hoveredLayer: LayerRecord | null = null;
  let draggingLayer: LayerRecord | null = null;
  let draggingPointerId = -1;
  let dragPending = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOriginOffsetX = 0;
  let dragOriginOffsetY = 0;
  let dragParallaxOffsetX = 0;
  let dragParallaxOffsetY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let dragMoved = false;
  let gestureLayer: LayerRecord | null = null;
  let gestureStartScale = 1;
  let lastGestureEndTime = -Infinity;
  let resizingArtwork = false;
  let resizeEndTimer = 0;
  let interactionActive = false;

  const parallaxTargetX = motionValue(0);
  const parallaxTargetY = motionValue(0);
  const parallaxX = springValue(parallaxTargetX, { stiffness: 82, damping: 24, mass: 0.9 });
  const parallaxY = springValue(parallaxTargetY, { stiffness: 82, damping: 24, mass: 0.9 });
  const apertureTarget = motionValue(0);
  const aperture = springValue(apertureTarget, { stiffness: 150, damping: 24, mass: 0.75 });
  const fullReveal = motionValue(0);
  const registration = motionValue(0);
  let resolvedParallaxX = 0;
  let resolvedParallaxY = 0;

  const subscriptions = [
    parallaxX.on("change", (value) => { resolvedParallaxX = value; }),
    parallaxY.on("change", (value) => { resolvedParallaxY = value; }),
    aperture.on("change", (value) => {
      if (compositeMaterial) compositeMaterial.uniforms.u_pointerActive.value = value;
      requestRender();
    }),
    fullReveal.on("change", (value) => {
      if (compositeMaterial) compositeMaterial.uniforms.u_fullReveal.value = value;
      requestRender();
    }),
    registration.on("change", (value) => {
      if (compositeMaterial) compositeMaterial.uniforms.u_registration.value = value;
      requestRender();
    }),
  ];

  const showFallback = (): void => {
    if (destroyed) return;
    ready = false;
    container.classList.add("is-unavailable");
    container.classList.remove("is-ready");
    options.onUnavailable();
  };

  const showRenderer = (): void => {
    if (destroyed) return;
    ready = true;
    container.classList.remove("is-unavailable");
    container.classList.add("is-ready");
    options.onAvailable?.();
  };

  const makeTarget = (): WebGLRenderTarget => {
    const target = new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    renderTargets.push(target);
    return target;
  };

  const requestRender = (): void => {
    if (frame !== 0 || !ready || destroyed || contextLost || document.hidden) return;
    frame = window.requestAnimationFrame(render);
  };

  const syncInteractionState = (): void => {
    const active = resizingArtwork || (draggingLayer !== null && !dragPending);
    if (interactionActive === active) return;
    interactionActive = active;
    options.onInteractionStateChange?.(active);
  };

  const setVisibleRecord = (index: number): void => {
    records.forEach((record, recordIndex) => {
      if (record) record.group.visible = recordIndex === index;
    });
    activeSceneIndex = index;
    stage.dataset.scene = String(index);
    hoveredLayer = null;
    draggingLayer = null;
    draggingPointerId = -1;
    dragPending = false;
    syncInteractionState();
    delete stage.dataset.activeLayer;
    delete document.documentElement.dataset.artActive;
    delete document.documentElement.dataset.artDragging;
  };

  const addEffects = (record: SceneRecord, sceneIndex: number): void => {
    const ink = 0x14120f;
    if (sceneIndex === 0) {
      for (let index = 0; index < 3; index += 1) {
        const ring = new Mesh(
          new RingGeometry(0.42 + index * 0.13, 0.423 + index * 0.13, 128),
          new MeshBasicMaterial({ color: ink, transparent: true, opacity: 0.20 - index * 0.04, depthWrite: false }),
        );
        ring.scale.x = 1.38;
        ring.position.set(0.10, 0.06, 4);
        ring.layers.set(EFFECT_LAYER);
        record.group.add(ring);
        record.effectMeshes.push(ring);
      }
    } else {
      const count = sceneIndex === 1 ? 5 : 7;
      for (let index = 0; index < count; index += 1) {
        const line = new Mesh(
          new PlaneGeometry(1, 1),
          new MeshBasicMaterial({ color: ink, transparent: true, opacity: sceneIndex === 1 ? 0.11 : 0.14, depthWrite: false }),
        );
        line.scale.set(sceneIndex === 1 ? 1.7 : 1.45, sceneIndex === 1 ? 0.003 : 0.0018, 1);
        line.position.set(sceneIndex === 1 ? -0.14 + index * 0.045 : 0.12, 0.31 - index * (sceneIndex === 1 ? 0.065 : 0.085), 4);
        line.layers.set(EFFECT_LAYER);
        record.group.add(line);
        record.effectMeshes.push(line);
      }
    }
  };

  const loadTexture = async (url: string): Promise<Texture> => {
    const cached = textures.get(url);
    if (cached) return cached;
    const texture = await new TextureLoader().loadAsync(url);
    const image = texture.image;
    if (image instanceof HTMLImageElement) {
      await image.decode().catch(() => undefined);
    }
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    textures.set(url, texture);
    return texture;
  };

  const loadRecord = (index: number): Promise<SceneRecord> => {
    const existing = records[index];
    if (existing) return Promise.resolve(existing);
    const pending = recordLoads[index];
    if (pending) return pending;
    const load = (async (): Promise<SceneRecord> => {
      if (!scene) throw new Error("Scene is not ready");
      const config = SCENES[index];
      const loaded = await Promise.all(config.layers.map((layer) => loadTexture(layer.source)));
      const group = new Group();
      group.visible = false;
      const record: SceneRecord = { group, layers: [], effectMeshes: [] };
      config.layers.forEach((layer, layerIndex) => {
        const material = new MeshBasicMaterial({
          map: loaded[layerIndex],
          color: 0xffffff,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
          blending: NormalBlending,
        });
        const mesh = new Mesh(planeGeometry, material);
        mesh.position.z = ROLE_LAYERS[layer.role];
        mesh.renderOrder = layerIndex + 1;
        mesh.rotation.z = ((layer.layout.rotation ?? 0) * Math.PI) / 180;
        mesh.layers.set(ROLE_LAYERS[layer.role]);
        group.add(mesh);
        const limits = SCALE_LIMITS[layer.role];
        record.layers.push({
          role: layer.role,
          mesh,
          material,
          baseX: 0,
          baseY: 0,
          baseScaleX: 1,
          baseScaleY: 1,
          userOffsetX: 0,
          userOffsetY: 0,
          userScale: 1,
          minScale: limits.minScale,
          maxScale: limits.maxScale,
        });
      });
      addEffects(record, index);
      scene.add(group);
      records[index] = record;
      stage.dataset.loadedScenes = records.filter(Boolean).length.toString();
      applyLayout();
      return record;
    })();
    recordLoads[index] = load;
    return load;
  };

  const prefetchFollowingRecords = (): void => {
    const sources = SCENES.slice(1).flatMap((config) => config.layers.map((layer) => layer.source));
    sources.forEach((source) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = source;
      document.head.append(link);
    });
  };

  const activateScene = async (index: number, immediate = false): Promise<void> => {
    const nextIndex = clampIndex(index);
    await loadRecord(nextIndex);
    if (destroyed || desiredSceneIndex !== nextIndex) return;
    registrationAnimation?.stop();
    if (immediate || activeSceneIndex < 0) {
      registration.set(0);
      setVisibleRecord(nextIndex);
      stage.dataset.transitioning = "false";
      requestRender();
      return;
    }
    let swapped = false;
    registration.set(0);
    stage.dataset.transitioning = "true";
    registrationAnimation = animate(registration, 1, {
      duration: reducedMotion ? 0.18 : motionEnabled ? 0.82 : 0.58,
      ease: [0.45, 0, 0.2, 1],
      onUpdate: (value) => {
        if (!swapped && value >= 0.48) {
          swapped = true;
          setVisibleRecord(nextIndex);
        }
      },
      onComplete: () => {
        registration.set(0);
        setVisibleRecord(nextIndex);
        stage.dataset.transitioning = "false";
      },
    });
  };

  const layerHalfExtents = (layer: LayerRecord): { x: number; y: number } => {
    const angle = layer.mesh.rotation.z;
    const cosine = Math.abs(Math.cos(angle));
    const sine = Math.abs(Math.sin(angle));
    return {
      x: (layer.baseScaleX * cosine + layer.baseScaleY * sine) * layer.userScale * 0.5,
      y: (layer.baseScaleX * sine + layer.baseScaleY * cosine) * layer.userScale * 0.5,
    };
  };

  const constrainLayerToPage = (layer: LayerRecord): void => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    const marginX = (PAGE_EDGE_INSET / width) * aspect * 2;
    const marginY = (PAGE_EDGE_INSET / height) * 2;
    const half = layerHalfExtents(layer);
    const minimumX = -aspect + marginX + half.x - layer.baseX;
    const maximumX = aspect - marginX - half.x - layer.baseX;
    const minimumY = -1 + marginY + half.y - layer.baseY;
    const maximumY = 1 - marginY - half.y - layer.baseY;
    layer.userOffsetX = minimumX <= maximumX
      ? Math.max(minimumX, Math.min(maximumX, layer.userOffsetX))
      : -layer.baseX;
    layer.userOffsetY = minimumY <= maximumY
      ? Math.max(minimumY, Math.min(maximumY, layer.userOffsetY))
      : -layer.baseY;
  };

  const pageSafeMaxScale = (layer: LayerRecord): number => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    const marginX = (PAGE_EDGE_INSET / width) * aspect * 2;
    const marginY = (PAGE_EDGE_INSET / height) * 2;
    const half = layerHalfExtents(layer);
    const currentScale = Math.max(layer.userScale, 0.001);
    const baseHalfX = half.x / currentScale;
    const baseHalfY = half.y / currentScale;
    const horizontalLimit = baseHalfX > 0 ? (aspect - marginX) / baseHalfX : layer.maxScale;
    const verticalLimit = baseHalfY > 0 ? (1 - marginY) / baseHalfY : layer.maxScale;
    return Math.max(layer.minScale, Math.min(layer.maxScale, horizontalLimit, verticalLimit));
  };

  const layerScreenBounds = (layer: LayerRecord): { left: number; top: number; right: number; bottom: number } => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    const half = layerHalfExtents(layer);
    const centerX = ((layer.baseX + layer.userOffsetX + aspect) / (aspect * 2)) * width;
    const centerY = (1 - (layer.baseY + layer.userOffsetY + 1) / 2) * height;
    const halfWidth = (half.x / (aspect * 2)) * width;
    const halfHeight = (half.y / 2) * height;
    return {
      left: centerX - halfWidth,
      top: centerY - halfHeight,
      right: centerX + halfWidth,
      bottom: centerY + halfHeight,
    };
  };

  const applyLayout = (): void => {
    if (!renderer || !camera) return;
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    const compact = width <= 700 || aspect < 0.82;
    const plateWidth = compact ? Math.max(width - 32, 1) : Math.min(width * 0.68, 940);
    const plateHeight = compact ? height * 0.60 : Math.min(height * 0.64, 680);
    platePixels = { x: (width - plateWidth) / 2, y: (height - plateHeight) / 2, width: plateWidth, height: plateHeight };
    const plateWorldWidth = aspect * 2 * (plateWidth / width);
    const plateWorldHeight = 2 * (plateHeight / height);

    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();

    records.forEach((record, sceneIndex) => {
      if (!record) return;
      record.layers.forEach((layer) => {
        const layerConfig = SCENES[sceneIndex].layers.find((entry) => entry.role === layer.role);
        if (!layerConfig) return;
        const layout = compact ? layerConfig.mobile : layerConfig.layout;
        let meshWidth = plateWorldWidth * layout.width;
        let meshHeight = meshWidth / layerConfig.aspect;
        const maxHeight = plateWorldHeight * layout.maxHeight;
        if (meshHeight > maxHeight) {
          meshWidth *= maxHeight / meshHeight;
          meshHeight = maxHeight;
        }
        layer.baseX = plateWorldWidth * layout.x;
        layer.baseY = plateWorldHeight * layout.y;
        layer.baseScaleX = meshWidth;
        layer.baseScaleY = meshHeight;
        layer.mesh.rotation.z = (((compact ? layerConfig.mobile.rotation : layerConfig.layout.rotation) ?? 0) * Math.PI) / 180;
        layer.userScale = clamp(layer.userScale, layer.minScale, pageSafeMaxScale(layer));
        constrainLayerToPage(layer);
        layer.mesh.position.x = layer.baseX + layer.userOffsetX;
        layer.mesh.position.y = layer.baseY + layer.userOffsetY;
        layer.mesh.scale.set(meshWidth * layer.userScale, meshHeight * layer.userScale, 1);
      });
    });

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderTargets.forEach((target) => target.setSize(pixelWidth, pixelHeight));
    if (ditherMaterial) {
      ditherMaterial.uniforms.u_resolution.value.set(pixelWidth, pixelHeight);
      ditherMaterial.uniforms.u_pixelRatio.value = dpr;
      ditherMaterial.uniforms.u_imageAspectRatio.value = aspect;
    }
    if (compositeMaterial) {
      compositeMaterial.uniforms.u_resolution.value.set(pixelWidth, pixelHeight);
      compositeMaterial.uniforms.u_plate.value.set(
        platePixels.x / width,
        (height - platePixels.y - platePixels.height) / height,
        platePixels.width / width,
        platePixels.height / height,
      );
      compositeMaterial.uniforms.u_revealRadius.value = Math.min(260, Math.max(140, width * 0.15)) * dpr;
    }
  };

  const getLayerParallax = (layer: LayerRecord): { x: number; y: number } => {
    if (!motionEnabled) return { x: 0, y: 0 };
    const depth = layer.role === "environment" ? 0.010 : layer.role === "figure" ? 0.022 : 0.035;
    return { x: resolvedParallaxX * depth, y: -resolvedParallaxY * depth * 0.55 };
  };

  const getLayerAmbientMotion = (layer: LayerRecord, elapsed: number): { x: number; y: number; scale: number } => {
    if (!motionEnabled) return { x: 0, y: 0, scale: 1 };
    let x = 0;
    let y = 0;
    let scale = 1;
    const effect = SCENES[activeSceneIndex]?.effect;
    if (effect === "crop" && layer.role === "environment") {
      scale = 1 + (Math.sin(elapsed * 0.23) + 1) * 0.004;
    } else if (effect === "sequence" && layer.role === "figure") {
      x += Math.sin(elapsed * 0.34) * 0.012;
    } else if (effect === "sequence" && layer.role === "object") {
      x -= Math.sin(elapsed * 0.34) * 0.018;
    } else if (effect === "scan" && layer.role === "object") {
      x += Math.cos(elapsed * 0.28) * 0.014;
      y += Math.sin(elapsed * 0.28) * 0.010;
    }
    return { x, y, scale };
  };

  const getLayerMotion = (layer: LayerRecord, elapsed: number): { x: number; y: number; scale: number } => {
    const parallax = getLayerParallax(layer);
    const ambient = getLayerAmbientMotion(layer, elapsed);
    return { x: parallax.x + ambient.x, y: parallax.y + ambient.y, scale: ambient.scale };
  };

  function render(time: number): void {
    frame = 0;
    if (!ready || destroyed || contextLost || document.hidden || !renderer || !camera || !scene || !quad || !ditherMaterial || !compositeMaterial || !scratchTarget || !rawTarget || !effectsTarget) return;
    const elapsed = time * 0.001;
    const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) * 0.001, 0.05);
    lastTime = time;
    const record = records[activeSceneIndex];
    if (!record) return;

    record.layers.forEach((layer) => {
      const isDirectDrag = layer === draggingLayer && !dragPending;
      const ambient = isDirectDrag ? getLayerAmbientMotion(layer, elapsed) : null;
      const layerMotion = ambient
        ? { x: dragParallaxOffsetX + ambient.x, y: dragParallaxOffsetY + ambient.y, scale: ambient.scale }
        : getLayerMotion(layer, elapsed);
      layer.mesh.position.x = layer.baseX + layer.userOffsetX + layerMotion.x;
      layer.mesh.position.y = layer.baseY + layer.userOffsetY + layerMotion.y;
      layer.mesh.scale.set(
        layer.baseScaleX * layer.userScale * layerMotion.scale,
        layer.baseScaleY * layer.userScale * layerMotion.scale,
        1,
      );
    });

    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;

    camera.layers.set(ROLE_LAYERS.environment);
    camera.layers.enable(ROLE_LAYERS.figure);
    camera.layers.enable(ROLE_LAYERS.object);
    renderer.setRenderTarget(rawTarget);
    renderer.clear();
    renderer.render(scene, camera);

    camera.layers.set(EFFECT_LAYER);
    renderer.setRenderTarget(effectsTarget);
    renderer.clear();
    renderer.render(scene, camera);

    targetRoles.forEach((role) => {
      const layerConfig = SCENES[activeSceneIndex].layers.find((entry) => entry.role === role);
      const destination = ditherTargets[role];
      if (!layerConfig || !destination) return;
      camera!.layers.set(ROLE_LAYERS[role]);
      renderer!.setRenderTarget(scratchTarget);
      renderer!.clear();
      renderer!.render(scene!, camera!);
      ditherMaterial!.uniforms.u_image.value = scratchTarget!.texture;
      ditherMaterial!.uniforms.u_type.value = layerConfig.dither.type;
      ditherMaterial!.uniforms.u_pxSize.value = layerConfig.dither.pixelSize + Math.sin(registration.get() * Math.PI) * 5.5;
      ditherMaterial!.uniforms.u_colorSteps.value = layerConfig.dither.colorSteps;
      const inkOpacity = role === "environment" ? 0.64 : role === "figure" ? 0.84 : 0.68;
      ditherMaterial!.uniforms.u_colorFront.value.set(INK.x, INK.y, INK.z, inkOpacity);
      ditherMaterial!.uniforms.u_colorHighlight.value.set(INK.x, INK.y, INK.z, inkOpacity);
      quad!.material = ditherMaterial!;
      renderer!.setRenderTarget(destination);
      renderer!.clear();
      quad!.render(renderer!);
    });

    quad.material = compositeMaterial;
    renderer.setRenderTarget(null);
    renderer.clear();
    quad.render(renderer);
    if (motionEnabled) frame = window.requestAnimationFrame(render);
    else if (delta > 0) lastTime = time;
  }

  const boot = async (): Promise<void> => {
    try {
      const nextRenderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
      renderer = nextRenderer;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.domElement.className = "art-canvas";
      renderer.domElement.dataset.webgl = "three";
      stage.append(renderer.domElement);
      scene = new Scene();
      camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
      camera.position.z = 10;

      scratchTarget = makeTarget();
      rawTarget = makeTarget();
      effectsTarget = makeTarget();
      targetRoles.forEach((role) => { ditherTargets[role] = makeTarget(); });

      ditherMaterial = new RawShaderMaterial({
        vertexShader: FULLSCREEN_VERTEX_SHADER,
        fragmentShader: PAPER_FRAGMENT_SHADER,
        glslVersion: GLSL3,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          u_resolution: { value: new Vector2(1, 1) },
          u_pixelRatio: { value: 1 },
          u_originX: { value: 0.5 },
          u_originY: { value: 0.5 },
          u_worldWidth: { value: 0 },
          u_worldHeight: { value: 0 },
          u_fit: { value: 2 },
          u_scale: { value: 1 },
          u_rotation: { value: 0 },
          u_offsetX: { value: 0 },
          u_offsetY: { value: 0 },
          u_colorFront: { value: INK },
          u_colorBack: { value: PAPER },
          u_colorHighlight: { value: INK },
          u_image: { value: null },
          u_imageAspectRatio: { value: 1 },
          u_type: { value: DitheringTypes["8x8"] },
          u_pxSize: { value: 1.8 },
          u_originalColors: { value: false },
          u_inverted: { value: true },
          u_colorSteps: { value: 1 },
        },
      });

      compositeMaterial = new RawShaderMaterial({
        vertexShader: FULLSCREEN_VERTEX_SHADER,
        fragmentShader: COMPOSITE_FRAGMENT_SHADER,
        glslVersion: GLSL3,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          u_resolution: { value: new Vector2(1, 1) },
          u_environment: { value: ditherTargets.environment!.texture },
          u_figure: { value: ditherTargets.figure!.texture },
          u_object: { value: ditherTargets.object!.texture },
          u_effects: { value: effectsTarget.texture },
          u_raw: { value: rawTarget.texture },
          u_paper: { value: new Vector4(238 / 255, 232 / 255, 220 / 255, 1) },
          u_pointer: { value: new Vector2(0.5, 0.5) },
          u_plate: { value: new Vector4(0, 0, 1, 1) },
          u_pointerActive: { value: 0 },
          u_fullReveal: { value: 0 },
          u_revealRadius: { value: 180 },
          u_registration: { value: 0 },
          u_transitionMotion: { value: reducedMotion ? 0 : 1 },
        },
      });
      quad = new FullScreenQuad(compositeMaterial);

      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        contextLost = true;
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        showFallback();
      });
      renderer.domElement.addEventListener("webglcontextrestored", () => {
        contextLost = false;
        showRenderer();
        applyLayout();
        requestRender();
      });

      await loadRecord(0);
      applyLayout();
      setVisibleRecord(0);
      showRenderer();
      requestRender();
      prefetchFollowingRecords();
    } catch {
      showFallback();
    }
  };

  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

  const syncManipulationDataset = (layer: LayerRecord): void => {
    const bounds = layerScreenBounds(layer);
    stage.dataset.activeLayer = layer.role;
    stage.dataset.layerScale = layer.userScale.toFixed(3);
    stage.dataset.layerOffset = `${layer.userOffsetX.toFixed(4)},${layer.userOffsetY.toFixed(4)}`;
    stage.dataset.layerBounds = `${bounds.left.toFixed(1)},${bounds.top.toFixed(1)},${bounds.right.toFixed(1)},${bounds.bottom.toFixed(1)}`;
    stage.dataset.manipulated = "true";
  };

  const setHoveredLayer = (layer: LayerRecord | null): void => {
    hoveredLayer = layer;
    if (layer) {
      stage.dataset.activeLayer = layer.role;
      document.documentElement.dataset.artActive = layer.role;
    } else if (!draggingLayer && !gestureLayer) {
      delete stage.dataset.activeLayer;
      delete document.documentElement.dataset.artActive;
    }
  };

  const hitTestLayer = (clientX: number, clientY: number): LayerRecord | null => {
    const record = records[activeSceneIndex];
    if (!record) return null;
    const priority: readonly LayerRole[] = ["object", "figure", "environment"];
    for (const role of priority) {
      const layer = record.layers.find((candidate) => candidate.role === role);
      if (!layer) continue;
      const bounds = layerScreenBounds(layer);
      if (clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom) return layer;
    }
    return null;
  };

  const openArtwork = (layer: LayerRecord): void => {
    const state = VISUAL_STATES[activeSceneIndex];
    const credit = state?.credits.find((entry) => entry.role === layer.role);
    const layerConfig = SCENES[activeSceneIndex]?.layers.find((entry) => entry.role === layer.role);
    if (!state || !credit || !layerConfig) return;
    const image = layer.material.map?.image;
    options.onArtworkOpen?.({
      state,
      credit,
      imageUrl: layerConfig.source,
      imageElement: image instanceof HTMLImageElement ? image : undefined,
    });
  };

  const moveLayer = (layer: LayerRecord, deltaX: number, deltaY: number): void => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    layer.userOffsetX += (deltaX / width) * aspect * 2;
    layer.userOffsetY -= (deltaY / height) * 2;
    constrainLayerToPage(layer);
    syncManipulationDataset(layer);
    requestRender();
  };

  const moveDraggedLayer = (layer: LayerRecord, clientX: number, clientY: number): void => {
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    layer.userOffsetX = dragOriginOffsetX + ((clientX - dragStartX) / width) * aspect * 2;
    layer.userOffsetY = dragOriginOffsetY - ((clientY - dragStartY) / height) * 2;
    constrainLayerToPage(layer);
    requestRender();
  };

  const scaleLayer = (layer: LayerRecord, scale: number): void => {
    layer.userScale = clamp(scale, layer.minScale, pageSafeMaxScale(layer));
    constrainLayerToPage(layer);
    syncManipulationDataset(layer);
    requestRender();
  };

  const setResizingArtwork = (active: boolean): void => {
    if (resizingArtwork === active) return;
    resizingArtwork = active;
    stage.dataset.resizing = String(active);
    if (active) document.documentElement.dataset.artResizing = "true";
    else delete document.documentElement.dataset.artResizing;
    syncInteractionState();
  };

  const scheduleResizeEnd = (): void => {
    if (resizeEndTimer !== 0) window.clearTimeout(resizeEndTimer);
    resizeEndTimer = window.setTimeout(() => {
      resizeEndTimer = 0;
      setResizingArtwork(false);
    }, 140);
  };

  const resetLayer = (layer: LayerRecord): void => {
    const fromX = layer.userOffsetX;
    const fromY = layer.userOffsetY;
    const fromScale = layer.userScale;
    layer.userOffsetX = 0;
    layer.userOffsetY = 0;
    layer.userScale = 1;
    constrainLayerToPage(layer);
    const targetX = layer.userOffsetX;
    const targetY = layer.userOffsetY;
    layer.userOffsetX = fromX;
    layer.userOffsetY = fromY;
    layer.userScale = fromScale;
    const update = (progress: number): void => {
      layer.userOffsetX = fromX + (targetX - fromX) * progress;
      layer.userOffsetY = fromY + (targetY - fromY) * progress;
      layer.userScale = fromScale + (1 - fromScale) * progress;
      constrainLayerToPage(layer);
      syncManipulationDataset(layer);
      requestRender();
    };
    if (reducedMotion) update(1);
    else animate(0, 1, { duration: 0.42, ease: [0.16, 1, 0.3, 1], onUpdate: update });
  };

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const isInterfaceTarget = (target: EventTarget | null): boolean => (
    target instanceof Element && target.closest("button, a, dialog") !== null
  );

  const beginDirectDrag = (layer: LayerRecord): void => {
    const parallax = getLayerParallax(layer);
    dragParallaxOffsetX = parallax.x;
    dragParallaxOffsetY = parallax.y;
    document.documentElement.dataset.artDragging = layer.role;
    syncInteractionState();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || isInterfaceTarget(event.target)) return;
    const layer = hitTestLayer(event.clientX, event.clientY);
    if (!layer) return;
    draggingLayer = layer;
    draggingPointerId = event.pointerId;
    dragPending = event.pointerType === "touch";
    dragMoved = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOriginOffsetX = layer.userOffsetX;
    dragOriginOffsetY = layer.userOffsetY;
    setHoveredLayer(layer);
    if (!dragPending) {
      beginDirectDrag(layer);
      event.preventDefault();
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    const width = Math.max(window.innerWidth, 1);
    const height = Math.max(window.innerHeight, 1);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    parallaxTargetX.set((event.clientX / width - 0.5) * 2);
    parallaxTargetY.set((event.clientY / height - 0.5) * 2);

    if (draggingLayer && event.pointerId === draggingPointerId) {
      const totalX = event.clientX - dragStartX;
      const totalY = event.clientY - dragStartY;
      if (Math.hypot(totalX, totalY) >= 4) dragMoved = true;
      if (dragPending) {
        if (Math.hypot(totalX, totalY) >= 7) {
          if (Math.abs(totalX) > Math.abs(totalY) * 1.12) {
            dragPending = false;
            beginDirectDrag(draggingLayer);
          } else if (Math.abs(totalY) > Math.abs(totalX)) {
            draggingLayer = null;
            draggingPointerId = -1;
            syncInteractionState();
          }
        }
      }
      if (draggingLayer && !dragPending) {
        moveDraggedLayer(draggingLayer, event.clientX, event.clientY);
        event.preventDefault();
      }
    } else if (event.pointerType !== "touch") {
      setHoveredLayer(isInterfaceTarget(event.target) ? null : hitTestLayer(event.clientX, event.clientY));
    }

    if (!compositeMaterial || !finePointer.matches) return;
    compositeMaterial.uniforms.u_pointer.value.set(event.clientX / width, 1 - event.clientY / height);
    const inside = event.clientX >= platePixels.x
      && event.clientX <= platePixels.x + platePixels.width
      && event.clientY >= platePixels.y
      && event.clientY <= platePixels.y + platePixels.height;
    apertureTarget.set(inside ? 1 : 0);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== draggingPointerId) return;
    const releasedLayer = draggingLayer;
    const wasTap = Boolean(releasedLayer) && !dragMoved;
    if (releasedLayer && !wasTap) {
      const currentParallax = getLayerParallax(releasedLayer);
      releasedLayer.userOffsetX += dragParallaxOffsetX - currentParallax.x;
      releasedLayer.userOffsetY += dragParallaxOffsetY - currentParallax.y;
      constrainLayerToPage(releasedLayer);
      syncManipulationDataset(releasedLayer);
    } else if (releasedLayer && wasTap) {
      releasedLayer.userOffsetX = dragOriginOffsetX;
      releasedLayer.userOffsetY = dragOriginOffsetY;
      constrainLayerToPage(releasedLayer);
      requestRender();
    }
    draggingLayer = null;
    draggingPointerId = -1;
    dragPending = false;
    dragMoved = false;
    delete document.documentElement.dataset.artDragging;
    syncInteractionState();
    if (wasTap && releasedLayer && performance.now() - lastGestureEndTime > 260) openArtwork(releasedLayer);
    if (event.pointerType !== "touch") setHoveredLayer(hitTestLayer(event.clientX, event.clientY));
  };

  const onWheel = (event: WheelEvent): void => {
    if (resizingArtwork) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.ctrlKey) scheduleResizeEnd();
      else return;
    }
    if (isInterfaceTarget(event.target)) return;
    const layer = hitTestLayer(event.clientX, event.clientY) ?? hoveredLayer;
    if (!layer) return;
    if (event.ctrlKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setResizingArtwork(true);
      scheduleResizeEnd();
      scaleLayer(layer, layer.userScale * Math.exp(-event.deltaY * 0.006));
      setHoveredLayer(layer);
    } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.72 && Math.abs(event.deltaX) > 1) {
      event.preventDefault();
      moveLayer(layer, -event.deltaX * 0.72, event.altKey ? event.deltaY * 0.5 : 0);
      setHoveredLayer(layer);
    }
  };

  const onDoubleClick = (event: MouseEvent): void => {
    if (isInterfaceTarget(event.target)) return;
    const layer = hitTestLayer(event.clientX, event.clientY);
    if (layer) resetLayer(layer);
  };

  const onGestureStart = (event: MagnifyGestureEvent): void => {
    if (isInterfaceTarget(event.target)) return;
    gestureLayer = hitTestLayer(event.clientX || lastPointerX, event.clientY || lastPointerY);
    if (!gestureLayer) return;
    gestureStartScale = gestureLayer.userScale;
    setHoveredLayer(gestureLayer);
    if (resizeEndTimer !== 0) {
      window.clearTimeout(resizeEndTimer);
      resizeEndTimer = 0;
    }
    setResizingArtwork(true);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onGestureChange = (event: MagnifyGestureEvent): void => {
    if (!gestureLayer) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    scaleLayer(gestureLayer, gestureStartScale * Math.pow(event.scale, 1.18));
  };

  const onGestureEnd = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
    gestureLayer = null;
    lastGestureEndTime = performance.now();
    setResizingArtwork(false);
  };

  const onManipulationKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && hoveredLayer) resetLayer(hoveredLayer);
  };

  const onPointerLeave = (): void => {
    parallaxTargetX.set(0);
    parallaxTargetY.set(0);
    apertureTarget.set(0);
    if (!draggingLayer) setHoveredLayer(null);
  };

  const onResize = (): void => {
    applyLayout();
    requestRender();
  };

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else {
      requestRender();
    }
  };

  window.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("dblclick", onDoubleClick);
  window.addEventListener("keydown", onManipulationKeyDown);
  window.addEventListener("gesturestart", onGestureStart as EventListener, { passive: false, capture: true });
  window.addEventListener("gesturechange", onGestureChange as EventListener, { passive: false, capture: true });
  window.addEventListener("gestureend", onGestureEnd as EventListener, { passive: false, capture: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  options.onStateChange(VISUAL_STATES[0]);
  void boot();

  return {
    setActualView(enabled: boolean): void {
      animate(fullReveal, enabled ? 1 : 0, { duration: reducedMotion ? 0.12 : 0.48, ease: [0.16, 1, 0.3, 1] });
      stage.dataset.view = enabled ? "actual" : "dither";
    },
    setMotionEnabled(enabled: boolean): void {
      motionEnabled = enabled;
      if (!enabled) {
        parallaxTargetX.set(0);
        parallaxTargetY.set(0);
      }
      requestRender();
    },
    setReducedMotion(enabled: boolean): void {
      reducedMotion = enabled;
      if (compositeMaterial) compositeMaterial.uniforms.u_transitionMotion.value = enabled ? 0 : 1;
      requestRender();
    },
    setScene(index: number): void {
      desiredSceneIndex = clampIndex(index);
      options.onStateChange(VISUAL_STATES[desiredSceneIndex]);
      void activateScene(desiredSceneIndex);
    },
    destroy(): void {
      destroyed = true;
      ready = false;
      registrationAnimation?.stop();
      if (frame) window.cancelAnimationFrame(frame);
      if (resizeEndTimer !== 0) window.clearTimeout(resizeEndTimer);
      draggingLayer = null;
      dragPending = false;
      setResizingArtwork(false);
      syncInteractionState();
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onManipulationKeyDown);
      window.removeEventListener("gesturestart", onGestureStart as EventListener, true);
      window.removeEventListener("gesturechange", onGestureChange as EventListener, true);
      window.removeEventListener("gestureend", onGestureEnd as EventListener, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      records.forEach((record) => {
        record?.layers.forEach((layer) => layer.material.dispose());
        record?.effectMeshes.forEach((mesh) => {
          mesh.geometry.dispose();
          mesh.material.dispose();
        });
      });
      planeGeometry.dispose();
      textures.forEach((texture) => texture.dispose());
      renderTargets.forEach((target) => target.dispose());
      ditherMaterial?.dispose();
      compositeMaterial?.dispose();
      quad?.dispose();
      renderer?.dispose();
      delete document.documentElement.dataset.artActive;
      delete document.documentElement.dataset.artDragging;
      delete document.documentElement.dataset.artResizing;
      stage.remove();
    },
  };
}
