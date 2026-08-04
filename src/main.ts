import Lenis from "lenis";
import LenisSnap from "lenis/snap";
import "lenis/dist/lenis.css";
import "./styles.css";
import type { ArtworkSelection, VisualController, VisualState } from "./visual";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const visualLayer = requireElement<HTMLDivElement>("#visual-layer");
const indexElement = requireElement<HTMLSpanElement>("#record-index");
const labelElement = requireElement<HTMLSpanElement>("#record-label");
const viewControl = requireElement<HTMLButtonElement>("#view-control");
const motionControl = requireElement<HTMLButtonElement>("#motion-control");
const scrollIndex = requireElement<HTMLSpanElement>("#scroll-index");
const sceneStep = requireElement<HTMLSpanElement>("#scene-step");
const sceneLine = requireElement<HTMLSpanElement>("#scene-line");
const sceneTitle = requireElement<HTMLSpanElement>("#scene-title");
const sceneArtist = requireElement<HTMLSpanElement>("#scene-artist");
const companyControl = requireElement<HTMLButtonElement>("#company-control");
const companyDialog = requireElement<HTMLDialogElement>("#company-dialog");
const companyClose = requireElement<HTMLButtonElement>("#company-close");
const creditsControl = requireElement<HTMLButtonElement>("#credits-control");
const creditsDialog = requireElement<HTMLDialogElement>("#credits-dialog");
const creditsClose = requireElement<HTMLButtonElement>("#credits-close");
const creditsChapter = requireElement<HTMLSpanElement>("#credits-chapter");
const creditsList = requireElement<HTMLOListElement>("#credits-list");
const artworkDialog = requireElement<HTMLDialogElement>("#artwork-dialog");
const artworkDetailMedia = requireElement<HTMLDivElement>(".artwork-dialog__media");
const artworkClose = requireElement<HTMLButtonElement>("#artwork-close");
const artworkImageFallback = requireElement<HTMLImageElement>("#artwork-detail-image");
let artworkDetailImage = artworkImageFallback;
const artworkDetailIndex = requireElement<HTMLSpanElement>("#artwork-detail-index");
const artworkDetailTitle = requireElement<HTMLHeadingElement>("#artwork-detail-title");
const artworkDetailArtist = requireElement<HTMLElement>("#artwork-detail-artist");
const artworkDetailDate = requireElement<HTMLElement>("#artwork-detail-date");
const artworkDetailRole = requireElement<HTMLElement>("#artwork-detail-role");
const artworkDetailSource = requireElement<HTMLAnchorElement>("#artwork-detail-source");
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
let actualView = false;
let artworkInteracting = false;
let activeVisualState: VisualState | null = null;
let wheelAccumulator = 0;
let wheelGestureLocked = false;
let wheelLockUntil = 0;
let wheelResetTimer = 0;
let artworkCloseTimer = 0;

const STEP_SCROLL_DURATION = 780;
const STEP_SCROLL_THRESHOLD = 18;

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
  resetWheelGesture();
  window.removeEventListener("scroll", onNativeScroll);
  snap?.destroy();
  snap = null;
  lenis?.destroy();
  lenis = null;
  document.documentElement.classList.remove("is-lenis-enhanced");
}

function resetWheelGesture(): void {
  wheelAccumulator = 0;
  wheelGestureLocked = false;
  wheelLockUntil = 0;
  wheelResetTimer = 0;
  delete document.documentElement.dataset.scrollLocked;
}

function scheduleWheelGestureReset(): void {
  if (wheelResetTimer !== 0) window.clearTimeout(wheelResetTimer);
  const remainingLock = Math.max(0, wheelLockUntil - performance.now());
  wheelResetTimer = window.setTimeout(resetWheelGesture, Math.max(180, remainingLock));
}

