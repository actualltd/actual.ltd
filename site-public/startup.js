document.documentElement.className = "has-js";

(() => {
  const files = [
    ["/animals/previews/portrait-01-oryx.webp", "/animals/previews/landscape-01-oryx.webp", "/animals/previews/cutout-01-oryx.webp"],
    ["/animals/previews/portrait-02-crane.webp", "/animals/previews/landscape-02-crane.webp", "/animals/previews/cutout-02-crane.webp"],
    ["/animals/previews/portrait-03-stag.webp", "/animals/previews/landscape-03-stag.webp", "/animals/previews/cutout-03-stag.webp"],
    ["/animals/previews/portrait-04-tiger.webp", "/animals/previews/landscape-04-tiger.webp", "/animals/previews/cutout-04-tiger.webp"],
    ["/animals/previews/portrait-05-thresher-shark.webp", "/animals/previews/landscape-05-thresher-shark.webp", "/animals/previews/cutout-05-thresher-shark.webp"],
  ];

  let previous = -1;
  try {
    const saved = sessionStorage.getItem("actual-scene");
    previous = saved === null ? -1 : Number(saved);
  } catch {}

  const choices = [0, 1, 2, 3, 4].filter((value) => value !== previous);
  let random = Math.floor(Math.random() * choices.length);
  if (window.crypto && window.crypto.getRandomValues) {
    const entropy = new Uint32Array(1);
    window.crypto.getRandomValues(entropy);
    random = entropy[0] % choices.length;
  }

  const selected = choices[random] ?? 0;
  window.__ACTUAL_SCENE__ = selected;
  document.documentElement.dataset.scene = String(selected);

  const portrait = matchMedia("(max-aspect-ratio: 4/5)").matches;
  [files[selected][portrait ? 0 : 1], files[selected][2]].forEach((href) => {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = href;
    document.head.append(preload);
  });
})();
