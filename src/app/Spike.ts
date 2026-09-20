import { MapControls } from 'three/addons/controls/MapControls.js';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  OrthographicCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';

import { DURATION, cascadeDelay, easeOutBack, squashStretch } from '@render/anim/easing.ts';
import { buildPalmGeometry } from '@render/geometry/palm.ts';
import { buildColumnGeometry, type ColumnField } from '@render/geometry/terrain.ts';
import { Palette, createPaletteTexture } from '@render/materials/palette.ts';
import { TINT, createPaletteMaterial } from '@render/materials/paletteMaterial.ts';
import { clamp01, lerp } from '@shared/math.ts';

/** Palms per block side (GDD 2: block = 1 ha = 12x12 = 144 palms). */
const BLOCK = 12;
/** Terrain columns per side; the block plus a margin so the edges can step down. */
const FIELD = 18;
const MARGIN = (FIELD - BLOCK) / 2;
const PALM_COUNT = BLOCK * BLOCK;

/** Camera pitch and azimuth (GDD 6.2: fixed ~35 degrees, snapped diagonal). */
const PITCH = (35 * Math.PI) / 180;
const AZIMUTH = Math.PI / 4;
/**
 * How far back the camera sits. Ortho framing ignores it, but fog is measured in view
 * depth, so every fog distance below is relative to it.
 */
const CAMERA_DISTANCE = 60;

const SKY_WET = new Color(0x9fc2d4);
const SKY_DRY = new Color(0xd8d2b4);

