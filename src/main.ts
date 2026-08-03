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
const storyStep = requireElement<HTMLSpanElement>("#story-step");
const storyLine = requireElement<HTMLSpanElement>("#story-line");
const storyDetail = requireElement<HTMLSpanElement>("#story-detail");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const STORY_COPY = [
  { line: "POSSIBILITY", detail: "UNSEEN, BUT PRESENT." },
  { line: "TAKING FORM", detail: "A SIGNAL BECOMES STRUCTURE." },
  { line: "MADE ACTUAL", detail: "FORM, MADE PRESENT." },
] as const;

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
  storyStep.textContent = `${String(state.index).padStart(2, "0")} — 03`;

  const story = STORY_COPY[state.index - 1] ?? STORY_COPY[0];
  storyLine.textContent = story.line;
  storyDetail.textContent = story.detail;

  if (!reducedMotionQuery.matches) {
    const keyframes = [
      { opacity: 0.2, transform: "translateY(0.22em)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    storyLine.animate(keyframes, { duration: 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    storyDetail.animate(keyframes, { duration: 760, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
  }
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
  pointerInside = event.pointerType !== "touch";
  updatePointer(event);
  updateReveal();
});

wordmark.addEventListener("pointermove", updatePointer);

wordmark.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "touch") pointerInside = false;
  updateReveal();
});

wordmark.addEventListener("focus", () => {
  focusInside = wordmark.matches(":focus-visible");
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

window.addEventListener(
  "pagehide",
  (event) => {
    if (!event.persisted) visual?.destroy();
  },
  { once: true },
);

updateMotionControl();
updateReveal();

window.addEventListener(
  "load",
  () => {
    requestAnimationFrame(() => window.setTimeout(() => void initialiseVisual(), 120));
  },
  { once: true },
);