function onStepWheel(event: WheelEvent): void {
  if (!lenis || reducedMotionQuery.matches || coarsePointerQuery.matches) return;
  if (document.hidden || artworkInteracting || companyDialog.open || creditsDialog.open || artworkDialog.open) return;
  if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.72) return;
  if (Math.abs(event.deltaY) < 0.5) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  const direction = Math.sign(event.deltaY);
  if (wheelAccumulator !== 0 && Math.sign(wheelAccumulator) !== direction) wheelAccumulator = 0;

  if (wheelGestureLocked) {
    scheduleWheelGestureReset();
    return;
  }

  wheelAccumulator += event.deltaY;
  if (Math.abs(wheelAccumulator) < STEP_SCROLL_THRESHOLD) {
    scheduleWheelGestureReset();
    return;
  }

  const currentIndex = nearestSceneIndex(lenis.scroll);
  const nextIndex = clampSceneIndex(currentIndex + direction);
  wheelAccumulator = 0;
  wheelGestureLocked = true;
  wheelLockUntil = performance.now() + STEP_SCROLL_DURATION;
  document.documentElement.dataset.scrollLocked = String(nextIndex);
  scrollToScene(nextIndex);
  scheduleWheelGestureReset();
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
      smoothWheel: false,
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
    syncScrollerState();
  }

  if (Math.abs(window.scrollY - preservedScroll) > 1) window.scrollTo(0, preservedScroll);
  syncSceneFromScroll(preservedScroll);
}

function syncScrollerState(): void {
  if (!lenis) return;
  if (document.hidden || artworkInteracting || companyDialog.open || creditsDialog.open || artworkDialog.open) lenis.stop();
  else lenis.start();
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
  activeVisualState = state;
  indexElement.textContent = `[${state.code}/003]`;
  labelElement.textContent = state.label;
  sceneStep.textContent = `${state.code} / ${state.label}`;
  sceneLine.textContent = state.line;
  sceneTitle.textContent = state.title;
  sceneArtist.textContent = `${state.artist} — ${state.date}`;
  renderCredits(state);
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

function renderCredits(state: VisualState): void {
  creditsChapter.textContent = `${state.code} / ${state.label}`;
  creditsList.replaceChildren(...state.credits.map((credit, index) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const role = document.createElement("span");
    const work = document.createElement("span");
    const title = document.createElement("span");
    const metadata = document.createElement("span");
    const arrow = document.createElement("span");

    link.className = "credits-item";
    link.href = credit.sourceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", `${credit.title} by ${credit.artist}, ${credit.date} — view at The Met`);

    role.className = "credits-item__role";
    role.textContent = `${String(index + 1).padStart(2, "0")} / ${credit.role}`;
    work.className = "credits-item__work";
    title.className = "credits-item__title";
    title.textContent = credit.title;
    metadata.className = "credits-item__meta";
    metadata.textContent = `${credit.artist} — ${credit.date}`;
    arrow.className = "credits-item__arrow";
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");

    work.append(title, metadata);
    link.append(role, work, arrow);
    item.append(link);
    return item;
  }));
}

function openArtworkDetail(selection: ArtworkSelection): void {
  const roleIndex = selection.state.credits.findIndex((credit) => credit.role === selection.credit.role) + 1;
  artworkDetailIndex.textContent = `${selection.state.code}.${String(roleIndex).padStart(2, "0")} / ${selection.credit.role}`;
  artworkDetailTitle.textContent = selection.credit.title;
  artworkDetailArtist.textContent = selection.credit.artist;
  artworkDetailDate.textContent = selection.credit.date;
  artworkDetailRole.textContent = selection.credit.role;
  artworkDetailSource.href = selection.credit.sourceUrl;
  const nextImage = selection.imageElement ?? artworkImageFallback;
  if (nextImage !== artworkDetailImage) {
    artworkDetailImage.removeAttribute("id");
    artworkDetailImage = nextImage;
    artworkDetailImage.id = "artwork-detail-image";
    artworkDetailMedia.replaceChildren(artworkDetailImage);
  }
  if (!selection.imageElement && artworkDetailImage.getAttribute("src") !== selection.imageUrl) {
    artworkDetailImage.src = selection.imageUrl;
  }
  artworkDetailImage.decoding = "async";
  artworkDetailImage.draggable = false;
  artworkDetailImage.alt = `Full view of ${selection.credit.title} by ${selection.credit.artist}`;
  artworkDialog.classList.remove("is-closing");
  artworkDialog.showModal();
  syncScrollerState();
}

function closeArtworkDetail(): void {
  if (!artworkDialog.open || artworkDialog.classList.contains("is-closing")) return;
  if (reducedMotionQuery.matches) {
    artworkDialog.close();
    return;
  }
  artworkDialog.classList.add("is-closing");
  artworkCloseTimer = window.setTimeout(() => {
    artworkCloseTimer = 0;
    artworkDialog.close();
  }, 180);
}

function updateMotionControl(): void {
  motionControl.textContent = motionEnabled ? "MOTION—ON" : "MOTION—OFF";
  motionControl.setAttribute("aria-pressed", String(motionEnabled));
  visual?.setMotionEnabled(motionEnabled);
}

