import {
  Color,
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector4,
  WebGLRenderer,
} from "three";

export interface VisualState {
  index: number;
  code: string;
  label: string;
  duration: number;
  transition: number;
  field: Readonly<{
    scale: number;
    drift: number;
    distortion: number;
    contrast: number;
    phase: number;
  }>;
}

export const VISUAL_STATES: readonly VisualState[] = [
  {
    index: 1,
    code: "001",
    label: "CONTOUR",
    duration: 7_000,
    transition: 1_200,
    field: { scale: 1.82, drift: 0.032, distortion: 0.74, contrast: 1.12, phase: 0.0 },
  },
  {
    index: 2,
    code: "002",
    label: "LATTICE",
    duration: 7_000,
    transition: 1_200,
    field: { scale: 7.2, drift: 0.026, distortion: 0.46, contrast: 1.08, phase: 1.7 },
  },
  {
    index: 3,
    code: "003",
    label: "SIGNAL",
    duration: 7_000,
    transition: 1_200,
    field: { scale: 4.7, drift: 0.021, distortion: 0.34, contrast: 1.16, phase: 3.1 },
  },
] as const;

export interface VisualController {
  setMotionEnabled(enabled: boolean): void;
  setReveal(active: boolean): void;
  setPointer(x: number, y: number): void;
  destroy(): void;
}

interface VisualOptions {
  motionEnabled: boolean;
  onStateChange: (state: VisualState) => void;
  onUnavailable: () => void;
  onAvailable?: () => void;
}

