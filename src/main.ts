import Lenis from "lenis";
import LenisSnap from "lenis/snap";
import "lenis/dist/lenis.css";
import "./styles.css";
import type { VisualController, VisualState } from "./visual";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const visualLayer = requireElement<HTMLDivElement>("#visual-layer");
const indexElement = requireElement<HTMLSpanElement>("#record-index");
const labelElement = requireElement<HTMLSpanElement>("#record-label");
const motionControl = requireElement<HTMLButtonElement>("#motion-control");
const scrollIndex = requireElement<HTMLSpanElement>("#scroll-index");
const wordmark = requireElement<HTMLButtonElement>("#actual-wordmark");
const sceneStep = requireElement<HTMLSpanElement>("#scene-step");
const sceneLine = requireElement<HTMLSpanElement>("#scene-line");
const sceneTitle = requireElement<HTMLSpanElement>("#scene-title");
const sceneArtist = requireElement<HTMLSpanElement>("#scene-artist");
const sourceCredit = requireElement<HTMLAnchorElement>("#source-credit");
const scrollScenes = [...document.querySelectorAll<HTMLElement>("[data-scroll-scene]")];
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(any-pointer: coarse)");

let userMotionPreference: boolean | null = null;
let motionEnabled = !reducedMotionQuery.matches;
let visual: VisualController | null = null;
let lenis: Lenis | null = null;
let snap: LenisSnap | null = null;
let scrollFrame = 0;
let activeSceneIndex = -1;

function clampSceneIndex(index: number): number {
  return Math.max(0, Math.min(scrollScenes.length - 1, index));
}

function nearestSceneIndex(scrollPosition = window.scrollY): number {
  return clampSceneIndex(Math.round(scrollPosition / Math.max(window.innerHeight, 1)));
}

function selectScene(index: number): void {
  const nextIndex = clampSceneIndex(index);
  if (nextIndex === activeSceneIndex) return;
  activeSceneIndex = nextIndex;
  visual?.setScene(nextIndex);
}

function syncSceneFromScroll(scrollPosition = window.scrollY): void {
  selectScene(nearestSceneIndex(scrollPosition));
}

function onNativeScroll(): void {
  if (scrollFrame !== 0) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    syncSceneFromScroll();
  });
}

function destroyScroller(): void {
  if (scrollFrame !== 0) window.cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  window.removeEventListener("scroll", onNativeScroll);
  snap?.destroy();
  snap = null;
  lenis?.destroy();
  lenis = null;
  document.documentElement.classList.remove("is-lenis-enhanced");
}

function initialiseScroller(): void {
  const preservedScroll = window.scrollY;
  destroyScroller();
  window.addEventListener("scroll", onNativeScroll, { passive: true });

  const shouldEnhance = !reducedMotionQuery.matches && !coarsePointerQuery.matches;
  if (shouldEnhance) {
    document.documentElement.classList.add("is-lenis-enhanced");
    const easing = (progress: number): number => 1 - Math.pow(1 - progress, 4);
    lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      duration: 0.82,
      easing,
      anchors: true,
      overscroll: false,
      stopInertiaOnNavigate: true,
    });
    snap = new LenisSnap(lenis, {
      type: "lock",
      distanceThreshold: "100%",
      debounce: 0,
      duration: 0.78,
      easing,
    });
    snap.addElements(scrollScenes, { align: "start" });
  }

  if (Math.abs(window.scrollY - preservedScroll) > 1) window.scrollTo(0, preservedScroll);
  syncSceneFromScroll(preservedScroll);
}

function scrollToScene(index: number): void {
  const nextIndex = clampSceneIndex(index);
  if (snap) {
    snap.goTo(nextIndex);
  } else {
    scrollScenes[nextIndex]?.scrollIntoView({
      block: "start",
      behavior: reducedMotionQuery.matches ? "auto" : "smooth",
    });
  }
}

function updateRecord(state: VisualState): void {
  indexElement.textContent = `[${state.code}/003]`;
  labelElement.textContent = state.label;
  sceneStep.textContent = `${state.code} / ${state.label}`;
  sceneLine.textContent = state.line;
  sceneTitle.textContent = state.title;
  sceneArtist.textContent = `${state.artist} — ${state.date}`;
  sourceCredit.textContent = state.sourceLabel;
  sourceCredit.href = state.sourceUrl;
  scrollIndex.textContent = state.index < scrollScenes.length
    ? String(state.index + 1).padStart(3, "0")
    : "END";

  if (!reducedMotionQuery.matches) {
    const keyframes = [
      { opacity: 0, transform: "translateY(0.35rem)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    sceneLine.animate(keyframes, { duration: 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    sceneArtist.animate(keyframes, { duration: 780, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  }
}

function updateMotionControl(): void {
  motionControl.textContent = motionEnabled ? "MOTION—ON" : "MOTION—OFF";
  motionControl.setAttribute("aria-pressed", String(motionEnabled));
  visual?.setMotionEnabled(motionEnabled);
}

async function initialiseVisual(): Promise<void> {
  try {
    const { createVisual } = await import("./visual");
    visual = createVisual(visualLayer, {
      motionEnabled,
      onStateChange: updateRecord,
      onUnavailable: () => {
        visualLayer.classList.add("is-unavailable");
        visualLayer.classList.remove("is-ready");
        motionControl.disabled = true;
        motionControl.textContent = "MOTION—OFF";
        motionControl.setAttribute("aria-pressed", "false");
      },
      onAvailable: () => {
        motionControl.disabled = false;
        updateMotionControl();
      },
    });
    visual.setScene(Math.max(activeSceneIndex, 0));
  } catch {
    visualLayer.classList.add("is-unavailable");
    motionControl.disabled = true;
    motionControl.textContent = "MOTION—OFF";
    motionControl.setAttribute("aria-pressed", "false");
  }
}

motionControl.addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  userMotionPreference = motionEnabled;
  updateMotionControl();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  const target = event.target;
  const isControl = target instanceof Element
    && target.closest("a, button, input, textarea, select, [contenteditable='true']") !== null;
  if (isControl) return;

  const currentIndex = nearestSceneIndex(lenis?.scroll ?? window.scrollY);
  let nextIndex: number | null = null;

  if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || (event.key === " " && !event.shiftKey)) {
    nextIndex = currentIndex + 1;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey)) {
    nextIndex = currentIndex - 1;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = scrollScenes.length - 1;
  }

  if (nextIndex === null) return;
  event.preventDefault();
  scrollToScene(nextIndex);
});

wordmark.addEventListener("click", () => {
  const expanded = wordmark.getAttribute("aria-expanded") === "true";
  wordmark.setAttribute("aria-expanded", String(!expanded));
  wordmark.classList.toggle("is-revealed", !expanded);
});

reducedMotionQuery.addEventListener("change", (event) => {
  if (userMotionPreference === null) {
    motionEnabled = !event.matches;
    updateMotionControl();
  }
  initialiseScroller();
});

coarsePointerQuery.addEventListener("change", initialiseScroller);

document.addEventListener("visibilitychange", () => {
  if (!lenis) return;
  if (document.hidden) lenis.stop();
  else lenis.start();
});

window.addEventListener("pageshow", () => {
  requestAnimationFrame(() => syncSceneFromScroll());
});

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    destroyScroller();
    visual?.destroy();
  }
}, { once: true });

updateMotionControl();
initialiseScroller();
requestAnimationFrame(() => void initialiseVisual());
