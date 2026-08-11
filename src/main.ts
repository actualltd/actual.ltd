import {
  animate,
  motionValue,
  springValue,
  stagger,
  styleEffect,
  type AnimationPlaybackControls,
} from "motion";
import { createAnimalGlowController } from "./animal-glow";
import {
  resolveAnimalPlacement,
  type AnimalArtworkBounds,
  type PlacementEntropy,
  type PlacementRange,
} from "./scene-placement";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

type Scene = {
  portrait: string;
  landscape: string;
  animal: string;
  previewPortrait: string;
  previewLandscape: string;
  previewAnimal: string;
  cardImages: readonly CardImage[];
  placement: {
    landscape: PlacementRange;
    portrait: PlacementRange;
  };
  artwork: AnimalArtworkBounds;
  glow: string;
  label: string;
  title: string;
  name: string;
  description: string;
  scientific: string;
  range: string;
  habitat: string;
  status: string;
  note: string;
  source: string;
};

type CardImage = {
  src: string;
  preview: string;
  alt: string;
  position: string;
};

function cardImages(slug: string, animal: string, platePosition = "center center"): readonly CardImage[] {
  const base = `/animals/gallery/previews/${slug}`;
  const plate = slug === "05-thresher-shark"
    ? "/animals/cards/05-thresher-shark-orange.webp"
    : `/animals/cards/${slug}.webp`;
  return [
    {
      src: plate,
      preview: `${base}-plate.webp`,
      alt: `Alternate engraved plate of the ${animal}`,
      position: platePosition,
    },
    {
      src: `/animals/gallery/${slug}-study-01.webp`,
      preview: `${base}-study-01.webp`,
      alt: `First independent behavior study of the ${animal}`,
      position: "center center",
    },
    {
      src: `/animals/gallery/${slug}-study-02.webp`,
      preview: `${base}-study-02.webp`,
      alt: `Second independent behavior study of the ${animal}`,
      position: "center center",
    },
  ];
}

type SceneWindow = Window & { __ACTUAL_SCENE__?: number };