function updateViewControl(): void {
  viewControl.textContent = actualView ? "VIEW—ACTUAL" : "VIEW—DITHER";
  viewControl.setAttribute("aria-pressed", String(actualView));
  viewControl.setAttribute("aria-label", actualView ? "Show dithered artwork" : "Show full-color artwork");
  visual?.setActualView(actualView);
}

function updateArtworkInteractionState(active: boolean): void {
  artworkInteracting = active;
  syncScrollerState();
}

async function initialiseVisual(): Promise<void> {
  try {
    const { createVisual } = await import("./visual");
    visual = createVisual(visualLayer, {
      motionEnabled,
      reducedMotion: reducedMotionQuery.matches,
      onStateChange: updateRecord,
      onInteractionStateChange: updateArtworkInteractionState,
      onArtworkOpen: openArtworkDetail,
      onUnavailable: () => {
        visualLayer.classList.add("is-unavailable");
        visualLayer.classList.remove("is-ready");
        motionControl.disabled = true;
        motionControl.textContent = "MOTION—OFF";
        motionControl.setAttribute("aria-pressed", "false");
        viewControl.disabled = true;
      },
      onAvailable: () => {
        motionControl.disabled = false;
        viewControl.disabled = false;
        updateMotionControl();
        updateViewControl();
      },
    });
    visual.setScene(Math.max(activeSceneIndex, 0));
  } catch {
    visualLayer.classList.add("is-unavailable");
    motionControl.disabled = true;
    motionControl.textContent = "MOTION—OFF";
    motionControl.setAttribute("aria-pressed", "false");
    viewControl.disabled = true;
  }
}

viewControl.addEventListener("click", () => {
  actualView = !actualView;
  updateViewControl();
});

motionControl.addEventListener("click", () => {
  motionEnabled = !motionEnabled;
  userMotionPreference = motionEnabled;
  updateMotionControl();
});

creditsControl.addEventListener("click", () => {
  if (!activeVisualState || creditsDialog.open) return;
  renderCredits(activeVisualState);
  openDialog(creditsDialog, creditsControl);
});

function openDialog(dialog: HTMLDialogElement, control: HTMLButtonElement): void {
  dialog.showModal();
  control.setAttribute("aria-expanded", "true");
  syncScrollerState();
}

function closeDialog(dialog: HTMLDialogElement, control: HTMLButtonElement): void {
  if (dialog.open) dialog.close();
  control.setAttribute("aria-expanded", "false");
  syncScrollerState();
}

function bindDialogDismissal(
  dialog: HTMLDialogElement,
  control: HTMLButtonElement,
  closeControl: HTMLButtonElement,
): void {
  closeControl.addEventListener("click", () => closeDialog(dialog, control));

  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) closeDialog(dialog, control);
  });

  dialog.addEventListener("close", () => {
    control.setAttribute("aria-expanded", "false");
    syncScrollerState();
  });
}

companyControl.addEventListener("click", () => {
  if (companyDialog.open) return;
  openDialog(companyDialog, companyControl);
});

bindDialogDismissal(companyDialog, companyControl, companyClose);
bindDialogDismissal(creditsDialog, creditsControl, creditsClose);

artworkClose.addEventListener("click", () => {
  closeArtworkDetail();
});

artworkDialog.addEventListener("click", (event) => {
  if (event.target !== artworkDialog) return;
  const bounds = artworkDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) closeArtworkDetail();
});

artworkDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeArtworkDetail();
});

artworkDialog.addEventListener("close", () => {
  if (artworkCloseTimer !== 0) window.clearTimeout(artworkCloseTimer);
  artworkCloseTimer = 0;
  artworkDialog.classList.remove("is-closing");
  syncScrollerState();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (companyDialog.open || creditsDialog.open || artworkDialog.open) return;
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

reducedMotionQuery.addEventListener("change", (event) => {
  visual?.setReducedMotion(event.matches);
  if (userMotionPreference === null) {
    motionEnabled = !event.matches;
    updateMotionControl();
  }
  initialiseScroller();
});

coarsePointerQuery.addEventListener("change", initialiseScroller);

window.addEventListener("wheel", onStepWheel, { passive: false, capture: true });

document.addEventListener("visibilitychange", () => {
  syncScrollerState();
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
updateViewControl();
initialiseScroller();
requestAnimationFrame(() => void initialiseVisual());
