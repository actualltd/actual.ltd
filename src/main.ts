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
const nextButton = requireElement<HTMLButtonElement>("#next-scene");
const nextIndex = requireElement<HTMLSpanElement>("#next-index");
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
  nextIndex.textContent = String(nextNumber).padStart(3, "0");
  nextButton.setAttribute("aria-label", `Next artwork, record ${String(nextNumber).padStart(3, "0")}`);

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

nextButton.addEventListener("click", () => visual?.nextScene());

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") visual?.nextScene();
  else if (event.key === "ArrowLeft") visual?.previousScene();
});

window.addEventListener("pointermove", (event) => {
  visual?.setPointer(event.clientX / window.innerWidth, event.clientY / window.innerHeight);
}, { passive: true });

document.documentElement.addEventListener("pointerleave", () => visual?.setPointer(0.5, 0.5));

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
  if (!event.persisted) visual?.destroy();
}, { once: true });

updateMotionControl();

window.addEventListener("load", () => {
  requestAnimationFrame(() => void initialiseVisual());
}, { once: true });