const scenes: readonly Scene[] = [
  {
    portrait: "/animals/posters/portrait-01-oryx.png",
    landscape: "/animals/posters/landscape-01-oryx.png",
    animal: "/animals/posters/cutout-01-oryx.png",
    previewPortrait: "/animals/previews/portrait-01-oryx.webp",
    previewLandscape: "/animals/previews/landscape-01-oryx.webp",
    previewAnimal: "/animals/previews/cutout-01-oryx.webp",
    cardImages: cardImages("01-oryx", "Arabian oryx"),
    placement: {
      landscape: { left: [1, 14], bottom: [-4, 3], width: [76, 92] },
      portrait: { left: [-18, 4], bottom: [2, 10], width: [116, 136] },
    },
    artwork: { aspectRatio: 0.9057, alpha: { left: 0.0453, top: 0.025, right: 0.8679, bottom: 0.9469 } },
    glow: "#89ffe4",
    label: "ORYX",
    title: "ARABIAN ORYX",
    name: "Walking oryx",
    description: "An Arabian oryx walking with its head turned away against vivid cobalt blue.",
    scientific: "Oryx leucoryx",
    range: "Arabian Peninsula",
    habitat: "Desert and arid steppe",
    status: "Vulnerable / IUCN",
    note: "Extinct in the wild by 1972, the Arabian oryx returned through coordinated captive breeding and reintroduction programs.",
    source: "https://nc.iucnredlist.org/redlist/amazing-species/oryx-leucoryx/pdfs/original/oryx-leucoryx.pdf",
  },
  {
    portrait: "/animals/posters/portrait-02-crane.png",
    landscape: "/animals/posters/landscape-02-crane.png",
    animal: "/animals/posters/cutout-02-crane.png",
    previewPortrait: "/animals/previews/portrait-02-crane.webp",
    previewLandscape: "/animals/previews/landscape-02-crane.webp",
    previewAnimal: "/animals/previews/cutout-02-crane.webp",
    cardImages: cardImages("02-crane", "red-crowned crane", "right center"),
    placement: {
      landscape: { left: [31, 44], bottom: [-6, 2], width: [55, 68] },
      portrait: { left: [-6, 15], bottom: [0, 8], width: [94, 114] },
    },
    artwork: { aspectRatio: 1.0652, alpha: { left: 0.0587, top: 0.0102, right: 0.95, bottom: 0.8806 } },
    glow: "#ffe58c",
    label: "CRANE",
    title: "RED-CROWNED CRANE",
    name: "Landing crane",
    description: "A red-crowned crane landing with its head turned away against vivid vermilion.",
    scientific: "Grus japonensis",
    range: "Temperate East Asia",
    habitat: "Large wetlands, rivers and marshes",
    status: "Vulnerable / IUCN",
    note: "Two principal populations remain: a migratory mainland population and a resident population on Hokkaido, Japan.",
    source: "https://savingcranes.org/species/red-crowned-crane/",
  },
  {
    portrait: "/animals/posters/portrait-03-stag.png",
    landscape: "/animals/posters/landscape-03-stag.png",
    animal: "/animals/posters/cutout-03-stag.png",
    previewPortrait: "/animals/previews/portrait-03-stag.webp",
    previewLandscape: "/animals/previews/landscape-03-stag.webp",
    previewAnimal: "/animals/previews/cutout-03-stag.webp",
    cardImages: cardImages("03-stag", "red deer", "left center"),
    placement: {
      landscape: { left: [13, 32], bottom: [-8, 1], width: [53, 70] },
      portrait: { left: [-15, 8], bottom: [-4, 4], width: [104, 124] },
    },
    artwork: { aspectRatio: 1.0204, alpha: { left: 0.0612, top: 0.047, right: 0.9347, bottom: 1 } },
    glow: "#d7a8ff",
    label: "STAG",
    title: "RED DEER",
    name: "White stag",
    description: "A white stag seen from behind against vivid ultraviolet.",
    scientific: "Cervus elaphus",
    range: "Europe, North Africa and western Asia",
    habitat: "Woodland, forest edge and open uplands",
    status: "Least concern / IUCN",
    note: "A red-deer stag renews its branching antlers each year, using them during the autumn rut.",
    source: "https://animaldiversity.org/accounts/Cervus_elaphus/",
  },
  {
    portrait: "/animals/posters/portrait-04-tiger.png",
    landscape: "/animals/posters/landscape-04-tiger.png",
    animal: "/animals/posters/cutout-04-tiger.png",
    previewPortrait: "/animals/previews/portrait-04-tiger.webp",
    previewLandscape: "/animals/previews/landscape-04-tiger.webp",
    previewAnimal: "/animals/previews/cutout-04-tiger.webp",
    cardImages: cardImages("04-tiger", "Bengal tiger"),
    placement: {
      landscape: { left: [-4, 10], bottom: [-4, 2], width: [86, 102] },
      portrait: { left: [-8, 10], bottom: [5, 13], width: [94, 114] },
    },
    artwork: { aspectRatio: 0.5333, alpha: { left: 0.0373, top: 0.0512, right: 0.9833, bottom: 0.9437 } },
    glow: "#dfff9f",
    label: "TIGER",
    title: "BENGAL TIGER",
    name: "Stretching tiger",
    description: "A Bengal tiger stretching with its face concealed against vivid emerald.",
    scientific: "Panthera tigris tigris",
    range: "Indian subcontinent",
    habitat: "Forest, grassland and mangrove",
    status: "Endangered / IUCN",
    note: "Tigers have lost more than 93% of their historic range; habitat loss and illegal killing remain major threats.",
    source: "https://nc.iucnredlist.org/redlist/amazing-species/panthera-tigris/pdfs/original/panthera-tigris.pdf",
  },
  {
    portrait: "/animals/posters/portrait-05-thresher-shark.png",
    landscape: "/animals/posters/landscape-05-thresher-shark.png",
    animal: "/animals/posters/cutout-05-thresher-shark.png",
    previewPortrait: "/animals/previews/portrait-05-thresher-shark.webp",
    previewLandscape: "/animals/previews/landscape-05-thresher-shark.webp",
    previewAnimal: "/animals/previews/cutout-05-thresher-shark.webp",
    cardImages: cardImages("05-thresher-shark", "common thresher shark"),
    placement: {
      landscape: { left: [-15, 12], bottom: [-1, 9], width: [74, 96] },
      portrait: { left: [-34, -6], bottom: [3, 12], width: [120, 146] },
    },
    artwork: { aspectRatio: 0.5915, alpha: { left: 0.0176, top: 0.0524, right: 0.9838, bottom: 0.9595 } },
    glow: "#bfa7ff",
    label: "THRESHER",
    title: "COMMON THRESHER",
    name: "Turning thresher shark",
    description: "A common thresher shark sweeping away with its eyes concealed against burnt orange.",
    scientific: "Alopias vulpinus",
    range: "Temperate and subtropical oceans",
    habitat: "Coastal and open-ocean pelagic waters",
    status: "Vulnerable / IUCN",
    note: "Its exceptionally long upper tail lobe can approach the length of its body and is used to strike schooling fish before feeding.",
    source: "https://www.fisheries.noaa.gov/species/pacific-common-thresher-shark",
  },
];

type IdleProfile = {
  x: number[];
  y: number[];
  rotate: number[];
  scale: number[];
  duration: number;
};

