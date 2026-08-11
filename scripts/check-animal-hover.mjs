import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await readFile(path.join(root, "src/main.ts"), "utf8");
const glowController = await readFile(path.join(root, "src/animal-glow.ts"), "utf8").catch(() => "");
const styles = await readFile(path.join(root, "src/styles.css"), "utf8");
const markup = await readFile(path.join(root, "index.html"), "utf8");
const thresholdMatch = source.match(/ANIMAL_HIT_ALPHA_THRESHOLD\s*=\s*(\d+)/);
const failures = [];

if (!/function ensurePaperShaderStyleMarker/.test(glowController)
  || !/document\.querySelector\("style\[data-paper-shader\]"\)/.test(glowController)
  || !/:where\(\[data-paper-shader\]\) canvas/.test(styles)) {
  failures.push("Paper Shader styles must be supplied externally so Trusted Types never reaches the library's innerHTML fallback.");
}

if (!thresholdMatch) failures.push("Animal alpha hit threshold must be explicit and testable.");
else {
  const threshold = Number(thresholdMatch[1]);
  if (threshold < 1 || threshold > 255) failures.push(`Animal alpha hit threshold ${threshold} is invalid.`);
}

if (!markup.includes('class="animal-sprite"') || !markup.includes('class="animal-glow"')) {
  failures.push("The animal and Paper shader need a shared sprite wrapper.");
}

if (!/<button class="animal-control"[^>]*aria-haspopup="dialog"/.test(markup)) {
  failures.push("The animal artwork must use a native button so pointer and keyboard activation are reliable.");
}

if (!/class="animal-glow"[^>]*aria-hidden="true"/.test(markup)) {
  failures.push("The shader host must be accessibility-hidden.");
}

if (!/\.animal-glow\{[^}]*pointer-events:none/.test(styles)) {
  failures.push("The shader canvas must never intercept pointer events.");
}