export async function startSpike(root: HTMLElement): Promise<() => void> {
  // ── Renderer ────────────────────────────────────────────────────────────
  // WebGPU, or WebGL 2; `?webgl` forces the fallback so CI takes the same path (GDD 6.4).
  const forceWebGL = new URLSearchParams(location.search).has('webgl');
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL });

  await renderer.init();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const scene = new Scene();
  const fog = new Fog(SKY_WET.clone(), CAMERA_DISTANCE + 10, CAMERA_DISTANCE + 80);

  scene.fog = fog;
  scene.background = SKY_WET.clone();

  // ── Camera: orthographic map rig (GDD 6.2) ─────────────────────────────────
  const camera = new OrthographicCamera();
  const target = new Vector3(FIELD / 2, 0, FIELD / 2);
  let frustumSize = 17;

  const controls = new MapControls(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.target.copy(target);
  controls.minZoom = 0.4;
  controls.maxZoom = 4;

  const placeCamera = (): void => {
    const dir = new Vector3(
      Math.cos(PITCH) * Math.cos(AZIMUTH),
      Math.sin(PITCH),
      Math.cos(PITCH) * Math.sin(AZIMUTH),
    );

    camera.position.copy(controls.target).addScaledVector(dir, CAMERA_DISTANCE);
    camera.lookAt(controls.target);
  };

  const resize = (): void => {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    const aspect = w / h;

    camera.left = (-frustumSize * aspect) / 2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.near = 0.1;
    camera.far = CAMERA_DISTANCE * 3;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  placeCamera();
  resize();
  window.addEventListener('resize', resize);

  // ── Lighting (GDD 6.1: Lambert only, no specular) ──────────────────────────
  const hemi = new HemisphereLight(0xbcd9e8, 0x6b4a30, 1.05);

  scene.add(hemi);

  const sun = new DirectionalLight(0xfff2d8, 1.9);

  sun.position.set(12, 18, 6);
  scene.add(sun);
  scene.add(new AmbientLight(0xffffff, 0.18));

  // ── Shared palette material (GDD 6.4) ──────────────────────────────────────
  const paletteTexture = createPaletteTexture();
  const { material, uniforms } = createPaletteMaterial(paletteTexture);

  // ── Terrain: flat terrace, stepped edges ────────────────────────────────
  const terrain = new Mesh(buildColumnGeometry(makeSpikeField()), material);

  scene.add(terrain);

  // ── Palms: one InstancedMesh, 144 instances ─────────────────────────────
  const palmGeometry = buildPalmGeometry('mature');
  const palms = new InstancedMesh(palmGeometry, material, PALM_COUNT);

  palms.frustumCulled = false;
  scene.add(palms);

  /** Wall-clock ms at which each instance starts its pop-in (GDD 6.5). */
  const animStart = new Float32Array(PALM_COUNT);
  const basePosition: Vector3[] = [];

  for (let row = 0; row < BLOCK; row++) {
    for (let col = 0; col < BLOCK; col++) {
      // Slight triangular offset per row; real palms are not on a square grid.
      const x = MARGIN + col + 0.5 + (row % 2 === 0 ? 0 : 0.5);
      const z = MARGIN + row + 0.5;

      basePosition.push(new Vector3(x, 0, z));
    }
  }

  const _m = new Matrix4();
  const _q = new Quaternion();
  const _s = new Vector3();
  let animating = true;

  const replant = (): void => {
    const now = performance.now();

    for (let i = 0; i < PALM_COUNT; i++) {
      // Cascade by row so the pop rolls across the block (GDD 6.5).
      const row = Math.floor(i / BLOCK);
      const col = i % BLOCK;

      animStart[i] = now + cascadeDelay(row * 2 + col * 0.5);
    }

    animating = true;
  };

  const updatePalms = (now: number): void => {
    let stillAnimating = false;

    for (let i = 0; i < PALM_COUNT; i++) {
      const t = clamp01((now - animStart[i]!) / DURATION.popIn);

      if (t < 1) stillAnimating = true;

      const curve = easeOutBack(t);
      // Volume-preserving squash on top of the pop scale (GDD 6.5).
      const { sy, sxz } = squashStretch(curve, 0.9);
      const scale = t <= 0 ? 0 : curve;

      _s.set(scale * sxz, scale * sy, scale * sxz);
      _m.compose(basePosition[i]!, _q, _s);
      palms.setMatrixAt(i, _m);
    }

    palms.instanceMatrix.needsUpdate = true;
    animating = stillAnimating;
  };

  // ── Weather sliders ─────────────────────────────────────────────────────
  let season = 0;
  let haze = 0;

  const applyWeather = (): void => {
    uniforms.season.value = season;

    // Haze desaturates the world toward amber-grey and closes the fog in (GDD 6.4).
    uniforms.tintAmount.value = haze * 0.55;
    uniforms.tintColor.value.copy(TINT.haze);

    const sky = SKY_WET.clone()
      .lerp(SKY_DRY, season)
      .lerp(TINT.haze, haze * 0.8);

    scene.background = sky;
    fog.color.copy(sky);
    // Clear weather leaves the estate in front of the fog entirely; haze pulls
    // the wall in until the far edge of the block starts to dissolve.
    fog.near = lerp(CAMERA_DISTANCE + 10, CAMERA_DISTANCE - 18, haze);
    fog.far = lerp(CAMERA_DISTANCE + 80, CAMERA_DISTANCE + 12, haze);

    sun.intensity = lerp(1.9, 0.55, haze);
    hemi.intensity = lerp(1.05, 0.7, haze);
  };

  applyWeather();

  const ui = buildOverlay(root, {
    onSeason: (v) => {
      season = v;
      applyWeather();
    },
    onHaze: (v) => {
      haze = v;
      applyWeather();
    },
    onReplant: replant,
  });

  // ── Loop ────────────────────────────────────────────────────────────────
  replant();
  renderer.setAnimationLoop(() => {
    const now = performance.now();

    if (animating) updatePalms(now);
    controls.update();
    frustumSize = 17 / camera.zoom;
    placeCamera();
    void renderer.renderAsync(scene, camera);
  });

  return () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener('resize', resize);
    controls.dispose();
    ui.remove();
    palmGeometry.dispose();
    terrain.geometry.dispose();
    material.dispose();
    paletteTexture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

/**
 * The spike's terrain: a levelled 12x12 terrace at y = 0 surrounded by land that
 * steps down in half-unit increments, so the block reads as a cut terrace.
 */
function makeSpikeField(): ColumnField {
  const heights = new Float32Array(FIELD * FIELD);
  const topSlots = new Uint16Array(FIELD * FIELD);

  for (let z = 0; z < FIELD; z++) {
    for (let x = 0; x < FIELD; x++) {
      const i = z * FIELD + x;
      const inTerrace = x >= MARGIN && x < MARGIN + BLOCK && z >= MARGIN && z < MARGIN + BLOCK;

      if (inTerrace) {
        heights[i] = 0;
        topSlots[i] = Palette.Terrace;
        continue;
      }

      // How far outside the terrace this column sits, in columns.
      const out = Math.max(
        MARGIN - x,
        x - (MARGIN + BLOCK - 1),
        MARGIN - z,
        z - (MARGIN + BLOCK - 1),
      );
      // A wobble that varies slowly across columns: per-column noise carves one-column pits,
      // whose walls the mesher correctly draws, and that reads as speckle.
      const wobble = hash01(Math.floor(x / 3), Math.floor(z / 3));

      heights[i] = -0.5 * (out + (wobble > 0.6 ? 1 : 0));
      topSlots[i] =
        hash01(Math.floor(x / 2), Math.floor(z / 2)) > 0.62 ? Palette.Grass : Palette.Forest;
    }
  }

  return {
    size: FIELD,
    heights,
    topSlots,
    sideSlot: Palette.Laterite,
    deepSlot: Palette.Rock,
    floorY: -4,
  };
}

/** Deterministic 0..1 hash so the spike looks identical on every reload. */
function hash01(x: number, z: number): number {
  const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;

  return v - Math.floor(v);
}

interface OverlayHandlers {
  onSeason: (value: number) => void;
  onHaze: (value: number) => void;
  onReplant: () => void;
}

/** Plain DOM overlay; the real HUD is Svelte + Tailwind (GDD 8, GDD 10.2). */
function buildOverlay(root: HTMLElement, handlers: OverlayHandlers): HTMLElement {
  const panel = document.createElement('div');

  panel.className =
    'absolute top-4 left-4 w-64 rounded-lg bg-black/55 p-4 text-sm text-white backdrop-blur';
  panel.innerHTML = `
    <div class="mb-3 font-semibold tracking-wide">Art spike &middot; &sect;6.9</div>
    <label class="mb-1 block text-xs uppercase opacity-70">Season &mdash; wet to dry</label>
    <input id="spike-season" type="range" min="0" max="1" step="0.01" value="0" class="mb-4 w-full" />
    <label class="mb-1 block text-xs uppercase opacity-70">Haze</label>
    <input id="spike-haze" type="range" min="0" max="1" step="0.01" value="0" class="mb-4 w-full" />
    <button id="spike-replant" class="w-full rounded bg-emerald-600 px-3 py-2 font-medium hover:bg-emerald-500">
      Replant
    </button>
    <p class="mt-3 text-xs leading-snug opacity-60">Drag to pan &middot; right-drag to rotate &middot; wheel to zoom</p>
  `;
  root.appendChild(panel);
  root.style.position = 'relative';

  const season = panel.querySelector<HTMLInputElement>('#spike-season')!;
  const haze = panel.querySelector<HTMLInputElement>('#spike-haze')!;
  const replant = panel.querySelector<HTMLButtonElement>('#spike-replant')!;

  season.addEventListener('input', () => handlers.onSeason(Number(season.value)));
  haze.addEventListener('input', () => handlers.onHaze(Number(haze.value)));
  replant.addEventListener('click', handlers.onReplant);

  return panel;
}