const idleProfiles: readonly IdleProfile[] = [
  { x: [0, 3, 0], y: [0, -3, 0], rotate: [0, -0.08, 0], scale: [1, 1.002, 1], duration: 10.5 },
  { x: [0, -3, 0], y: [0, -7, 0], rotate: [0, 0.14, 0], scale: [1, 1.004, 1], duration: 8.8 },
  { x: [0, 0, 0], y: [0, -2, 0], rotate: [0, 0.05, 0], scale: [1, 1.006, 1], duration: 11.5 },
  { x: [0, 2, 0], y: [0, -2, 0], rotate: [0, -0.04, 0], scale: [1, 1.004, 1], duration: 12.5 },
  { x: [0, 10, 0], y: [0, -3, 0], rotate: [0, 0.06, 0], scale: [1, 1.002, 1], duration: 9.2 },
];

const ease = [0.16, 1, 0.3, 1] as const;

const site = requireElement<HTMLElement>("#site");
const backgroundParallax = requireElement<HTMLElement>("#background-parallax");
const animalParallax = requireElement<HTMLElement>("#animal-parallax");
const animalSprite = requireElement<HTMLElement>("#animal-sprite");
const animalGlowHost = requireElement<HTMLElement>("#animal-glow");
const animalControl = requireElement<HTMLButtonElement>("#animal-control");
const heroBackground = requireElement<HTMLImageElement>("#hero-background");
const heroAnimal = requireElement<HTMLImageElement>("#hero-animal");
const wordmark = requireElement<HTMLElement>(".wordmark");
const topMeta = requireElement<HTMLElement>("#top-meta");
const fieldNoteControl = requireElement<HTMLButtonElement>("#field-note-control");
const sceneScientific = requireElement<HTMLElement>("#scene-scientific");
const sceneControl = requireElement<HTMLButtonElement>("#scene-control");
const sceneIndex = requireElement<HTMLElement>("#scene-index");
const sceneName = requireElement<HTMLElement>("#scene-name");
const companyRecord = requireElement<HTMLElement>(".company-record");
const companyControl = requireElement<HTMLButtonElement>("#company-control");
const companyDialog = requireElement<HTMLDialogElement>("#company-dialog");
const companyClose = requireElement<HTMLButtonElement>("#company-close");
const animalDialog = requireElement<HTMLDialogElement>("#animal-dialog");
const animalClose = requireElement<HTMLButtonElement>("#animal-close");
const animalCardImage = requireElement<HTMLImageElement>("#animal-card-image");
const animalCardThumbs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-animal-card-image]"));
const animalCardThumbImages = animalCardThumbs.map((button) => requireElement<HTMLImageElement>(`#${button.dataset.thumbImage}`));
const animalCardIndex = requireElement<HTMLElement>("#animal-card-index");
const animalTitle = requireElement<HTMLElement>("#animal-title");
const animalScientific = requireElement<HTMLElement>("#animal-scientific");
const animalRange = requireElement<HTMLElement>("#animal-range");
const animalHabitat = requireElement<HTMLElement>("#animal-habitat");
const animalStatus = requireElement<HTMLElement>("#animal-status");
const animalNote = requireElement<HTMLElement>("#animal-note");
const animalSource = requireElement<HTMLAnchorElement>("#animal-source");
const visualDescription = requireElement<HTMLElement>("#visual-description");
const ditherLayers = Array.from(document.querySelectorAll<HTMLElement>(".dither-layer"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const portraitLayout = window.matchMedia("(max-aspect-ratio: 4/5)");
const animalGlowController = createAnimalGlowController(animalGlowHost, reducedMotion);

let currentScene = Math.min(
  scenes.length - 1,
  Math.max(0, (window as SceneWindow).__ACTUAL_SCENE__ ?? 0),
);
let sceneRequest = 0;
let sceneDeck: number[] = [];
let transitioning = false;
let sceneAdvancePending = false;
let companyClosing = false;
let animalClosing = false;
let idleAnimation: AnimationPlaybackControls | null = null;
let ditherAnimations: AnimationPlaybackControls[] = [];
const animalHitCanvas = document.createElement("canvas");
const animalHitContext = animalHitCanvas.getContext("2d", { willReadFrequently: true });
const ANIMAL_HIT_ALPHA_THRESHOLD = 48;
let animalAlphaData: Uint8ClampedArray | null = null;
let animalAlphaWidth = 0;
let animalAlphaHeight = 0;
let animalPointerHit = false;
let animalKeyboardHit = false;
let animalCardImageRequest = 0;
let animalDialogOpener: HTMLButtonElement = animalControl;
let placementEntropy: PlacementEntropy = { left: 0.5, bottom: 0.5, width: 0.5 };

function rememberScene(index: number): void {
  try { sessionStorage.setItem("actual-scene", String(index)); } catch {}
}

function backgroundFor(scene: Scene): string {
  return portraitLayout.matches ? scene.portrait : scene.landscape;
}

function previewBackgroundFor(scene: Scene): string {
  return portraitLayout.matches ? scene.previewPortrait : scene.previewLandscape;
}

const imageRequestCache = new Map<string, Promise<HTMLImageElement>>();

function preload(src: string): Promise<HTMLImageElement> {
  const cached = imageRequestCache.get(src);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      void image.decode().catch(() => {}).then(() => resolve(image));
    }, { once: true });
    image.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
    image.src = src;
  });
  imageRequestCache.set(src, request);
  void request.catch(() => {
    if (imageRequestCache.get(src) === request) imageRequestCache.delete(src);
  });
  return request;
}