const animalRules = [...styles.matchAll(/(?:^|\n)[^{\n]*\.(?:animal|animal-sprite|animal-parallax)(?=[\s,{\[])[^{]*\{([^}]*)\}/g)]
  .map((match) => match[1])
  .join("\n");
if (/\bfilter\s*:|drop-shadow|animation\s*:/.test(animalRules)) {
  failures.push("The animal stack cannot use CSS filters, drop-shadows, or glow animations.");
}

if (/animal-glow-in|drop-shadow/.test(styles)) {
  failures.push("Legacy CSS glow code must be removed completely.");
}

if (!/new ShaderMount\s*\(/.test(glowController)) {
  failures.push("The glow controller must create one reusable Paper ShaderMount.");
}

const mountCount = (glowController.match(/new ShaderMount\s*\(/g) ?? []).length;
if (mountCount !== 1) failures.push(`Expected one ShaderMount constructor, found ${mountCount}.`);

if (/\[\s*["']u_image["']\s*\]\s*,?\s*\)/.test(glowController)) {
  failures.push("The transparent animal mask cannot use mipmaps because coarse levels fill its rectangular bounds.");
}

if (!/heatmapFragmentShader/.test(glowController) || !/toProcessedHeatmap/.test(glowController)) {
  failures.push("Paper Heatmap and its required preprocessing must power the glow.");
}

if (!/HEATMAP_TRANSPARENCY_FLOOR\s*=\s*0\.025/.test(glowController)
  || !/HEATMAP_GLOW_FULL\s*=\s*0\.88/.test(glowController)
  || !/heat\s*=\s*heat\s*</.test(glowController)
  || !/replace\(frameMarker,\s*["']\s*float imgSoftFrame = getImgFrame\(imgUV, \.16\);["']\)/.test(glowController)) {
  failures.push("The Paper Heatmap must suppress low-level rectangular heat before color compositing.");
}

if (!/outerBlurMarker/.test(glowController)
  || !/float outerBlur = pow\(max\(img\[0\] \* \(1\. - img\[2\]\), 0\.\), \.5\);/.test(glowController)) {
  failures.push("The glow must derive its outer edge from Paper's narrow contour channels, not its frame-filling wide blur.");
}

if (!/fillEnclosedMaskHoles/.test(glowController)) {
  failures.push("The glow mask must fill enclosed dither holes so the bloom remains continuous around the silhouette.");
}

if (!/clearProcessedMaskBackground/.test(glowController)
  || !/PROCESSED_MASK_EMPTY_THRESHOLD\s*=\s*8/.test(glowController)
  || !/pixels\[offset \+ 3\]\s*=\s*departureFromEmpty\s*>=\s*PROCESSED_MASK_EMPTY_THRESHOLD\s*\?\s*255\s*:\s*0/.test(glowController)) {
  failures.push("The processed Heatmap must make its empty background truly transparent before rendering.");
}

if (!/GLOW_MASK_PADDING\s*=\s*0\.5/.test(glowController)) {
  failures.push("The glow mask needs enough transparent padding to keep the halo away from its render bounds.");
}

if (!/u_colorBack\s*:\s*\[0\s*,\s*0\s*,\s*0\s*,\s*0\]/.test(glowController)) {
  failures.push("The Heatmap background must be fully transparent.");
}

const premultipliedAlphaMatch = glowController.match(/premultipliedAlpha\s*:\s*(true|false)/);
if (!premultipliedAlphaMatch) {
  failures.push("The Paper canvas alpha-compositing mode must be explicit.");
} else {
  const usesPremultipliedAlpha = premultipliedAlphaMatch[1] === "true";
  // Paper Heatmap adds animated RGB noise after calculating opacity. At the
  // transparent edge that can produce RGB > 0 with alpha = 0. Declaring that
  // framebuffer as premultiplied leaks a rectangular tint during compositing;
  // straight alpha multiplies the residual RGB by zero and keeps the edge clear.
  const premultipliesShaderNoise = /color\s*\+=\s*opacity\s*\*\s*\.02/.test(glowController);
  const transparentEdgeRgb = premultipliesShaderNoise ? 0 : 0.01;
  const transparentEdgeAlpha = 0;
  const compositedEdgeRgb = usesPremultipliedAlpha
    ? transparentEdgeRgb
    : transparentEdgeRgb * transparentEdgeAlpha;
  if (compositedEdgeRgb !== 0) {
    failures.push("The Heatmap canvas leaks RGB through transparent pixels, exposing its rectangular bounds.");
  }
  if (!usesPremultipliedAlpha || !premultipliesShaderNoise) {
    failures.push("The Heatmap output must remain consistently premultiplied so its halo stays bright without dark fringes.");
  }
}

if (!/u_outerGlow\s*:\s*0\.26/.test(glowController)
  || !/u_contour\s*:\s*0\.11/.test(glowController)
  || !/u_innerGlow\s*:\s*0/.test(glowController)
  || !/u_noise\s*:\s*0/.test(glowController)) {
  failures.push("Heatmap uniforms must match the approved contour and glow settings.");
}

if (!/GLOW_VISIBLE_OPACITY\s*=\s*0\.86/.test(glowController)
  || !/GLOW_ENTER_DURATION\s*=\s*380/.test(glowController)
  || !/GLOW_LEAVE_DURATION\s*=\s*460/.test(glowController)
  || !/GLOW_ENTER_EASING\s*=\s*"cubic-bezier\(\.16,1,\.3,1\)"/.test(glowController)
  || !/GLOW_LEAVE_EASING\s*=\s*"cubic-bezier\(\.4,0,\.2,1\)"/.test(glowController)) {
  failures.push("Glow entry and exit need distinct art-directed bezier fades.");
}

if (glowController.indexOf("const current = Number.parseFloat(getComputedStyle(host).opacity)")
  > glowController.indexOf("opacityAnimation?.cancel()")) {
  failures.push("Glow reversals must capture the current rendered opacity before cancelling the previous fade.");
}

if (!/const coreGlow/.test(glowController)
  || /u_colors\s*:\s*\[glow,\s*glow,\s*\[1,\s*1,\s*1,\s*1\]\]/.test(glowController)) {
  failures.push("The glow core must stay color-tinted instead of creating an empty-looking white band.");
}

if (!/setSpeed\(active\s*\?\s*0\.12\s*:\s*0\)/.test(glowController)) {
  failures.push("Shader motion must run at 0.12 only while the glow is active.");
}

if (!/prepareToken/.test(glowController) || !/processedMasks/.test(glowController)) {
  failures.push("Processed masks must be cached and protected against stale async updates.");
}

if (!/glow\s*:\s*"#[0-9a-fA-F]{6}"/g.test(source)
  || (source.match(/glow\s*:\s*"#[0-9a-fA-F]{6}"/g) ?? []).length !== 5) {
  failures.push("Every scene must provide its own opaque glow color.");
}

const companyRecordRule = styles.match(/\.company-record\{([^}]*)\}/)?.[1] ?? "";
if (/border-top/.test(companyRecordRule)) {
  failures.push("The divider below ACTUAL must be removed.");
}

if (!/\.animal-source\{[^}]*border-top/.test(styles)) {
  failures.push("The popup REFERENCE divider must remain.");
}

if (failures.length) throw new Error(failures.join("\n"));

console.log("Animal hover uses one reusable transparent Paper Heatmap with cached alpha masks and no CSS glow fallback.");