const VERTEX_SHADER = /* glsl */ `
  out vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  precision highp int;

  in vec2 vUv;
  out vec4 outColor;
  #define gl_FragColor outColor

  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform vec4 uCurrentParams;
  uniform vec4 uNextParams;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  uniform float uCurrentPhase;
  uniform float uNextPhase;
  uniform float uCurrentState;
  uniform float uNextState;
  uniform float uStateMix;
  uniform float uReveal;
  uniform float uTime;

  const int BAYER_8[64] = int[64](
     0, 32,  8, 40,  2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44,  4, 36, 14, 46,  6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
     3, 35, 11, 43,  1, 33,  9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47,  7, 39, 13, 45,  5, 37,
    63, 31, 55, 23, 61, 29, 53, 21
  );

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);

    for (int octave = 0; octave < 4; octave++) {
      value += amplitude * valueNoise(p);
      p = rotation * p * 2.03 + 13.7;
      amplitude *= 0.5;
    }

    return value;
  }

  float contourField(vec2 p, vec4 params, float phase, float time) {
    float localTime = time * params.y;
    vec2 drift = vec2(localTime, -localTime * 0.63);
    float broad = fbm(p * params.x + drift + phase);
    float detail = fbm(p * (params.x * 2.25) - drift * 0.46 + phase * 1.9);
    float terrain = mix(broad, detail, params.z * 0.24);
    float bands = abs(fract(terrain * 6.0 + 0.08 * sin(p.y * 2.4)) - 0.5);
    float contours = 1.0 - smoothstep(0.035, 0.115, bands);
    float mass = smoothstep(0.27, 0.76, terrain);
    return clamp(mass * 0.82 + contours * 0.48, 0.0, 1.0) * params.w;
  }

  float latticeField(vec2 p, vec4 params, float phase, float time) {
    float localTime = time * params.y;
    vec2 warp = vec2(
      fbm(p * 1.35 + vec2(localTime, phase)) - 0.5,
      fbm(p * 1.35 + vec2(phase, -localTime * 0.8)) - 0.5
    );
    vec2 q = p + warp * params.z;
    float xLines = abs(sin((q.x * params.x + 0.16 * sin(q.y * 2.2) + localTime) * 3.14159265));
    float yLines = abs(sin((q.y * params.x * 0.76 + 0.15 * sin(q.x * 2.5) - localTime * 0.8) * 3.14159265));
    float weave = smoothstep(0.79, 0.97, max(xLines, yLines));
    float interference = 0.5 + 0.5 * sin((q.x + q.y) * 9.0 + phase + localTime * 3.0);
    return clamp((0.10 + weave * 0.74 + interference * 0.18) * params.w, 0.0, 1.0);
  }

  float signalField(vec2 p, vec4 params, float phase, float time) {
    float localTime = time * params.y;
    vec2 originA = vec2(-0.36, 0.08) + 0.035 * vec2(sin(localTime + phase), cos(localTime * 0.7));
    vec2 originB = vec2(0.42, -0.17) + 0.025 * vec2(cos(localTime * 0.8), sin(localTime + phase));
    float radiusA = length(p - originA);
    float radiusB = length(p - originB);
    float waveA = 0.5 + 0.5 * sin(radiusA * params.x * 12.0 - localTime * 3.0 + phase);
    float waveB = 0.5 + 0.5 * sin(radiusB * params.x * 10.4 + localTime * 2.4 - phase);
    float moire = mix(waveA, waveA * waveB, 0.64 + params.z * 0.3);
    float envelope = 1.0 - smoothstep(0.48, 1.12, min(radiusA, radiusB));
    return clamp((moire * 0.72 + envelope * 0.19) * params.w, 0.0, 1.0);
  }

  float stateField(float state, vec2 p, vec4 params, float phase, float time) {
    if (state < 0.5) {
      return contourField(p, params, phase, time);
    }
    if (state < 1.5) {
      return latticeField(p, params, phase, time);
    }
    return signalField(p, params, phase, time);
  }

  float bayerThreshold() {
    ivec2 matrixCell = ivec2(mod(floor(gl_FragCoord.xy), 8.0));
    int matrixIndex = matrixCell.x + matrixCell.y * 8;
    return (float(BAYER_8[matrixIndex]) + 0.5) / 64.0;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vUv - 0.5;
    p.x *= aspect;

    float stateMix = uStateMix * uStateMix * (3.0 - 2.0 * uStateMix);
    float tone = stateField(uCurrentState, p, uCurrentParams, uCurrentPhase, uTime);
    if (stateMix > 0.001) {
      float nextField = stateField(uNextState, p, uNextParams, uNextPhase, uTime);
      tone = mix(tone, nextField, stateMix);
    }
    tone = clamp(tone, 0.0, 1.0);

    float dithered = step(bayerThreshold(), tone);
    vec2 pointer = uPointer - 0.5;
    pointer.x *= aspect;
    float pointerDistance = length(p - pointer);
    float aperture = (1.0 - smoothstep(0.055, 0.31, pointerDistance)) * uReveal;
    float quietTone = smoothstep(0.22, 0.78, tone);
    float pixel = mix(dithered, quietTone, aperture * 0.88);

    outColor = vec4(mix(uInk, uPaper, pixel), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const EMPTY_CONTROLLER: VisualController = {
  setMotionEnabled: () => undefined,
  setReveal: () => undefined,
  setPointer: () => undefined,
  destroy: () => undefined,
};

function stateParameters(state: VisualState): Vector4 {
  const { scale, drift, distortion, contrast } = state.field;
  return new Vector4(scale, drift, distortion, contrast);
}

export function createVisual(container: HTMLElement, options: VisualOptions): VisualController {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("role", "presentation");
  canvas.style.imageRendering = "pixelated";
  canvas.style.pointerEvents = "none";
  container.append(canvas);

  const contextAttributes: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    desynchronized: true,
    powerPreference: "high-performance",
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false,
  };

  const context = canvas.getContext("webgl2", contextAttributes);
  if (!context) {
    canvas.remove();
    container.classList.add("is-unavailable");
    options.onUnavailable();
    return EMPTY_CONTROLLER;
  }

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      context,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    canvas.remove();
    container.classList.add("is-unavailable");
    options.onUnavailable();
    return EMPTY_CONTROLLER;
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x11100e, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5) * 0.58);

  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uPointer: { value: new Vector2(0.5, 0.5) },
    uCurrentParams: { value: stateParameters(VISUAL_STATES[0]) },
    uNextParams: { value: stateParameters(VISUAL_STATES[1]) },
    uInk: { value: new Color(0x11100e) },
    uPaper: { value: new Color(0xe7e0d4) },
    uCurrentPhase: { value: VISUAL_STATES[0].field.phase },
    uNextPhase: { value: VISUAL_STATES[1].field.phase },
    uCurrentState: { value: 0 },
    uNextState: { value: 1 },
    uStateMix: { value: 0 },
    uReveal: { value: 0 },
    uTime: { value: 0 },
  };

  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: true,
  });
  const geometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const scene = new Scene();
  scene.add(mesh);
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 1;

  let motionEnabled = options.motionEnabled;
  let destroyed = false;
  let contextLost = false;
  let frameRequest = 0;
  let lastFrameTime: number | undefined;
  let lastRenderedAt = 0;
  let elapsed = 0;
  let activeStateIndex = 0;
  let revealTarget = 0;
  let pointerTargetX = 0.5;
  let pointerTargetY = 0.5;
  let unavailableNotified = false;

  const markUnavailable = (): void => {
    container.classList.remove("is-ready");
    container.classList.add("is-unavailable");
    if (!unavailableNotified) {
      unavailableNotified = true;
      options.onUnavailable();
    }
  };

  const updateStateUniforms = (): void => {
    const cycleDuration = VISUAL_STATES[0].duration;
    const cycleElapsed = elapsed % (cycleDuration * VISUAL_STATES.length);
    const nextStateIndex = Math.floor(cycleElapsed / cycleDuration) % VISUAL_STATES.length;
    const stateElapsed = cycleElapsed % cycleDuration;
    const currentState = VISUAL_STATES[nextStateIndex];
    const followingIndex = (nextStateIndex + 1) % VISUAL_STATES.length;
    const followingState = VISUAL_STATES[followingIndex];
    const transitionStart = currentState.duration - currentState.transition;
    const transitionProgress = Math.max(
      0,
      Math.min(1, (stateElapsed - transitionStart) / currentState.transition),
    );

    uniforms.uCurrentState.value = nextStateIndex;
    uniforms.uNextState.value = followingIndex;
    uniforms.uStateMix.value = transitionProgress;
    uniforms.uCurrentParams.value.set(
      currentState.field.scale,
      currentState.field.drift,
      currentState.field.distortion,
      currentState.field.contrast,
    );
    uniforms.uNextParams.value.set(
      followingState.field.scale,
      followingState.field.drift,
      followingState.field.distortion,
      followingState.field.contrast,
    );
    uniforms.uCurrentPhase.value = currentState.field.phase;
    uniforms.uNextPhase.value = followingState.field.phase;

    if (activeStateIndex !== nextStateIndex) {
      activeStateIndex = nextStateIndex;
      options.onStateChange(currentState);
    }
  };

  const render = (): void => {
    if (destroyed || contextLost) return;
    renderer.render(scene, camera);
  };

  const shouldContinueInteraction = (): boolean => {
    const pointer = uniforms.uPointer.value;
    return (
      Math.abs(uniforms.uReveal.value - revealTarget) > 0.002 ||
      Math.abs(pointer.x - pointerTargetX) > 0.0005 ||
      Math.abs(pointer.y - pointerTargetY) > 0.0005
    );
  };

  const scheduleFrame = (): void => {
    if (
      frameRequest === 0 &&
      !destroyed &&
      !contextLost &&
      !document.hidden &&
      (motionEnabled || shouldContinueInteraction())
    ) {
      frameRequest = window.requestAnimationFrame(onFrame);
    }
  };

  function onFrame(time: number): void {
    frameRequest = 0;
    if (destroyed || contextLost || document.hidden) {
      lastFrameTime = undefined;
      return;
    }

    const interactionActive = shouldContinueInteraction();
    if (motionEnabled && !interactionActive && time - lastRenderedAt < 1000 / 30) {
      scheduleFrame();
      return;
    }

    if (lastFrameTime !== undefined && motionEnabled) {
      elapsed += Math.min(time - lastFrameTime, 50);
    }
    lastFrameTime = time;

    const pointerEase = 0.095;
    const revealEase = revealTarget > uniforms.uReveal.value ? 0.085 : 0.065;
    uniforms.uPointer.value.x += (pointerTargetX - uniforms.uPointer.value.x) * pointerEase;
    uniforms.uPointer.value.y += (pointerTargetY - uniforms.uPointer.value.y) * pointerEase;
    uniforms.uReveal.value += (revealTarget - uniforms.uReveal.value) * revealEase;
    uniforms.uTime.value = elapsed * 0.001;
    updateStateUniforms();
    render();
    lastRenderedAt = time;

    if (motionEnabled || shouldContinueInteraction()) scheduleFrame();
    else lastFrameTime = undefined;
  }

  const resize = (): void => {
    if (destroyed || contextLost) return;
    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(uniforms.uResolution.value);
    render();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const handleVisibilityChange = (): void => {
    lastFrameTime = undefined;
    if (document.hidden) {
      if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
      frameRequest = 0;
    } else {
      render();
      scheduleFrame();
    }
  };

  const handleContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    lastFrameTime = undefined;
    markUnavailable();
  };

  const handleContextRestored = (): void => {
    contextLost = false;
    unavailableNotified = false;
    renderer.resetState();
    container.classList.remove("is-unavailable");
    container.classList.add("is-ready");
    options.onAvailable?.();
    resize();
    scheduleFrame();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  canvas.addEventListener("webglcontextlost", handleContextLost);
  canvas.addEventListener("webglcontextrestored", handleContextRestored);

  resize();
  updateStateUniforms();
  options.onStateChange(VISUAL_STATES[0]);
  render();
  container.classList.remove("is-unavailable");
  container.classList.add("is-ready");
  options.onAvailable?.();
  scheduleFrame();

  return {
    setMotionEnabled(enabled: boolean): void {
      if (destroyed || motionEnabled === enabled) return;
      motionEnabled = enabled;
      lastFrameTime = undefined;
      if (!enabled && frameRequest !== 0 && !shouldContinueInteraction()) {
        window.cancelAnimationFrame(frameRequest);
        frameRequest = 0;
      }
      render();
      scheduleFrame();
    },

    setReveal(active: boolean): void {
      if (destroyed) return;
      revealTarget = active ? 1 : 0;
      scheduleFrame();
    },

    setPointer(x: number, y: number): void {
      if (destroyed) return;
      pointerTargetX = Math.min(1, Math.max(0, x));
      pointerTargetY = Math.min(1, Math.max(0, y));
      scheduleFrame();
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (frameRequest !== 0) window.cancelAnimationFrame(frameRequest);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      container.classList.remove("is-ready");
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