function warmSceneCache(): void {
  const previews = scenes.flatMap((scene) => [
    scene.previewPortrait,
    scene.previewLandscape,
    scene.previewAnimal,
    ...scene.cardImages.map((image) => image.preview),
  ]);
  void Promise.allSettled(previews.map(preload));

  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  if (connection?.saveData || connection?.effectiveType?.includes("2g")) return;

  const warmFullScenes = (): void => {
    for (const scene of scenes) {
      void preload(scene.portrait);
      void preload(scene.landscape);
      void preload(scene.animal);
    }
  };
  const idleCallback = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idleCallback === "function") {
    idleCallback(warmFullScenes, { timeout: 3_000 });
  } else {
    window.setTimeout(warmFullScenes, 1_000);
  }
}

function updateAnimalHitState(): void {
  const active = animalPointerHit || animalKeyboardHit;
  if (active) {
    const scene = scenes[currentScene];
    void Promise.allSettled(scene.cardImages.map((image) => preload(image.src)));
  }
  animalParallax.dataset.hit = active ? "true" : "false";
  animalGlowController.setHovered(active);
}

function setAnimalHitState(active: boolean): void {
  animalPointerHit = active;
  updateAnimalHitState();
}

function setAnimalKeyboardHit(active: boolean): void {
  animalKeyboardHit = active;
  updateAnimalHitState();
}

async function refreshAnimalHitMask(): Promise<void> {
  const requestedSource = heroAnimal.src;
  animalAlphaData = null;
  setAnimalHitState(false);
  if (!animalHitContext) return;

  try {
    await heroAnimal.decode();
    if (heroAnimal.src !== requestedSource) return;
    animalAlphaWidth = heroAnimal.naturalWidth;
    animalAlphaHeight = heroAnimal.naturalHeight;
    animalHitCanvas.width = animalAlphaWidth;
    animalHitCanvas.height = animalAlphaHeight;
    animalHitContext.clearRect(0, 0, animalAlphaWidth, animalAlphaHeight);
    animalHitContext.drawImage(heroAnimal, 0, 0);
    animalAlphaData = animalHitContext.getImageData(0, 0, animalAlphaWidth, animalAlphaHeight).data;
  } catch {
    animalAlphaData = null;
  }
}

function isOpaqueAnimalPixel(event: MouseEvent | PointerEvent): boolean {
  if (!animalAlphaData || !animalAlphaWidth || !animalAlphaHeight) return false;
  const renderedWidth = heroAnimal.clientWidth;
  const renderedHeight = heroAnimal.clientHeight;
  if (!renderedWidth || !renderedHeight) return false;

  const x = Math.floor(event.offsetX / renderedWidth * animalAlphaWidth);
  const y = Math.floor(event.offsetY / renderedHeight * animalAlphaHeight);
  if (x < 0 || x >= animalAlphaWidth || y < 0 || y >= animalAlphaHeight) return false;
  return animalAlphaData[(y * animalAlphaWidth + x) * 4 + 3] >= ANIMAL_HIT_ALPHA_THRESHOLD;
}

function stopIdleMotion(): void {
  idleAnimation?.stop();
  idleAnimation = null;
}

function startIdleMotion(index: number): void {
  stopIdleMotion();
  if (reducedMotion.matches || document.hidden) return;
  const profile = idleProfiles[index];
  idleAnimation = animate(animalSprite, {
    x: profile.x,
    y: profile.y,
    rotate: profile.rotate,
    scale: profile.scale,
  }, {
    duration: profile.duration,
    ease: "easeInOut",
    repeat: Number.POSITIVE_INFINITY,
  });
}

function startDitherMotion(): void {
  ditherAnimations.forEach((animation) => animation.stop());
  ditherAnimations = [];
  if (reducedMotion.matches || document.hidden) return;

  const [first, second] = ditherLayers;
  if (first) {
    ditherAnimations.push(animate(first, {
      x: [-5, 5, -2],
      y: [-2, 2, -1],
      opacity: [0.08, 0.2, 0.1],
      backgroundPosition: ["0px 0px", "8px 4px", "3px 8px"],
    }, { duration: 6.4, ease: "linear", repeat: Number.POSITIVE_INFINITY }));
  }
  if (second) {
    ditherAnimations.push(animate(second, {
      x: [4, -4, 2],
      y: [2, -1, 3],
      opacity: [0.05, 0.14, 0.07],
      backgroundPosition: ["2px 1px", "-5px 6px", "4px -3px"],
    }, { duration: 8.2, ease: "linear", repeat: Number.POSITIVE_INFINITY }));
  }
}

