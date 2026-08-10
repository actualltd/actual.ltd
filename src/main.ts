import "./styles.css";
import {
  animate,
  motionValue,
  springValue,
  stagger,
  styleEffect,
  type AnimationPlaybackControls,
} from "motion";
import { createAnimalGlowController } from "./animal-glow";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

type Scene = {
  portrait: string;
  landscape: string;
  animal: string;
  cardImage: string;
  glow: string;
  label: string;
  name: string;
  description: string;
  scientific: string;
  range: string;
  habitat: string;
  status: string;
  note: string;
  source: string;
};

type SceneWindow = Window & { __ACTUAL_SCENE__?: number };

const scenes: readonly Scene[] = [
  {
    portrait: "/animals/posters/portrait-01-oryx.png",
    landscape: "/animals/posters/landscape-01-oryx.png",
    animal: "/animals/posters/cutout-01-oryx.png",
    cardImage: "/animals/cards/01-oryx.webp",
    glow: "#72fff1",
    label: "ORYX",
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
    cardImage: "/animals/cards/02-crane.webp",
    glow: "#fff36b",
    label: "CRANE",
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
    cardImage: "/animals/cards/03-stag.webp",
    glow: "#ff81ed",
    label: "STAG",
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
    cardImage: "/animals/cards/04-tiger.webp",
    glow: "#fff36b",
    label: "TIGER",
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
    portrait: "/animals/posters/portrait-05-sailfish.png",
    landscape: "/animals/posters/landscape-05-sailfish.png",
    animal: "/animals/posters/cutout-05-sailfish.png",
    cardImage: "/animals/cards/05-sailfish.webp",
    glow: "#78f7ff",
    label: "SAILFISH",
    name: "Swimming sailfish",
    description: "A sailfish swimming out of frame against vivid saffron.",
    scientific: "Istiophorus platypterus",
    range: "Tropical and subtropical oceans",
    habitat: "Pelagic water near the surface",
    status: "Least concern / IUCN",
    note: "Satellite-tagged sailfish frequently cross national waters, making regional cooperation central to their management.",
    source: "https://www.fisheries.noaa.gov/inport/item/26518",
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
const heroBackground = requireElement<HTMLImageElement>("#hero-background");
const heroAnimal = requireElement<HTMLImageElement>("#hero-animal");
const wordmark = requireElement<HTMLElement>(".wordmark");
const topMeta = requireElement<HTMLElement>("#top-meta");
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

function rememberScene(index: number): void {
  try { sessionStorage.setItem("actual-scene", String(index)); } catch {}
}

function backgroundFor(scene: Scene): string {
  return portraitLayout.matches ? scene.portrait : scene.landscape;
}

function preload(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
    image.src = src;
  });
}

function updateAnimalHitState(): void {
  const active = animalPointerHit || animalKeyboardHit;
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

function initialiseParallax(): void {
  if (reducedMotion.matches) return;

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
    const x = targetX.get();
    const y = targetY.get();
    backgroundX.set(x * -14);
    backgroundY.set(y * -8);
    animalX.set(x * 52);
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
  animate(sceneControl.querySelectorAll("span"), {
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
  }, { duration: 0.42, ease: [0.7, 0, 0.84, 0] });
  const backgroundExit = animate(heroBackground, {
    opacity: [1, 0.58],
    filter: ["saturate(1) contrast(1)", "saturate(.72) contrast(.94)"],
  }, { duration: 0.46, ease: [0.7, 0, 0.84, 0] });
  const labelExit = animate(sceneControl.querySelectorAll("span"), {
    opacity: [1, 0],
    y: [0, -10],
  }, { duration: 0.28, delay: stagger(0.025, { from: "last" }), ease: "easeIn" });
  animate(sceneScientific, {
    opacity: [1, 0],
    y: [0, -7],
  }, { duration: 0.24, ease: "easeIn" });
  animate(".wordmark-letter", {
    opacity: [1, 0.48],
    y: [0, 10],
  }, { duration: 0.34, delay: stagger(0.018, { from: "last" }), ease: "easeIn" });

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
  }, { duration: 0.72, ease });
  const animalEntrance = animate(animalSprite, {
    opacity: [0, 1],
    y: [30, 0],
    scale: [0.985, 1],
    clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 0.88, delay: 0.08, ease });
  animate(sceneControl.querySelectorAll("span"), {
    opacity: [0, 1],
    y: [12, 0],
  }, { duration: 0.52, delay: stagger(0.055, { startDelay: 0.12 }), ease });
  animate(sceneScientific, {
    opacity: [0, 1],
    y: [7, 0],
  }, { duration: 0.48, delay: 0.08, ease });
  animate(".wordmark-letter", {
    opacity: [0.48, 1],
    y: [10, 0],
  }, { duration: 0.62, delay: stagger(0.026, { startDelay: 0.08 }), ease });

  await Promise.all([backgroundEntrance.finished, animalEntrance.finished]);
  startIdleMotion(index);
}

