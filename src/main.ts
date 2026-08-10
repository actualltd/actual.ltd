import "./styles.css";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

type Scene = {
  src: string;
  name: string;
  description: string;
  theme: string;
};

type SceneWindow = Window & { __ACTUAL_SCENE__?: number };

const scenes: readonly Scene[] = [
  {
    src: "/animals/01-oryx.webp",
    name: "Walking oryx",
    description: "An Arabian oryx walking with its head turned away against vivid cobalt blue.",
    theme: "#3155d5",
  },
  {
    src: "/animals/02-crane.webp",
    name: "Landing crane",
    description: "A red-crowned crane landing with its head turned away against vivid vermilion.",
    theme: "#e34b37",
  },
  {
    src: "/animals/03-stag.webp",
    name: "White stag",
    description: "A white stag seen from behind against vivid ultraviolet.",
    theme: "#6c49ce",
  },
  {
    src: "/animals/04-tiger.webp",
    name: "Stretching tiger",
    description: "A Bengal tiger stretching with its face concealed against vivid emerald.",
    theme: "#129768",
  },
  {
    src: "/animals/05-sailfish.webp",
    name: "Swimming sailfish",
    description: "A sailfish swimming out of frame against vivid saffron.",
    theme: "#f2a51a",
  },
];

const site = requireElement<HTMLElement>("#site");
const heroImage = requireElement<HTMLImageElement>("#hero-image");
const sceneControl = requireElement<HTMLButtonElement>("#scene-control");
const sceneIndex = requireElement<HTMLElement>("#scene-index");
const visualDescription = requireElement<HTMLElement>("#visual-description");
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let currentScene = Math.min(
  scenes.length - 1,
  Math.max(0, (window as SceneWindow).__ACTUAL_SCENE__ ?? 0),
);
let switchTimer = 0;
let pointerFrame = 0;
let sceneRequest = 0;

function rememberScene(index: number): void {
  try { sessionStorage.setItem("actual-scene", String(index)); } catch {}
}

function renderScene(index: number, initial = false): void {
  const request = ++sceneRequest;
  const scene = scenes[index];
  const apply = () => {
    if (request !== sceneRequest) return;
    currentScene = index;
    document.documentElement.dataset.scene = String(index);
    themeColor?.setAttribute("content", scene.theme);
    heroImage.src = scene.src;
    heroImage.alt = scene.description;
    sceneIndex.textContent = String(index + 1).padStart(2, "0");
    visualDescription.textContent = scene.description;
    sceneControl.setAttribute("aria-label", `Show another animal. Current image: ${scene.name}`);
    rememberScene(index);
    requestAnimationFrame(() => {
      site.dataset.ready = "true";
      site.dataset.switching = "false";
    });
  };

  if (initial) {
    heroImage.addEventListener("load", apply, { once: true });
    heroImage.src = scene.src;
    if (heroImage.complete && heroImage.naturalWidth > 0) apply();
    return;
  }

  site.dataset.switching = "true";
  window.clearTimeout(switchTimer);
  const preloader = new Image();
  preloader.src = scene.src;
  preloader.addEventListener("load", () => {
    if (request !== sceneRequest) return;
    switchTimer = window.setTimeout(apply, reducedMotion.matches ? 0 : 180);
  }, { once: true });
  preloader.addEventListener("error", () => {
    if (request === sceneRequest) site.dataset.switching = "false";
  }, { once: true });
}

function randomScene(exclude: number): number {
  const choices = scenes.map((_, index) => index).filter((index) => index !== exclude);
  if (window.crypto?.getRandomValues) {
    const entropy = new Uint32Array(1);
    window.crypto.getRandomValues(entropy);
    return choices[entropy[0] % choices.length];
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

sceneControl.addEventListener("click", () => {
  renderScene(randomScene(currentScene));
});

window.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches || event.pointerType === "touch") return;
  if (pointerFrame) cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    const x = event.clientX / Math.max(window.innerWidth, 1) - 0.5;
    const y = event.clientY / Math.max(window.innerHeight, 1) - 0.5;
    site.style.setProperty("--pointer-x", x.toFixed(3));
    site.style.setProperty("--pointer-y", y.toFixed(3));
  });
}, { passive: true });

renderScene(currentScene, true);
window.setTimeout(() => { site.dataset.ready = "true"; }, 1200);
