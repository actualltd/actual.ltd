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
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let userMotionPreference: boolean | null = null;
let motionEnabled = !reducedMotionQuery.matches;
let visual: VisualController | null = null;
let wheelDistance = 0;
let wheelDirection: -1 | 0 | 1 = 0;
let wheelGestureActive = false;
let wheelResetTimer = 0;
let touchStartX: number | null = null;
let touchStartY: number | null = null;
let navigationLockedUntil = 0;

const WHEEL_TRIGGER_DISTANCE = 32;
const WHEEL_GESTURE_IDLE_MS = 320;
const NAVIGATION_LOCK_MS = 1040;

function navigateScene(direction: -1 | 1): boolean {
  const now = performance.now();
  if (!visual || now < navigationLockedUntil) return false;

  navigationLockedUntil = now + NAVIGATION_LOCK_MS;
  if (direction > 0) visual.nextScene();
  else visual.previousScene();
  return true;
}

function resetWheelGesture(): void {
  wheelDistance = 0;
  wheelDirection = 0;
  wheelGestureActive = false;
}

function updateRecord(state: VisualState): void {
  const nextNumber = state.index % 3 + 1;
  indexElement.textContent = `[${state.code}/003]`;
  labelElement.textContent = state.label;
  sceneStep.textContent = `${state.code} / ${state.label}`;
  sceneLine.textContent = state.line;
  sceneTitle.textContent = state.title;
  sceneArtist.textContent = `${state.artist} — ${state.date}`;
  sourceCredit.textContent = state.sourceLabel;
  sourceCredit.href = state.sourceUrl;
  scrollIndex.textContent = String(nextNumber).padStart(3, "0");

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
  const target = event.target;
  const isControl = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;

  if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
    event.preventDefault();
    if (!event.repeat) navigateScene(1);
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
    event.preventDefault();
    if (!event.repeat) navigateScene(-1);
  } else if (event.key === " " && !isControl) {
    event.preventDefault();
    if (!event.repeat) navigateScene(event.shiftKey ? -1 : 1);
  }
});

window.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) < Math.abs(event.deltaX) * 0.75 || event.deltaY === 0) return;
  event.preventDefault();

  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1;
  const distance = event.deltaY * unit;
  const direction = Math.sign(distance) as -1 | 1;

  window.clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(resetWheelGesture, WHEEL_GESTURE_IDLE_MS);

  if (!wheelGestureActive) {
    if (wheelDirection !== 0 && direction !== wheelDirection) wheelDistance = 0;
    wheelDirection = direction;
    wheelDistance += distance;

    if (Math.abs(wheelDistance) >= WHEEL_TRIGGER_DISTANCE) {
      if (visual) {
        wheelGestureActive = true;
        navigateScene(direction);
      }
    }
  }
}, { passive: false });

window.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  touchStartX = event.clientX;
  touchStartY = event.clientY;
});

window.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch" || touchStartX === null || touchStartY === null) return;
  const distanceX = event.clientX - touchStartX;
  const distanceY = event.clientY - touchStartY;
  touchStartX = null;
  touchStartY = null;

  if (Math.abs(distanceY) < 52 || Math.abs(distanceY) <= Math.abs(distanceX) * 1.1) return;
  navigateScene(distanceY < 0 ? 1 : -1);
});

window.addEventListener("pointercancel", () => {
  touchStartX = null;
  touchStartY = null;
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
});

window.addEventListener("pagehide", (event) => {
  window.clearTimeout(wheelResetTimer);
  resetWheelGesture();
  if (!event.persisted) visual?.destroy();
}, { once: true });

updateMotionControl();
requestAnimationFrame(() => void initialiseVisual());
