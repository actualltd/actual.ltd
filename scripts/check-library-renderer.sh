#!/usr/bin/env bash

set -euo pipefail

url="${1:-http://127.0.0.1:5174/}"
session="actual-library-renderer"

browser() {
  npx -y agent-browser --session "$session" "$@"
}

cleanup() {
  browser close >/dev/null 2>&1 || true
}
trap cleanup EXIT

browser open "$url" >/dev/null
browser wait --load networkidle >/dev/null
browser wait 1400 >/dev/null

result="$(browser eval --stdin <<'EVALEOF'
(() => {
  const engine = document.querySelector('[data-renderer="three-paper-signal-archive"]');
  const canvases = [...document.querySelectorAll('.art-engine canvas')];
  const canvas = canvases[0];
  return {
    engine: Boolean(engine),
    canvases: canvases.length,
    ready: Boolean(engine?.closest('.visual-layer')?.classList.contains('is-ready')),
    webgl2: Boolean(canvas?.getContext('webgl2')),
    depthPlanes: Number(engine?.getAttribute('data-depth-planes')),
    ditherProvider: engine?.getAttribute('data-dither-provider'),
    layerProcessing: engine?.getAttribute('data-layer-processing'),
    loadedScenes: Number(engine?.getAttribute('data-loaded-scenes')),
  };
})()
EVALEOF
)"

if ACTUAL_RENDERER_RESULT="$result" node -e '
  const result = JSON.parse(process.env.ACTUAL_RENDERER_RESULT);
  const passed = result.engine
    && result.canvases === 1
    && result.ready
    && result.webgl2
    && result.depthPlanes === 4
    && result.ditherProvider === "paper-shaders"
    && result.layerProcessing === "semantic-render-targets"
    && result.loadedScenes === 3;
  process.exit(passed ? 0 : 1);
'; then
  echo "PASS: one Three.js WebGL2 canvas composes semantic render targets with Paper Shaders dithering"
  exit 0
fi

echo "FAIL: library renderer is not active: $result"
exit 1
