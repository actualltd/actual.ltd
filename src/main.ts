import "./styles.css";
import type { VisualController, VisualState } from "./visual";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

const visualLayer = requireElement<HTMLDivElement>("#visual-layer");
const indexElement = requireElement<HTMLSpanElement>("#record-index");
const labelElement = requireElement<HTMLSpanElement>("#record-label");
const motionControl = requireElement<HTMLButtonElement>("#motion-control");
const wordmark = requireElement<HTMLButtonElement>("#actual-wordmark");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

let userMotionPreference: boolean | null = null;
let motionEnabled = !reducedMotionQuery.matches;
let revealLocked = false;
let pointerInside = false;
let focusInside = false;
let visual: VisualController | null = null;

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
        motionControl.textContent = motionEnabled ? "MOTION—ON" : "MOTION—OFF";
        motionControl.setAttribute("aria-pressed", String(motionEnabled));
      },
    });
  } catch {
    visualLayer.classList.add("is-unavailable");
    motionControl.disabled = true;
    motionControl.textContent = "MOTION—OFF";
    motionControl.setAttribute("aria-pressed", "false");
  }
}

function updateRecord(state: VisualState): void {
  indexElement.textContent = `[${String(state.index).padStart(3, "0")}/003]`;
  labelElement.textContent = state.label;
}

function updateMotionControl(): void {
  motionControl.textContent = motionEnabled ? "MOTION—ON" : "MOTION—OFF";
  motionControl.setAttribute("aria-pressed", String(motionEnabled));
  visual?.setMotionEnabled(motionEnabled);
}

function updateReveal(): void {
  const revealed = revealLocked || pointerInside || focusInside;
  wordmark.classList.toggle("is-revealed", revealed);
  wordmark.setAttribute("aria-expanded", String(revealed));
  visual?.setReveal(revealed);
}

function updatePointer(event: PointerEvent): void {
  visual?.setPointer(
    Math.min(1, Math.max(0, event.clientX / window.innerWidth)),
    Math.min(1, Math.max(0, 1 - event.clientY / window.innerHeight)),
  );
}

motionControl.addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  userMotionPreference = motionEnabled;
  updateMotionControl();
});

wordmark.addEventListener("pointerenter", (event) => {
  pointerInside = true;
  updatePointer(event);
  updateReveal();
});

wordmark.addEventListener("pointermove", updatePointer);

wordmark.addEventListener("pointerleave", () => {
  pointerInside = false;
  updateReveal();
});

wordmark.addEventListener("focus", () => {
  focusInside = true;
  visual?.setPointer(0.5, 0.5);
  updateReveal();
});

wordmark.addEventListener("blur", () => {
  focusInside = false;
  updateReveal();
});

wordmark.addEventListener("click", () => {
  revealLocked = !revealLocked;
  updateReveal();
});

reducedMotionQuery.addEventListener("change", (event) => {
  if (userMotionPreference === null) {
    motionEnabled = !event.matches;
    updateMotionControl();
  }
});

window.addEventListener("pagehide", () => visual?.destroy(), { once: true });

updateMotionControl();
updateReveal();

window.addEventListener(
  "load",
  () => {
    requestAnimationFrame(() => window.setTimeout(() => void initialiseVisual(), 120));
  },
  { once: true },
);
