/**
 * `?mobs`: the mob proof of concept.
 *
 * A real estate (seed 42, streamed chunks) with a crowd of rigged mobs walking
 * over it, and a readout of what they cost: frame time, the time spent posing
 * them, draw calls and triangles. Buttons set the crowd size and switch between
 * the two ways of drawing it; one scene node per body part, or every part
 * skinned on the CPU into one merged mesh; so the question "will this make
 * the game heavy?" gets a
 * number rather than an opinion. "Chop a tree" plays the tree-fall animation.
 *
 * `?mobs&count=200&mode=nodes` presets the crowd for scripted measurement, and
 * `window.__mobs` exposes the stats.
 */

import { Mesh, Scene } from 'three/webgpu';

import { easeInQuad, easeOutBounce } from '@render/anim/easing';
import { MapRig } from '@render/camera/MapRig';
import { BoxBuilder } from '@render/geometry/boxBuilder';
import { createPaletteTexture } from '@render/materials/palette';
import { createPaletteMaterial } from '@render/materials/paletteMaterial';
import { Palette } from '@render/materials/paletteSlots';
import { MobField, type MobMode } from '@render/mobs/MobField';
import { SPECIES, SPECIES_IDS, type SpeciesId } from '@render/mobs/species';
import { createRenderer } from '@render/Renderer';
import { landHeight } from '@render/scene/chunkField';
import { ChunkManager } from '@render/scene/ChunkManager';
import { Sky } from '@render/scene/Sky';
import { WORLD } from '@sim/balance/world';
import { createSim } from '@sim/index';

import { GameLoop } from './loop.ts';

const COUNTS = [25, 100, 250, 500] as const;

/** A wild mix, weighted the way an estate would see them. */
const MIX: readonly SpeciesId[] = [
  'pangolin',
  'pangolin',
  'shinyCapybara',
  'wildBoar',
  'wildBoar',
  'pig',
  'pig',
  'mouse',
  'mouse',
  'mouse',
  'cow',
  'monkey',
  'monkey',
  'orangutan',
  'capybara',
  'thief',
  'sanitizer',
  'security',
  'plantDoctor',
  'babiNgepet',
  'ghost',
];

/** How long a tree takes to hit the ground, and to sink after. */
const FALL_MS = 1400;
const SINK_MS = 1600;

interface FallingTree {
  mesh: Mesh;
  startedAt: number;
}

