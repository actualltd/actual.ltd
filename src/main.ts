import "./styles.css";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const site = requireElement<HTMLElement>("#site");
const animal = requireElement<HTMLElement>("#animal");
const animalImage = requireElement<HTMLImageElement>("#animal img");
const infoButton = requireElement<HTMLButtonElement>("#info-button");
const companyDialog = requireElement<HTMLDialogElement>("#company-dialog");
const companyClose = requireElement<HTMLButtonElement>("#company-close");
const year = requireElement<HTMLElement>("#year");
const localTime = requireElement<HTMLElement>("#local-time");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function markReady(): void {
  site.dataset.ready = "true";
}

if (animalImage.complete) markReady();
else animalImage.addEventListener("load", markReady, { once: true });
window.setTimeout(markReady, 800);

year.textContent = String(new Date().getFullYear());

function updateBangkokTime(): void {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  localTime.textContent = `${time} ICT`;
}

updateBangkokTime();
window.setInterval(updateBangkokTime, 30_000);

let animationFrame = 0;

window.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches || event.pointerType === "touch") return;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    const x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
    const y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
    animal.style.setProperty("--pointer-x", x.toFixed(3));
    animal.style.setProperty("--pointer-y", y.toFixed(3));
  });
}, { passive: true });

function openCompany(): void {
  companyDialog.showModal();
  infoButton.setAttribute("aria-expanded", "true");
}

function closeCompany(restoreFocus = true): void {
  companyDialog.close();
  infoButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) infoButton.focus();
}

infoButton.addEventListener("click", openCompany);
companyClose.addEventListener("click", () => closeCompany());
companyDialog.addEventListener("click", (event) => {
  if (event.target === companyDialog) closeCompany();
});
companyDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeCompany();
});

window.addEventListener("pagehide", () => {
  if (companyDialog.open) closeCompany(false);
});