function applyScene(index: number, background: string): void {
  const scene = scenes[index];
  currentScene = index;
  document.documentElement.dataset.scene = String(index);
  document.documentElement.style.setProperty("--glow", scene.glow);
  heroBackground.src = background;
  heroAnimal.src = scene.animal;
  void refreshAnimalHitMask();
  heroAnimal.alt = scene.description;
  sceneIndex.textContent = `#${String(index).padStart(3, "0")}`;
  sceneName.textContent = scene.label;
  sceneScientific.textContent = scene.scientific;
  visualDescription.textContent = scene.description;
  sceneControl.setAttribute("aria-label", `Show another animal. Current image: ${scene.name}`);
  heroAnimal.setAttribute("aria-label", `Open details about the ${scene.label.toLowerCase()}`);
  populateAnimalCard(scene, index);
  rememberScene(index);
}

function populateAnimalCard(scene: Scene, index: number): void {
  animalCardImage.src = scene.cardImage;
  animalCardImage.alt = `Alternate illustrated plate of the ${scene.label.toLowerCase()}`;
  animalCardIndex.textContent = `#${String(index).padStart(3, "0")}`;
  animalTitle.textContent = scene.label === "ORYX" ? "ARABIAN ORYX"
    : scene.label === "CRANE" ? "RED-CROWNED CRANE"
      : scene.label === "STAG" ? "RED DEER"
        : scene.label === "TIGER" ? "BENGAL TIGER"
          : "SAILFISH";
  animalScientific.textContent = scene.scientific;
  animalRange.textContent = scene.range;
  animalHabitat.textContent = scene.habitat;
  animalStatus.textContent = scene.status;
  animalNote.textContent = scene.note;
  animalSource.href = scene.source;
}

async function renderScene(index: number, initial = false): Promise<void> {
  if (transitioning && !initial) return;
  const request = ++sceneRequest;
  const scene = scenes[index];
  const background = backgroundFor(scene);
  transitioning = true;
  site.dataset.switching = "true";
  setAnimalHitState(false);
  setAnimalKeyboardHit(false);

  try {
    await Promise.all([
      preload(background),
      preload(scene.animal),
      animalGlowController.prepare(String(index), scene.animal, scene.glow),
    ]);
    if (request !== sceneRequest) return;
    if (!initial) await exitScene();
    if (request !== sceneRequest) return;
    applyScene(index, background);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (initial) await runInitialEntrance();
    else await enterScene(index);
  } finally {
    if (request === sceneRequest) {
      transitioning = false;
      site.dataset.switching = "false";
    }
  }
}

function randomIndex(length: number): number {
  if (window.crypto?.getRandomValues) {
    const entropy = new Uint32Array(1);
    window.crypto.getRandomValues(entropy);
    return entropy[0] % length;
  }
  return Math.floor(Math.random() * length);
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
  void renderScene(nextScene());
});

function openAnimalDialog(): void {
  if (animalDialog.open || animalClosing || transitioning) return;
  populateAnimalCard(scenes[currentScene], currentScene);
  setAnimalHitState(false);
  setAnimalKeyboardHit(false);
  stopIdleMotion();
  animalDialog.showModal();
  heroAnimal.setAttribute("aria-expanded", "true");
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
    }, { duration: 0.26, ease: [0.7, 0, 0.84, 0] }).finished;
  }
  animalDialog.close();
}

heroAnimal.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  setAnimalHitState(isOpaqueAnimalPixel(event));
});
heroAnimal.addEventListener("pointerleave", () => { setAnimalHitState(false); });
heroAnimal.addEventListener("focus", () => {
  queueMicrotask(() => setAnimalKeyboardHit(heroAnimal.matches(":focus-visible")));
});
heroAnimal.addEventListener("blur", () => { setAnimalKeyboardHit(false); });
heroAnimal.addEventListener("click", (event) => {
  if (isOpaqueAnimalPixel(event)) openAnimalDialog();
});
heroAnimal.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  setAnimalKeyboardHit(true);
  openAnimalDialog();
});
animalClose.addEventListener("click", () => { void closeAnimalDialog(); });
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
  animalClosing = false;
  heroAnimal.setAttribute("aria-expanded", "false");
  animalDialog.style.opacity = "0";
  startIdleMotion(currentScene);
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
    }, { duration: 0.28, ease: [0.7, 0, 0.84, 0] }).finished;
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
  const background = backgroundFor(scenes[currentScene]);
  void preload(background).then(() => {
    heroBackground.src = background;
    if (!reducedMotion.matches) {
      animate(heroBackground, { opacity: [0.68, 1] }, { duration: 0.55, ease });
    }
  });
});

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
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) animalGlowController.dispose();
}, { once: true });

initialiseParallax();
void renderScene(currentScene, true);