function initialiseParallax(): () => void {
  const targetX = motionValue(0);
  const targetY = motionValue(0);
  const springOptions = { stiffness: 92, damping: 22, mass: 0.42 };

  const backgroundX = springValue<number>(0, springOptions);
  const backgroundY = springValue<number>(0, springOptions);
  const animalX = springValue<number>(0, springOptions);
  const animalY = springValue<number>(0, springOptions);
  const wordmarkX = springValue<number>(0, springOptions);
  const wordmarkY = springValue<number>(0, springOptions);

  styleEffect(backgroundParallax, { x: backgroundX, y: backgroundY });
  styleEffect(animalParallax, { x: animalX, y: animalY });
  styleEffect(wordmark, { x: wordmarkX, y: wordmarkY });

  const updateDepth = (): void => {
    if (reducedMotion.matches) {
      backgroundX.set(0);
      backgroundY.set(0);
      animalX.set(0);
      animalY.set(0);
      wordmarkX.set(0);
      wordmarkY.set(0);
      return;
    }
    const x = targetX.get();
    const y = targetY.get();
    backgroundX.set(x * -14);
    backgroundY.set(y * -8);
    animalX.set(x * Math.min(52, window.innerWidth * 0.048));
    animalY.set(y * 30);
    wordmarkX.set(x * 24);
    wordmarkY.set(y * 14);
  };

  targetX.on("change", updateDepth);
  targetY.on("change", updateDepth);

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    targetX.set(event.clientX / Math.max(window.innerWidth, 1) - 0.5);
    targetY.set(event.clientY / Math.max(window.innerHeight, 1) - 0.5);
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", () => {
    targetX.set(0);
    targetY.set(0);
  });
  return () => {
    if (reducedMotion.matches) {
      targetX.set(0);
      targetY.set(0);
    }
    updateDepth();
  };
}

async function runInitialEntrance(): Promise<void> {
  site.dataset.ready = "true";
  if (reducedMotion.matches) {
    startIdleMotion(currentScene);
    return;
  }

  const backgroundReveal = animate(backgroundParallax, {
    clipPath: ["inset(0 0 100% 0)", "inset(0 0 0% 0)"],
  }, { duration: 1.55, ease });
  const backgroundTone = animate(heroBackground, {
    opacity: [0, 1],
    filter: ["saturate(.58) contrast(.9) brightness(1.08)", "saturate(1) contrast(1) brightness(1)"],
  }, { duration: 1.4, ease });
  const animalEntrance = animate(animalSprite, {
    opacity: [0, 1],
    y: [42, 0],
    scale: [0.975, 1],
    clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 1.25, delay: 0.38, ease });
  animate(".wordmark-letter", {
    opacity: [0, 1],
    y: ["38%", "0%"],
  }, { duration: 0.9, delay: stagger(0.045, { startDelay: 0.46 }), ease });
  animate(sceneControl, {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  }, { duration: 0.95, delay: 0.18, ease });
  animate(topMeta, {
    opacity: [0, 1],
    y: [-8, 0],
  }, { duration: 0.7, delay: 0.12, ease });
  animate(sceneControl.querySelectorAll("[data-scene-label]"), {
    opacity: [0, 1],
    y: [-12, 0],
  }, { duration: 0.65, delay: stagger(0.06, { startDelay: 0.38 }), ease });
  animate(companyRecord, {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  }, { duration: 0.95, delay: 0.32, ease });
  animate(Array.from(companyRecord.children), {
    opacity: [0, 1],
    y: [12, 0],
  }, { duration: 0.7, delay: stagger(0.055, { startDelay: 0.52 }), ease });

  startDitherMotion();
  await Promise.all([backgroundReveal.finished, backgroundTone.finished, animalEntrance.finished]);
  startIdleMotion(currentScene);
}

async function exitScene(): Promise<void> {
  stopIdleMotion();
  if (reducedMotion.matches) return;

  const animalExit = animate(animalSprite, {
    opacity: [1, 0],
    y: [0, -18],
  }, { duration: 0.22, ease: [0.7, 0, 0.84, 0] });
  const backgroundExit = animate(heroBackground, {
    opacity: [1, 0.58],
    filter: ["saturate(1) contrast(1)", "saturate(.72) contrast(.94)"],
  }, { duration: 0.24, ease: [0.7, 0, 0.84, 0] });
  const labelExit = animate(sceneControl.querySelectorAll("[data-scene-label]"), {
    opacity: [1, 0],
    y: [0, -10],
  }, { duration: 0.18, delay: stagger(0.015, { from: "last" }), ease: "easeIn" });
  animate(sceneScientific, {
    opacity: [1, 0],
    y: [0, -7],
  }, { duration: 0.16, ease: "easeIn" });
  animate(".wordmark-letter", {
    opacity: [1, 0.48],
    y: [0, 10],
  }, { duration: 0.22, delay: stagger(0.012, { from: "last" }), ease: "easeIn" });

  await Promise.all([animalExit.finished, backgroundExit.finished, labelExit.finished]);
}

