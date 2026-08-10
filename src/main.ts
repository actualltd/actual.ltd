import "./styles.css";

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

const site = requireElement<HTMLElement>("#site");
const heroBackground = requireElement<HTMLImageElement>("#hero-background");
const heroAnimal = requireElement<HTMLImageElement>("#hero-animal");
const sceneControl = requireElement<HTMLButtonElement>("#scene-control");
const sceneIndex = requireElement<HTMLElement>("#scene-index");
const sceneName = requireElement<HTMLElement>("#scene-name");
const visualDescription = requireElement<HTMLElement>("#visual-description");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const portraitLayout = window.matchMedia("(max-aspect-ratio: 4/5)");

let currentScene = Math.min(
  scenes.length - 1,
  Math.max(0, (window as SceneWindow).__ACTUAL_SCENE__ ?? 0),
);
let switchTimer = 0;
let sceneRequest = 0;
let sceneDeck: number[] = [];
let pointerTargetX = 0;
let pointerTargetY = 0;
let pointerX = 0;
let pointerY = 0;

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

function renderScene(index: number, initial = false): void {
  const request = ++sceneRequest;
  const scene = scenes[index];
  const background = backgroundFor(scene);
  const apply = () => {
    if (request !== sceneRequest) return;
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
    requestAnimationFrame(() => {
      site.dataset.ready = "true";
      site.dataset.switching = "false";
    });
  };

  if (!initial) site.dataset.switching = "true";
  window.clearTimeout(switchTimer);
  Promise.all([preload(background), preload(scene.animal)]).then(() => {
    if (request !== sceneRequest) return;
    switchTimer = window.setTimeout(apply, initial || reducedMotion.matches ? 0 : 180);
  }).catch(() => {
    if (request === sceneRequest) site.dataset.switching = "false";
  });
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
  renderScene(nextScene());
});

window.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches) return;
  pointerTargetX = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
  pointerTargetY = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
}, { passive: true });

document.documentElement.addEventListener("pointerleave", () => {
  pointerTargetX = 0;
  pointerTargetY = 0;
});

function animateParallax(time: number): void {
  if (!reducedMotion.matches) {
    pointerX += (pointerTargetX - pointerX) * 0.085;
    pointerY += (pointerTargetY - pointerY) * 0.085;
    const driftX = Math.sin(time * 0.00042) * 8 + Math.sin(time * 0.00091) * 2;
    const driftY = Math.cos(time * 0.00036) * 5;
    site.style.setProperty("--background-x", `${(-pointerX * 24 - driftX * 0.32).toFixed(2)}px`);
    site.style.setProperty("--background-y", `${(-pointerY * 16 - driftY * 0.28).toFixed(2)}px`);
    site.style.setProperty("--type-x", `${(pointerX * 20 + driftX * 0.55).toFixed(2)}px`);
    site.style.setProperty("--type-y", `${(pointerY * 12 + driftY * 0.45).toFixed(2)}px`);
    site.style.setProperty("--animal-x", `${(pointerX * 70 + driftX * 1.15).toFixed(2)}px`);
    site.style.setProperty("--animal-y", `${(pointerY * 42 + driftY).toFixed(2)}px`);
  }
  requestAnimationFrame(animateParallax);
}

portraitLayout.addEventListener("change", () => renderScene(currentScene));

renderScene(currentScene, true);
requestAnimationFrame(animateParallax);
window.setTimeout(() => { site.dataset.ready = "true"; }, 1200);
