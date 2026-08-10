import "./styles.css";
import { animate, stagger, type AnimationPlaybackControls } from "motion";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

type Scene = {
  portrait: string;
  landscape: string;
  animal: string;
  label: string;
  name: string;
  description: string;
};

type SceneWindow = Window & { __ACTUAL_SCENE__?: number };

const scenes: readonly Scene[] = [
  {
    portrait: "/animals/posters/portrait-01-oryx.png",
    landscape: "/animals/posters/landscape-01-oryx.png",
    animal: "/animals/posters/cutout-01-oryx.png",
    label: "ORYX",
    name: "Walking oryx",
    description: "An Arabian oryx walking with its head turned away against vivid cobalt blue.",
  },
  {
    portrait: "/animals/posters/portrait-02-crane.png",
    landscape: "/animals/posters/landscape-02-crane.png",
    animal: "/animals/posters/cutout-02-crane.png",
    label: "CRANE",
    name: "Landing crane",
    description: "A red-crowned crane landing with its head turned away against vivid vermilion.",
  },
  {
    portrait: "/animals/posters/portrait-03-stag.png",
    landscape: "/animals/posters/landscape-03-stag.png",
    animal: "/animals/posters/cutout-03-stag.png",
    label: "STAG",
    name: "White stag",
    description: "A white stag seen from behind against vivid ultraviolet.",
  },
  {
    portrait: "/animals/posters/portrait-04-tiger.png",
    landscape: "/animals/posters/landscape-04-tiger.png",
    animal: "/animals/posters/cutout-04-tiger.png",
    label: "TIGER",
    name: "Stretching tiger",
    description: "A Bengal tiger stretching with its face concealed against vivid emerald.",
  },
  {
    portrait: "/animals/posters/portrait-05-sailfish.png",
    landscape: "/animals/posters/landscape-05-sailfish.png",
    animal: "/animals/posters/cutout-05-sailfish.png",
    label: "SAILFISH",
    name: "Swimming sailfish",
    description: "A sailfish swimming out of frame against vivid saffron.",
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
const heroBackground = requireElement<HTMLImageElement>("#hero-background");
const heroAnimal = requireElement<HTMLImageElement>("#hero-animal");
const sceneControl = requireElement<HTMLButtonElement>("#scene-control");
const sceneIndex = requireElement<HTMLElement>("#scene-index");
const sceneName = requireElement<HTMLElement>("#scene-name");
const companyRecord = requireElement<HTMLElement>(".company-record");
const visualDescription = requireElement<HTMLElement>("#visual-description");
const ditherLayers = Array.from(document.querySelectorAll<HTMLElement>(".dither-layer"));
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const portraitLayout = window.matchMedia("(max-aspect-ratio: 4/5)");

let currentScene = Math.min(
  scenes.length - 1,
  Math.max(0, (window as SceneWindow).__ACTUAL_SCENE__ ?? 0),
);
let sceneRequest = 0;
let sceneDeck: number[] = [];
let transitioning = false;
let idleAnimation: AnimationPlaybackControls | null = null;
let ditherAnimations: AnimationPlaybackControls[] = [];

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

function stopIdleMotion(): void {
  idleAnimation?.stop();
  idleAnimation = null;
}

function startIdleMotion(index: number): void {
  stopIdleMotion();
  if (reducedMotion.matches || document.hidden) return;
  const profile = idleProfiles[index];
  idleAnimation = animate(heroAnimal, {
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

async function runInitialEntrance(): Promise<void> {
  site.dataset.ready = "true";
  if (reducedMotion.matches) {
    startIdleMotion(currentScene);
    return;
  }

  const backgroundEntrance = animate(heroBackground, {
    opacity: [0, 1],
    filter: ["saturate(.72) contrast(.94)", "saturate(1) contrast(1)"],
  }, { duration: 1.15, ease });
  const animalEntrance = animate(heroAnimal, {
    opacity: [0, 1],
    y: [42, 0],
    scale: [0.975, 1],
    clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 1.25, delay: 0.12, ease });
  animate(".wordmark-letter", {
    opacity: [0, 1],
    y: ["38%", "0%"],
  }, { duration: 0.9, delay: stagger(0.045, { startDelay: 0.22 }), ease });
  animate(sceneControl, {
    clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  }, { duration: 0.95, delay: 0.18, ease });
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
  await Promise.all([backgroundEntrance.finished, animalEntrance.finished]);
  startIdleMotion(currentScene);
}

async function exitScene(): Promise<void> {
  stopIdleMotion();
  if (reducedMotion.matches) return;

  const animalExit = animate(heroAnimal, {
    opacity: [1, 0],
    y: [0, -18],
    filter: ["blur(0px)", "blur(7px)"],
  }, { duration: 0.42, ease: [0.7, 0, 0.84, 0] });
  const backgroundExit = animate(heroBackground, {
    opacity: [1, 0.58],
    filter: ["saturate(1) contrast(1)", "saturate(.72) contrast(.94)"],
  }, { duration: 0.46, ease: [0.7, 0, 0.84, 0] });
  const labelExit = animate(sceneControl.querySelectorAll("span"), {
    opacity: [1, 0],
    y: [0, -10],
  }, { duration: 0.28, delay: stagger(0.025, { from: "last" }), ease: "easeIn" });
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
  const animalEntrance = animate(heroAnimal, {
    opacity: [0, 1],
    y: [30, 0],
    scale: [0.985, 1],
    filter: ["blur(7px)", "blur(0px)"],
    clipPath: ["inset(100% 0 0 0)", "inset(0% 0 0 0)"],
  }, { duration: 0.88, delay: 0.08, ease });
  animate(sceneControl.querySelectorAll("span"), {
    opacity: [0, 1],
    y: [12, 0],
  }, { duration: 0.52, delay: stagger(0.055, { startDelay: 0.12 }), ease });
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
  heroBackground.src = background;
  heroAnimal.src = scene.animal;
  heroAnimal.alt = scene.description;
  sceneIndex.textContent = `#${String(index).padStart(3, "0")}`;
  sceneName.textContent = scene.label;
  visualDescription.textContent = scene.description;
  sceneControl.setAttribute("aria-label", `Show another animal. Current image: ${scene.name}`);
  rememberScene(index);
}

async function renderScene(index: number, initial = false): Promise<void> {
  if (transitioning && !initial) return;
  const request = ++sceneRequest;
  const scene = scenes[index];
  const background = backgroundFor(scene);
  transitioning = true;
  site.dataset.switching = "true";

  try {
    await Promise.all([preload(background), preload(scene.animal)]);
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
  if (document.hidden) {
    stopIdleMotion();
    ditherAnimations.forEach((animation) => animation.pause());
  } else {
    startIdleMotion(currentScene);
    startDitherMotion();
  }
});

void renderScene(currentScene, true);