async function enterScene(index: number): Promise<void> {
  if (reducedMotion.matches) {
    startIdleMotion(index);
    return;
  }

  const backgroundEntrance = animate(heroBackground, {
    opacity: [0.58, 1],
    filter: ["saturate(.72) contrast(.94)", "saturate(1) contrast(1)"],
  }, { duration: 0.4, ease });
  const animalEntrance = animate(animalSprite, {
    opacity: [0, 1],
    y: [30, 0],
    scale: [0.985, 1],
    clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 0.5, delay: 0.035, ease });
  animate(sceneControl.querySelectorAll("[data-scene-label]"), {
    opacity: [0, 1],
    y: [12, 0],
  }, { duration: 0.32, delay: stagger(0.035, { startDelay: 0.05 }), ease });
  animate(sceneScientific, {
    opacity: [0, 1],
    y: [7, 0],
  }, { duration: 0.3, delay: 0.04, ease });
  animate(".wordmark-letter", {
    opacity: [0.48, 1],
    y: [10, 0],
  }, { duration: 0.4, delay: stagger(0.016, { startDelay: 0.04 }), ease });

  await Promise.all([backgroundEntrance.finished, animalEntrance.finished]);
  startIdleMotion(index);
}

function applyAnimalPlacement(scene: Scene, reroll = false): void {
  if (reroll) {
    placementEntropy = { left: randomUnit(), bottom: randomUnit(), width: randomUnit() };
  }
  const range = portraitLayout.matches ? scene.placement.portrait : scene.placement.landscape;
  const placement = resolveAnimalPlacement(range, scene.artwork, placementEntropy, {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  animalSprite.style.setProperty("--animal-left", `${placement.left.toFixed(2)}vw`);
  animalSprite.style.setProperty("--animal-bottom", `${placement.bottom.toFixed(2)}vh`);
  animalSprite.style.setProperty("--animal-width", `${placement.width.toFixed(2)}vw`);
}

function applyScenePreview(index: number): void {
  const scene = scenes[index];
  currentScene = index;
  document.documentElement.dataset.scene = String(index);
  document.documentElement.style.setProperty("--glow", scene.glow);
  applyAnimalPlacement(scene, true);
  heroBackground.dataset.resolution = "preview";
  heroAnimal.dataset.resolution = "preview";
  heroBackground.src = previewBackgroundFor(scene);
  heroAnimal.src = scene.previewAnimal;
  void refreshAnimalHitMask();
  heroAnimal.alt = scene.description;
  sceneIndex.textContent = `#${String(index).padStart(3, "0")}`;
  sceneName.textContent = scene.label;
  sceneScientific.textContent = scene.scientific;
  visualDescription.textContent = scene.description;
  sceneControl.setAttribute("aria-label", `Show another animal. Current image: ${scene.name}`);
  animalControl.setAttribute("aria-label", `Open details about the ${scene.label.toLowerCase()}`);
  rememberScene(index);
}

async function upgradeSceneAssets(
  request: number,
  index: number,
  background: string,
  fullAssetsReady: Promise<readonly [HTMLImageElement, HTMLImageElement]>,
): Promise<void> {
  try {
    await fullAssetsReady;
    if (request !== sceneRequest || currentScene !== index) return;
    heroBackground.src = background;
    heroAnimal.src = scenes[index].animal;
    heroBackground.dataset.resolution = "full";
    heroAnimal.dataset.resolution = "full";
    await refreshAnimalHitMask();
  } catch {
    // The preview remains usable when the full asset cannot be fetched.
  }
}

function selectAnimalCardImage(scene: Scene, imageIndex: number, animateChange: boolean): void {
  const image = scene.cardImages[imageIndex];
  if (!image) return;
  const request = ++animalCardImageRequest;

  animalCardThumbs.forEach((button, index) => {
    const selected = index === imageIndex;
    button.dataset.selected = selected ? "true" : "false";
    button.setAttribute("aria-pressed", String(selected));
  });

  animalCardImage.dataset.resolution = "preview";
  animalCardImage.src = image.preview;
  animalCardImage.alt = image.alt;
  animalCardImage.style.objectPosition = image.position;
  if (animateChange && !reducedMotion.matches) {
    animate(animalCardImage, {
      opacity: [0.36, 1],
      scale: [1.018, 1],
    }, { duration: 0.38, ease: [0.22, 1, 0.36, 1] });
  }

  void preload(image.src).then(() => {
    if (request !== animalCardImageRequest || !animalDialog.open) return;
    animalCardImage.src = image.src;
    animalCardImage.dataset.resolution = "full";
  }, () => {});
}

function populateAnimalCard(scene: Scene, index: number): void {
  scene.cardImages.forEach((image, imageIndex) => {
    const thumb = animalCardThumbImages[imageIndex];
    const button = animalCardThumbs[imageIndex];
    if (!thumb || !button) return;
    thumb.src = image.preview;
    thumb.alt = "";
    thumb.style.objectPosition = image.position;
    button.setAttribute("aria-label", `Show image ${imageIndex + 1} of ${scene.cardImages.length}: ${image.alt}`);
  });
  selectAnimalCardImage(scene, 0, false);
  void Promise.allSettled(scene.cardImages.map((image) => preload(image.src)));
  animalCardIndex.textContent = `#${String(index).padStart(3, "0")}`;
  animalTitle.textContent = scene.title;
  animalScientific.textContent = scene.scientific;
  animalRange.textContent = scene.range;
  animalHabitat.textContent = scene.habitat;
  animalStatus.textContent = scene.status;
  animalNote.textContent = scene.note;
  animalSource.href = scene.source;
}

async function renderScene(index: number, initial = false): Promise<void> {
  if (transitioning && !initial) {
    sceneAdvancePending = true;
    return;
  }
  const request = ++sceneRequest;
  const scene = scenes[index];
  const background = backgroundFor(scene);
  const fullAssetsReady = Promise.all([
    preload(background),
    preload(scene.animal),
  ]);
  transitioning = true;
  site.dataset.switching = "true";
  sceneControl.setAttribute("aria-busy", "true");
  setAnimalHitState(false);
  setAnimalKeyboardHit(false);

  try {
    if (!initial) await exitScene();
    if (request !== sceneRequest) return;
    applyScenePreview(index);
    void upgradeSceneAssets(request, index, background, fullAssetsReady);
    void fullAssetsReady.then(
      () => {
        if (request !== sceneRequest || currentScene !== index) return;
        return animalGlowController.prepare(String(index), scene.animal, scene.glow);
      },
      () => {},
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (initial) await runInitialEntrance();
    else await enterScene(index);
  } finally {
    if (request === sceneRequest) {
      transitioning = false;
      if (sceneAdvancePending) {
        sceneAdvancePending = false;
        queueMicrotask(() => { void renderScene(nextScene()); });
      } else {
        site.dataset.switching = "false";
        sceneControl.setAttribute("aria-busy", "false");
      }
    }
  }
}

function randomUnit(): number {
  if (window.crypto?.getRandomValues) {
    const entropy = new Uint32Array(1);
    window.crypto.getRandomValues(entropy);
    return entropy[0] / 4294967296;
  }
  return Math.random();
}

function randomIndex(length: number): number {
  return Math.floor(randomUnit() * length);
}

function refillSceneDeck(exclude: number): void {
  sceneDeck = scenes.map((_, index) => index).filter((index) => index !== exclude);
  for (let index = sceneDeck.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [sceneDeck[index], sceneDeck[swap]] = [sceneDeck[swap], sceneDeck[index]];
  }
}

function nextScene(): number {
  if (sceneDeck.length === 0) refillSceneDeck(currentScene);
  return sceneDeck.shift() ?? currentScene;
}

sceneControl.addEventListener("click", () => {
  if (transitioning) {
    sceneAdvancePending = true;
    return;
  }
  void renderScene(nextScene());
});

function openAnimalDialog(opener: HTMLButtonElement = animalControl): void {
  if (animalDialog.open || animalClosing || transitioning) return;
  populateAnimalCard(scenes[currentScene], currentScene);
  setAnimalHitState(false);
  setAnimalKeyboardHit(false);
  stopIdleMotion();
  animalDialogOpener = opener;
  animalDialog.showModal();
  animalControl.setAttribute("aria-expanded", String(opener === animalControl));
  fieldNoteControl.setAttribute("aria-expanded", String(opener === fieldNoteControl));
  if (reducedMotion.matches) {
    animalDialog.style.opacity = "1";
    return;
  }
  animate(animalDialog, { opacity: [0, 1] }, { duration: 0.3, ease });
  animate(animalDialog.querySelector(".animal-card")!, {
    opacity: [0, 1],
    y: [34, 0],
    scale: [0.985, 1],
    clipPath: ["inset(5% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 0.62, ease });
}

async function closeAnimalDialog(): Promise<void> {
  if (!animalDialog.open || animalClosing) return;
  animalClosing = true;
  if (!reducedMotion.matches) {
    await animate(animalDialog.querySelector(".animal-card")!, {
      opacity: [1, 0],
      y: [0, 24],
      scale: [1, 0.992],
    }, { duration: 0.16, ease: [0.7, 0, 0.84, 0] }).finished;
  }
  animalDialog.close();
}

heroAnimal.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  setAnimalHitState(isOpaqueAnimalPixel(event));
});
heroAnimal.addEventListener("pointerleave", () => { setAnimalHitState(false); });
animalControl.addEventListener("focus", () => {
  queueMicrotask(() => setAnimalKeyboardHit(animalControl.matches(":focus-visible")));
});
animalControl.addEventListener("blur", () => { setAnimalKeyboardHit(false); });
animalControl.addEventListener("click", (event) => {
  if (event.detail === 0 || isOpaqueAnimalPixel(event)) openAnimalDialog(animalControl);
});
fieldNoteControl.addEventListener("click", () => { openAnimalDialog(fieldNoteControl); });
animalClose.addEventListener("click", () => { void closeAnimalDialog(); });
animalCardThumbs.forEach((button, imageIndex) => {
  button.addEventListener("click", () => {
    if (!animalDialog.open || animalClosing) return;
    selectAnimalCardImage(scenes[currentScene], imageIndex, true);
  });
});
animalDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  void closeAnimalDialog();
});
animalDialog.addEventListener("click", (event) => {
  if (event.target !== animalDialog) return;
  const bounds = animalDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) void closeAnimalDialog();
});
animalDialog.addEventListener("close", () => {
  animalCardImageRequest += 1;
  animalClosing = false;
  animalControl.setAttribute("aria-expanded", "false");
  fieldNoteControl.setAttribute("aria-expanded", "false");
  animalDialog.style.opacity = "0";
  startIdleMotion(currentScene);
  if (document.activeElement === document.body) animalDialogOpener.focus();
});

function openCompanyDialog(): void {
  if (companyDialog.open || companyClosing) return;
  companyDialog.showModal();
  companyControl.setAttribute("aria-expanded", "true");
  if (reducedMotion.matches) {
    companyDialog.style.opacity = "1";
    return;
  }
  animate(companyDialog, {
    opacity: [0, 1],
    y: [32, 0],
    scale: [0.985, 1],
  }, { duration: 0.52, ease });
}

async function closeCompanyDialog(): Promise<void> {
  if (!companyDialog.open || companyClosing) return;
  companyClosing = true;
  if (!reducedMotion.matches) {
    await animate(companyDialog, {
      opacity: [1, 0],
      y: [0, 22],
      scale: [1, 0.99],
    }, { duration: 0.16, ease: [0.7, 0, 0.84, 0] }).finished;
  }
  companyDialog.close();
}

companyControl.addEventListener("click", openCompanyDialog);
companyClose.addEventListener("click", () => { void closeCompanyDialog(); });
companyDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  void closeCompanyDialog();
});
companyDialog.addEventListener("click", (event) => {
  if (event.target !== companyDialog) return;
  const bounds = companyDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) void closeCompanyDialog();
});
companyDialog.addEventListener("close", () => {
  companyClosing = false;
  companyControl.setAttribute("aria-expanded", "false");
  companyDialog.style.opacity = "0";
});