export async function startMobPoc(root: HTMLElement): Promise<() => void> {
  const params = new URLSearchParams(location.search);
  root.style.position = 'relative';

  const sim = createSim(42);
  const { world } = sim;
  const handle = await createRenderer(root, { forceWebGL: params.has('webgl') });
  const scene = new Scene();
  const sky = new Sky(scene);
  const paletteTexture = createPaletteTexture();
  const { material, uniforms } = createPaletteMaterial(paletteTexture);
  const spectral = createPaletteMaterial(paletteTexture, uniforms).material;
  spectral.transparent = true;
  spectral.opacity = 0.45;
  spectral.depthWrite = false;

  const chunks = new ChunkManager({
    world,
    material,
    getDiverged: () => sim.state.blocks.values(),
    getTick: () => sim.state.tick,
  });
  scene.add(chunks.group);

  // The crowd wanders over the starting square and a ring around it.
  const { startX, startY, startSize } = sim.state.worldGen;
  const side = WORLD.blockSide;
  const bounds = {
    minX: (startX - 2) * side,
    maxX: (startX + startSize + 2) * side,
    minZ: (startY - 2) * side,
    maxZ: (startY + startSize + 2) * side,
  };
  const groundAt = (x: number, z: number): number =>
    landHeight(world, (id) => sim.state.blocks.get(id)?.phase ?? 'wild', x, z);

  const mobs = new MobField({ material, spectralMaterial: spectral, bounds, groundAt });
  scene.add(mobs.group);

  const rig = new MapRig({
    domElement: handle.canvas,
    bounds: { minX: 0, maxX: world.width * side, minZ: 0, maxZ: world.height * side },
  });
  rig.jumpTo((startX + startSize / 2) * side, (startY + startSize / 2) * side);

  // ── The crowd ──────────────────────────────────────────────────────────
  let mixIndex = 0;
  function populate(count: number): void {
    mobs.clear();
    for (let i = 0; i < count; i++) {
      mobs.spawn(MIX[mixIndex % MIX.length]!);
      mixIndex += 1;
    }
    refreshPanel();
  }

  // ── The falling tree ───────────────────────────────────────────────────
  const falling: FallingTree[] = [];
  function treeGeometry() {
    const b = new BoxBuilder();
    b.addAABox(0, 1.3, 0, 0.36, 2.6, 0.36, { side: Palette.Bark });
    b.addAABox(0, 3, 0, 2.6, 1, 2.4, { side: Palette.Canopy });
    b.addAABox(0.2, 3.8, -0.2, 1.7, 0.8, 1.6, { side: Palette.CanopyLight });
    return b.build();
  }
  function chopTree(): void {
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    const mesh = new Mesh(treeGeometry(), material);
    mesh.position.set(x, groundAt(x, z), z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    falling.push({ mesh, startedAt: performance.now() });
  }
  function updateTrees(nowMs: number): void {
    for (let i = falling.length - 1; i >= 0; i--) {
      const tree = falling[i]!;
      const t = nowMs - tree.startedAt;
      if (t < FALL_MS) {
        // Tips slowly, then accelerates; and bounces once on the ground.
        const f = t / FALL_MS;
        const angle =
          f < 0.8 ? easeInQuad(f / 0.8) : 1 - (1 - easeOutBounce((f - 0.8) / 0.2)) * 0.08;
        tree.mesh.rotation.x = angle * (Math.PI / 2 - 0.04);
        continue;
      }
      const sink = (t - FALL_MS) / SINK_MS;
      if (sink >= 1) {
        scene.remove(tree.mesh);
        tree.mesh.geometry.dispose();
        falling.splice(i, 1);
        continue;
      }
      // Fades by sinking: the log settles into the ground and is gone.
      tree.mesh.position.y = groundAt(tree.mesh.position.x, tree.mesh.position.z) - sink * 1.2;
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = {
    frameMs: 0,
    fps: 0,
    updateMs: 0,
    drawCalls: 0,
    triangles: 0,
    count: 0,
    mode: 'merged' as MobMode,
    backend: handle.backend,
  };
  let frames = 0;
  let accum = 0;
  let accumUpdate = 0;
  let accumInterval = 0;
  let lastFrameMs = -1;
  let lastReport = -1;

  const panel = document.createElement('div');
  panel.className =
    'card pointer-events-auto absolute left-3 top-3 z-10 flex w-72 flex-col gap-2 p-3 text-sm';
  root.appendChild(panel);

  function button(label: string, active = false, testId = ''): string {
    return `<button class="btn btn-sm ${active ? 'btn-green' : 'btn-ghost'}" data-act="${label}" ${testId ? `data-testid="${testId}"` : ''}>${label}</button>`;
  }
  const actions = new Map<string, () => void>();
  function refreshPanel(): void {
    actions.clear();
    const countButtons = COUNTS.map((n) => {
      actions.set(`${n}`, () => populate(n));
      return button(`${n}`, mobs.count === n, `mobs-count-${n}`);
    }).join('');
    const modeButtons = (['merged', 'nodes'] as MobMode[])
      .map((mode) => {
        actions.set(mode, () => {
          mobs.setMode(mode);
          refreshPanel();
        });
        return button(mode, mobs.renderMode === mode, `mobs-mode-${mode}`);
      })
      .join('');
    actions.set('Chop a tree', chopTree);
    panel.innerHTML = `
      <div class="text-base font-extrabold">Mob POC</div>
      <div class="label">Crowd</div>
      <div class="flex flex-wrap gap-1">${countButtons}</div>
      <div class="label">Draw as</div>
      <div class="flex gap-1">${modeButtons}</div>
      <div class="flex gap-1">${button('Chop a tree', false, 'mobs-chop')}</div>
      <div class="pill num text-xs leading-relaxed" data-testid="mobs-stats">
        <div>mobs <b>${mobs.count}</b>, ${SPECIES_IDS.length} species, ${handle.backend}</div>
        <div>frame <b id="stat-frame">–</b> ms, <b id="stat-fps">–</b> fps</div>
        <div>posing <b id="stat-update">–</b> ms/frame</div>
        <div>draw calls <b id="stat-calls">–</b>, tris <b id="stat-tris">–</b></div>
      </div>
      <div class="muted text-xs">Drag to pan, wheel to zoom</div>
    `;
    panel.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((el) => {
      el.addEventListener('click', () => actions.get(el.dataset['act']!)?.());
    });
  }

  function reportStats(): void {
    const el = (id: string): HTMLElement | null => panel.querySelector(`#${id}`);
    const frame = el('stat-frame');
    if (frame) frame.textContent = stats.frameMs.toFixed(1);
    const fps = el('stat-fps');
    if (fps) fps.textContent = stats.fps.toFixed(0);
    const update = el('stat-update');
    if (update) update.textContent = stats.updateMs.toFixed(2);
    const calls = el('stat-calls');
    if (calls) calls.textContent = String(stats.drawCalls);
    const tris = el('stat-tris');
    if (tris) tris.textContent = stats.triangles.toLocaleString('en');
  }

  const visible = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const loop = new GameLoop({
    ticksPerSecond: () => 0,
    tick: () => undefined,
    frame: (dt, nowMs) => {
      const started = performance.now();
      rig.update(dt, nowMs);
      rig.visibleGround(visible);
      chunks.update(visible, nowMs);
      mobs.update(Math.min(dt, 0.1));
      updateTrees(nowMs);
      sky.update(sim.state.weather, uniforms, { smoke: 0, ash: 0 }, dt, nowMs);
      handle.render(scene, rig.camera);

      const info = handle.renderer.info.render;
      frames += 1;
      accum += performance.now() - started;
      accumUpdate += mobs.lastUpdateMs;
      if (lastFrameMs >= 0) accumInterval += nowMs - lastFrameMs;
      lastFrameMs = nowMs;
      if (lastReport < 0) lastReport = nowMs;
      if (nowMs - lastReport > 500 && frames > 1) {
        // `frameMs` is our own work per frame; `fps` is what the screen sees.
        stats.frameMs = accum / frames;
        stats.fps = 1000 / (accumInterval / (frames - 1));
        stats.updateMs = accumUpdate / frames;
        stats.drawCalls = info.drawCalls;
        stats.triangles = info.triangles;
        stats.count = mobs.count;
        stats.mode = mobs.renderMode;
        frames = 0;
        accum = 0;
        accumUpdate = 0;
        accumInterval = 0;
        lastReport = nowMs;
        reportStats();
      }
    },
  });

  const resize = (): void => {
    const { width, height } = handle.resize();
    rig.setAspect(width / height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const preset = Number(params.get('count') ?? 100);
  const mode = params.get('mode');
  if (mode === 'nodes' || mode === 'merged') mobs.setMode(mode);
  populate(Number.isFinite(preset) ? preset : 100);
  (window as unknown as { __mobs: unknown }).__mobs = {
    stats,
    populate,
    setMode: (m: MobMode) => {
      mobs.setMode(m);
      refreshPanel();
    },
    chopTree,
    species: Object.values(SPECIES).map((s) => ({ id: s.id, parts: s.parts.length })),
  };
  loop.start();

  return () => {
    loop.stop();
    observer.disconnect();
    panel.remove();
    mobs.dispose();
    for (const tree of falling) tree.mesh.geometry.dispose();
    chunks.dispose();
    sky.dispose();
    rig.dispose();
    material.dispose();
    spectral.dispose();
    paletteTexture.dispose();
    handle.dispose();
  };
}
