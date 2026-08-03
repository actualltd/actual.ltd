import {
  Color,
  GLSL3,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector4,
  WebGLRenderer,
  type Material,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import {
  DitheringTypes,
  imageDitheringFragmentShader,
} from "@paper-design/shaders";
import {
  animate,
  motionValue,
  springValue,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion";

export interface VisualState {
  index: number;
  code: string;
  label: string;
  line: string;
  title: string;
  artist: string;
  date: string;
  imageUrl: string;
  sourceLabel: string;
  sourceUrl: string;
}

export const VISUAL_STATES: readonly VisualState[] = [
  {
    index: 1,
    code: "001",
    label: "FORCE",
    line: "THE WORLD ARRIVES IN WAVES.",
    title: "THE GREAT WAVE",
    artist: "KATSUSHIKA HOKUSAI",
    date: "C. 1830–32",
    imageUrl: "/art/great-wave.jpg",
    sourceLabel: "3 SOURCES — OPEN ACCESS",
    sourceUrl: "/llms.txt",
  },
  {
    index: 2,
    code: "002",
    label: "MOTION",
    line: "TIME, MADE VISIBLE.",
    title: "HORSES. RUNNING",
    artist: "EADWEARD MUYBRIDGE",
    date: "C. 1881",
    imageUrl: "/art/horses-running.jpg",
    sourceLabel: "3 SOURCES — OPEN ACCESS",
    sourceUrl: "/llms.txt",
  },
  {
    index: 3,
    code: "003",
    label: "PRESENCE",
    line: "THE WORLD, MADE PRESENT.",
    title: "EARTHRISE",
    artist: "WILLIAM ANDERS / APOLLO 8",
    date: "24 DECEMBER 1968",
    imageUrl: "/art/earthrise.jpg",
    sourceLabel: "3 SOURCES — PUBLIC RELEASE",
    sourceUrl: "/llms.txt",
  },
] as const;

export interface VisualController {
  setMotionEnabled(enabled: boolean): void;
  setScene(index: number): void;
  destroy(): void;
}

interface VisualOptions {
  motionEnabled: boolean;
  onStateChange: (state: VisualState) => void;
  onUnavailable: () => void;
  onAvailable?: () => void;
}

type LayerRole = "main" | "figure" | "object";

interface LayerSource {
  role: LayerRole;
  imageUrl: string;
  aspect: number;
  opacity: number;
}

interface LayerLayout {
  x: number;
  y: number;
  width: number;
}

interface SceneMedia {
  ditherType: number;
  pixelSize: number;
  colorSteps: number;
  desktop: Record<LayerRole, LayerLayout>;
  mobile: Record<LayerRole, LayerLayout>;
  layers: readonly LayerSource[];
}

interface LayerMesh {
  role: LayerRole;
  mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  material: MeshBasicMaterial;
  aspect: number;
  baseOpacity: number;
  baseX: number;
  baseY: number;
  depth: number;
}

interface SceneRecord {
  group: Group;
  layers: LayerMesh[];
  materials: Array<{ material: Material; baseOpacity: number }>;
  effects: Array<Mesh<RingGeometry, MeshBasicMaterial>>;
  opacity: MotionValue<number>;
  opacityAnimation?: AnimationPlaybackControls;
}

const INK = new Vector4(17 / 255, 16 / 255, 14 / 255, 1);
const PAPER = new Vector4(231 / 255, 224 / 255, 212 / 255, 1);
const PURE_WHITE = new Color(0xffffff);
const MAX_DPR = 1.5;

const SCENE_MEDIA: readonly SceneMedia[] = [
  {
    ditherType: DitheringTypes["8x8"],
    pixelSize: 2.15,
    colorSteps: 1,
    desktop: {
      main: { x: 0, y: 0.28, width: 0.44 },
      figure: { x: -0.25, y: 0.20, width: 0.15 },
      object: { x: 0.25, y: 0.02, width: 0.14 },
    },
    mobile: {
      main: { x: 0, y: 0.34, width: 0.76 },
      figure: { x: -0.27, y: 0.24, width: 0.27 },
      object: { x: 0.27, y: 0.08, width: 0.27 },
    },
    layers: [
      { role: "main", imageUrl: "/art/great-wave.jpg", aspect: 600 / 405, opacity: 0.94 },
      { role: "figure", imageUrl: "/art/sharaku.jpg", aspect: 417 / 624, opacity: 0.82 },
      { role: "object", imageUrl: "/art/conch-trumpet.jpg", aspect: 599 / 494, opacity: 0.78 },
    ],
  },
  {
    ditherType: DitheringTypes["4x4"],
    pixelSize: 2.35,
    colorSteps: 2,
    desktop: {
      main: { x: 0, y: 0.28, width: 0.36 },
      figure: { x: 0.25, y: 0.21, width: 0.14 },
      object: { x: -0.25, y: 0.02, width: 0.14 },
    },
    mobile: {
      main: { x: 0, y: 0.34, width: 0.63 },
      figure: { x: 0.27, y: 0.22, width: 0.24 },
      object: { x: -0.27, y: 0.06, width: 0.27 },
    },
    layers: [
      { role: "main", imageUrl: "/art/horses-running.jpg", aspect: 1024 / 822, opacity: 1 },
      { role: "figure", imageUrl: "/art/spanish-dancer.jpg", aspect: 444 / 624, opacity: 0.80 },
      { role: "object", imageUrl: "/art/chronometer-dial.jpg", aspect: 599 / 575, opacity: 0.80 },
    ],
  },
  {
    ditherType: DitheringTypes.random,
    pixelSize: 1.85,
    colorSteps: 2,
    desktop: {
      main: { x: 0, y: 0.28, width: 0.42 },
      figure: { x: -0.25, y: 0.19, width: 0.15 },
      object: { x: 0.25, y: 0.01, width: 0.14 },
    },
    mobile: {
      main: { x: 0, y: 0.34, width: 0.70 },
      figure: { x: -0.27, y: 0.22, width: 0.26 },
      object: { x: 0.27, y: 0.07, width: 0.27 },
    },
    layers: [
      { role: "main", imageUrl: "/art/earthrise.jpg", aspect: 1920 / 1200, opacity: 0.60 },
      { role: "figure", imageUrl: "/art/thinker.jpg", aspect: 490 / 624, opacity: 0.62 },
      { role: "object", imageUrl: "/art/lunar-module.jpg", aspect: 3011 / 2999, opacity: 0.62 },
    ],
  },
] as const;

const FULLSCREEN_VERTEX_SHADER = `precision mediump float;
in vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}`;

const PAPER_POSTPROCESS_FRAGMENT_SHADER = imageDitheringFragmentShader
  .replace(/^#version 300 es\s*/, "")
  .replace("imageUV.y = 1. - imageUV.y;", "");

function clampIndex(index: number): number {
  return Math.max(0, Math.min(SCENE_MEDIA.length - 1, index));
}

function setRecordOpacity(record: SceneRecord, opacity: number): void {
  record.materials.forEach(({ material, baseOpacity }) => {
    material.opacity = baseOpacity * opacity;
  });
  record.group.visible = opacity > 0.002;
}

export function createVisual(container: HTMLElement, options: VisualOptions): VisualController {
  const stage = document.createElement("div");
  stage.className = "art-engine";
  stage.dataset.renderer = "three-paper-motion";
  stage.dataset.depthPlanes = "4";
  stage.dataset.ditherProvider = "paper-shaders";
  stage.dataset.motionProvider = "motion";
  stage.dataset.scene = "0";
  stage.setAttribute("aria-hidden", "true");
  container.append(stage);

  let renderer: WebGLRenderer | null = null;
  let composer: EffectComposer | null = null;
  let camera: OrthographicCamera | null = null;
  let ditherMaterial: RawShaderMaterial | null = null;
  let motionEnabled = options.motionEnabled;
  let desiredSceneIndex = 0;
  let activeSceneIndex = -1;
  let destroyed = false;
  let ready = false;
  let frame = 0;
  let lastTime = 0;
  let contextLost = false;
  const records: SceneRecord[] = [];
  const textures: Texture[] = [];

  const pointerTargetX = motionValue(0);
  const pointerTargetY = motionValue(0);
  const pointerX = springValue(pointerTargetX, { stiffness: 95, damping: 22, mass: 0.8 });
  const pointerY = springValue(pointerTargetY, { stiffness: 95, damping: 22, mass: 0.8 });
  let resolvedPointerX = 0;
  let resolvedPointerY = 0;

  const stopPointerX = pointerX.on("change", (value) => {
    resolvedPointerX = value;
  });
  const stopPointerY = pointerY.on("change", (value) => {
    resolvedPointerY = value;
  });

  const showFallback = (): void => {
    if (destroyed) return;
    ready = false;
    container.classList.add("is-unavailable");
    container.classList.remove("is-ready");
    options.onUnavailable();
  };

  const showRenderer = (): void => {
    if (destroyed) return;
    ready = true;
    container.classList.remove("is-unavailable");
    container.classList.add("is-ready");
    options.onAvailable?.();
  };

  const updateDither = (sceneIndex: number): void => {
    if (!ditherMaterial) return;
    const media = SCENE_MEDIA[sceneIndex];
    ditherMaterial.uniforms.u_type.value = media.ditherType;
    ditherMaterial.uniforms.u_pxSize.value = media.pixelSize;
    ditherMaterial.uniforms.u_colorSteps.value = media.colorSteps;
  };

  const applyLayout = (): void => {
    if (!camera || !renderer) return;
    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    const viewportWidth = aspect * 2;
    const compact = width < 700 || aspect < 0.82;

    camera.left = -aspect;
    camera.right = aspect;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();

    records.forEach((record, recordIndex) => {
      const layout = compact ? SCENE_MEDIA[recordIndex].mobile : SCENE_MEDIA[recordIndex].desktop;
      record.layers.forEach((layer) => {
        const spec = layout[layer.role];
        let meshWidth = viewportWidth * spec.width;
        let meshHeight = meshWidth / layer.aspect;
        const maxHeight = layer.role === "main" ? 1.2 : 0.84;
        if (meshHeight > maxHeight) {
          const scale = maxHeight / meshHeight;
          meshWidth *= scale;
          meshHeight *= scale;
        }
        layer.baseX = viewportWidth * spec.x;
        layer.baseY = spec.y;
        layer.mesh.scale.set(meshWidth, meshHeight, 1);
        layer.mesh.position.set(layer.baseX, layer.baseY, layer.depth);
      });
    });

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    composer?.setPixelRatio(dpr);
    composer?.setSize(width, height);
    ditherMaterial?.uniforms.u_resolution.value.set(width * dpr, height * dpr);
    ditherMaterial!.uniforms.u_pixelRatio.value = dpr;
    ditherMaterial!.uniforms.u_imageAspectRatio.value = aspect;
  };

  const render = (time: number): void => {
    frame = 0;
    if (!ready || destroyed || contextLost || document.hidden || !composer) return;
    const elapsed = time * 0.001;
    const delta = lastTime === 0 ? 0 : Math.min((time - lastTime) * 0.001, 0.05);
    lastTime = time;

    const active = records[activeSceneIndex];
    if (active) {
      active.layers.forEach((layer) => {
        const amount = layer.role === "main" ? 0.018 : layer.role === "figure" ? 0.038 : 0.055;
        layer.mesh.position.x = layer.baseX + resolvedPointerX * amount;
        layer.mesh.position.y = layer.baseY - resolvedPointerY * amount * 0.62;
      });
      active.effects.forEach((effect, index) => {
        effect.rotation.z = motionEnabled
          ? elapsed * (0.018 + index * 0.004) * (activeSceneIndex === 1 ? -1 : 1)
          : 0;
      });
    }

    composer.render(delta);
    if (motionEnabled) frame = window.requestAnimationFrame(render);
  };

  const requestRender = (): void => {
    if (frame !== 0 || !ready || destroyed || contextLost || document.hidden) return;
    frame = window.requestAnimationFrame(render);
  };

  const transitionTo = (sceneIndex: number, immediate = false): void => {
    if (records.length === 0) return;
    const nextIndex = clampIndex(sceneIndex);
    const previousIndex = activeSceneIndex;
    activeSceneIndex = nextIndex;
    stage.dataset.scene = String(nextIndex);
    updateDither(nextIndex);

    records.forEach((record, index) => {
      record.opacityAnimation?.stop();
      const target = index === nextIndex ? 1 : 0;
      if (target === 1) record.group.visible = true;
      if (immediate || previousIndex < 0) {
        record.opacity.set(target);
      } else {
        record.opacityAnimation = animate(record.opacity, target, {
          duration: target === 1 ? 0.72 : 0.48,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: requestRender,
        });
      }
    });
    requestRender();
  };

  const addEffects = (record: SceneRecord, recordIndex: number): void => {
    const counts = [4, 5, 6];
    const count = counts[recordIndex];
    for (let index = 0; index < count; index += 1) {
      const radius = 0.34 + index * (recordIndex === 2 ? 0.10 : 0.12);
      const geometry = new RingGeometry(radius, radius + 0.0065, 128);
      const baseOpacity = recordIndex === 1 ? 0.11 : 0.14 - index * 0.012;
      const material = new MeshBasicMaterial({
        color: 0x11100e,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(recordIndex === 1 ? -0.16 : 0.10, 0.28, -3 - index * 0.01);
      mesh.scale.x = recordIndex === 0 ? 1.42 : recordIndex === 1 ? 0.82 : 1.12;
      mesh.renderOrder = 0;
      record.group.add(mesh);
      record.effects.push(mesh);
      record.materials.push({ material, baseOpacity });
    }
  };

  const boot = async (): Promise<void> => {
    try {
      if (destroyed) return;
      const nextRenderer = new WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer = nextRenderer;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.setClearColor(PURE_WHITE, 1);
      renderer.domElement.className = "art-canvas";
      renderer.domElement.dataset.webgl = "three";
      stage.append(renderer.domElement);

      const scene = new Scene();
      scene.background = PURE_WHITE;
      camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
      camera.position.z = 10;

      const loader = new TextureLoader();
      const urls = SCENE_MEDIA.flatMap((record) => record.layers.map((layer) => layer.imageUrl));
      const loadedTextures = await Promise.all(urls.map((url) => loader.loadAsync(url)));
      if (destroyed) {
        loadedTextures.forEach((texture) => texture.dispose());
        return;
      }
      const textureByUrl = new Map<string, Texture>();
      urls.forEach((url, index) => {
        const texture = loadedTextures[index];
        texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = false;
        textures.push(texture);
        textureByUrl.set(url, texture);
      });

      const planeGeometry = new PlaneGeometry(1, 1);
      SCENE_MEDIA.forEach((media, recordIndex) => {
        const group = new Group();
        group.visible = false;
        scene.add(group);
        const opacity = motionValue(0);
        const record: SceneRecord = {
          group,
          layers: [],
          materials: [],
          effects: [],
          opacity,
        };
        opacity.on("change", (value) => {
          setRecordOpacity(record, value);
          requestRender();
        });
        addEffects(record, recordIndex);

        media.layers.forEach((source, layerIndex) => {
          const material = new MeshBasicMaterial({
            map: textureByUrl.get(source.imageUrl),
            color: 0xffffff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: source.role === "main" ? NormalBlending : MultiplyBlending,
            premultipliedAlpha: source.role !== "main",
          });
          const mesh = new Mesh(planeGeometry, material);
          const depth = source.role === "main" ? -1 : source.role === "figure" ? 1 : 3;
          mesh.position.z = depth;
          mesh.renderOrder = layerIndex + 1;
          group.add(mesh);
          record.layers.push({
            role: source.role,
            mesh,
            material,
            aspect: source.aspect,
            baseOpacity: source.opacity,
            baseX: 0,
            baseY: 0,
            depth,
          });
          record.materials.push({ material, baseOpacity: source.opacity });
        });
        records.push(record);
      });

      ditherMaterial = new RawShaderMaterial({
        vertexShader: FULLSCREEN_VERTEX_SHADER,
        fragmentShader: PAPER_POSTPROCESS_FRAGMENT_SHADER,
        glslVersion: GLSL3,
        uniforms: {
          u_resolution: { value: new Vector2(1, 1) },
          u_pixelRatio: { value: 1 },
          u_originX: { value: 0.5 },
          u_originY: { value: 0.5 },
          u_worldWidth: { value: 0 },
          u_worldHeight: { value: 0 },
          u_fit: { value: 2 },
          u_scale: { value: 1 },
          u_rotation: { value: 0 },
          u_offsetX: { value: 0 },
          u_offsetY: { value: 0 },
          u_colorFront: { value: INK },
          u_colorBack: { value: PAPER },
          u_colorHighlight: { value: INK },
          u_image: { value: null },
          u_imageAspectRatio: { value: 1 },
          u_type: { value: DitheringTypes["8x8"] },
          u_pxSize: { value: 2.15 },
          u_originalColors: { value: false },
          u_inverted: { value: true },
          u_colorSteps: { value: 1 },
        },
        depthTest: false,
        depthWrite: false,
      });

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new ShaderPass(ditherMaterial, "u_image"));
      composer.addPass(new OutputPass());

      renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        contextLost = true;
        if (frame !== 0) window.cancelAnimationFrame(frame);
        frame = 0;
        showFallback();
      });
      renderer.domElement.addEventListener("webglcontextrestored", () => {
        contextLost = false;
        showRenderer();
        applyLayout();
        requestRender();
      });

      applyLayout();
      transitionTo(desiredSceneIndex, true);
      showRenderer();
      requestRender();
    } catch {
      showFallback();
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!motionEnabled || event.pointerType === "touch") return;
    pointerTargetX.set((event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2);
    pointerTargetY.set((event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2);
  };

  const onPointerLeave = (): void => {
    pointerTargetX.set(0);
    pointerTargetY.set(0);
  };

  const onResize = (): void => {
    applyLayout();
    requestRender();
  };

  const onVisibilityChange = (): void => {
    if (document.hidden) {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else {
      requestRender();
    }
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  options.onStateChange(VISUAL_STATES[0]);
  void boot();

  return {
    setMotionEnabled(enabled: boolean): void {
      motionEnabled = enabled;
      if (!enabled) {
        pointerTargetX.set(0);
        pointerTargetY.set(0);
      }
      requestRender();
    },
    setScene(index: number): void {
      desiredSceneIndex = clampIndex(index);
      options.onStateChange(VISUAL_STATES[desiredSceneIndex]);
      transitionTo(desiredSceneIndex);
    },
    destroy(): void {
      destroyed = true;
      ready = false;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopPointerX();
      stopPointerY();
      records.forEach((record) => {
        record.opacityAnimation?.stop();
        record.materials.forEach(({ material }) => material.dispose());
        record.effects.forEach((effect) => effect.geometry.dispose());
        record.layers.forEach((layer) => layer.mesh.geometry.dispose());
      });
      textures.forEach((texture) => texture.dispose());
      ditherMaterial?.dispose();
      composer?.dispose();
      renderer?.dispose();
      stage.remove();
    },
  };
}