portraitLayout.addEventListener("change", () => {
  const scene = scenes[currentScene];
  applyAnimalPlacement(scene);
  const request = sceneRequest;
  const background = backgroundFor(scene);
  heroBackground.dataset.resolution = "preview";
  heroBackground.src = previewBackgroundFor(scene);
  void preload(background).then(() => {
    if (request !== sceneRequest) return;
    heroBackground.src = background;
    heroBackground.dataset.resolution = "full";
    if (!reducedMotion.matches) {
      animate(heroBackground, { opacity: [0.68, 1] }, { duration: 0.55, ease });
    }
  });
});

let placementFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(placementFrame);
  placementFrame = requestAnimationFrame(() => {
    applyAnimalPlacement(scenes[currentScene]);
  });
}, { passive: true });

const syncParallaxMotion = initialiseParallax();

document.addEventListener("visibilitychange", () => {
  animalGlowController.setDocumentVisible(!document.hidden);
  if (document.hidden) {
    stopIdleMotion();
    ditherAnimations.forEach((animation) => animation.pause());
  } else {
    startIdleMotion(currentScene);
    startDitherMotion();
  }
});

reducedMotion.addEventListener("change", () => {
  updateAnimalHitState();
  syncParallaxMotion();
  if (reducedMotion.matches) {
    stopIdleMotion();
    ditherAnimations.forEach((animation) => animation.stop());
    ditherAnimations = [];
  } else if (!document.hidden) {
    startIdleMotion(currentScene);
    startDitherMotion();
  }
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) animalGlowController.dispose();
}, { once: true });

warmSceneCache();
void renderScene(currentScene, true);
