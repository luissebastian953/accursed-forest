/**
 * `workbench.html`: the estate's parts on a turntable, one at a time, the way
 * a component gallery does it for widgets. Pick a subject on the left, ask it
 * to do something on the right, change the backdrop to judge the light, and
 * watch what the renderer is holding while you do.
 *
 * It is a development page. Nothing links to it, it is not in the sitemap,
 * and it carries `noindex`; it exists so a model can be looked at without
 * hunting for one on a ridge somewhere, and so a leak shows up as a number
 * that climbs rather than as a tab that dies an hour later.
 */

import { Color, Group, Mesh, Scene, type Material } from 'three/webgpu';

import { MapRig, type GroundRect } from '@render/camera/MapRig';
import { BoxBuilder } from '@render/geometry/boxBuilder';
import { createPaletteTexture } from '@render/materials/palette';
import { createPaletteMaterial } from '@render/materials/paletteMaterial';
import { Palette } from '@render/materials/paletteSlots';
import { createRenderer } from '@render/Renderer';
import { Sky } from '@render/scene/Sky';
import type { Weather } from '@sim/types';

import { GameLoop } from '../loop.ts';

import { ACTIONS, SUBJECTS, type ActionId, type SubjectHandle } from './subjects.ts';
import { BACKDROPS, WorkbenchPanel, type StageStats } from './workbenchState.svelte.ts';

/** The plinth: a patch of ground to sit a subject on, and to read scale from. */
const PLINTH = 14;
/** How fast the turntable turns, in radians a second. */
const SPIN = 0.5;
/** Stats are read a few times a second: often enough to watch, cheap to do. */
const STATS_MS = 400;

/** A fixed fair-weather day, so the light is the same every time. */
const WEATHER: Weather = {
  dayOfYear: 90,
  regime: 'normal',
  rain: 0,
  sun: 1,
  sky: 'clear',
  skyUntil: 0,
  naturalFires: [],
  dryStreak: 0,
  wetStreak: 0,
  activeEvents: [],
};

export async function startWorkbench(root: HTMLElement): Promise<() => void> {
  root.style.position = 'relative';
  const params = new URLSearchParams(location.search);
  const handle = await createRenderer(root, { forceWebGL: params.has('webgl') });

  const scene = new Scene();
  const sky = new Sky(scene);
  const skyColour = (scene.background as Color).clone();
  const skyFog = scene.fog;

  const paletteTexture = createPaletteTexture();
  const { material, uniforms } = createPaletteMaterial(paletteTexture);
  const spectral = createPaletteMaterial(paletteTexture, uniforms).material;
  spectral.transparent = true;
  spectral.opacity = 0.45;
  spectral.depthWrite = false;

  // The plinth, drawn once and kept: it is the only thing on the stage that
  // does not change when the subject does.
  const plinthBuilder = new BoxBuilder();
  plinthBuilder.addAABox(0, -0.25, 0, PLINTH, 0.5, PLINTH, {
    side: Palette.Laterite,
    top: Palette.Grass,
  });
  const plinth = new Mesh(plinthBuilder.build(), material);
  scene.add(plinth);

  /** Everything the current subject brought with it, so it all goes at once. */
  const turntable = new Group();
  scene.add(turntable);

  const STAGE: GroundRect = {
    minX: -PLINTH / 2,
    maxX: PLINTH / 2,
    minZ: -PLINTH / 2,
    maxZ: PLINTH / 2,
  };
  const rig = new MapRig({ domElement: handle.canvas, bounds: STAGE, baseFrustum: 15 });
  rig.jumpTo(0, 0);

  let current: SubjectHandle | null = null;
  let spin = false;
  let backdrop = BACKDROPS[0]!.id;

  const panel = new WorkbenchPanel(root, SUBJECTS, {
    select: (id) => show(id),
    run: (action) => current?.actions?.[action]?.(),
    setBackdrop: (id) => {
      backdrop = id;
      panel.backdrop = id;
      applyBackdrop();
    },
    setGrid: (on) => {
      panel.grid = on;
      plinth.visible = on;
    },
    setSpin: (on) => {
      panel.spin = on;
      spin = on;
      if (!on) turntable.rotation.y = 0;
    },
  });

  function applyBackdrop(): void {
    const chosen = BACKDROPS.find((b) => b.id === backdrop) ?? BACKDROPS[0]!;
    if (chosen.colour === null) {
      (scene.background as Color).copy(skyColour);
      scene.fog = skyFog;
    } else {
      // A plain colour and no fog: fog over a black backdrop hides the very
      // emission you opened the dark background to look at.
      scene.background = new Color(chosen.colour);
      scene.fog = null;
    }
  }

  /** Put a subject on the turntable, taking the last one off first. */
  function show(id: string): void {
    const subject = SUBJECTS.find((s) => s.id === id);
    if (!subject) return;
    current?.dispose();
    turntable.clear();
    current = null;
    panel.available = [];
    panel.error = null;
    panel.selected = id;
    turntable.rotation.y = 0;
    try {
      const built = subject.build({
        material: material as Material,
        spectral: spectral as Material,
        groundAt: () => 0,
        camera: rig.camera,
        view: STAGE,
      });
      turntable.add(built.object);
      current = built;
      panel.available = ACTIONS.filter((a) => built.actions?.[a] !== undefined);
    } catch (error) {
      panel.error = error instanceof Error ? error.message : String(error);
    }
  }

  const resize = (): void => {
    const { width, height } = handle.resize();
    rig.setAspect(width / height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const onKey = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'q' || event.key === 'Q') rig.rotate(-1, performance.now());
    if (event.key === 'e' || event.key === 'E') rig.rotate(1, performance.now());
  };
  window.addEventListener('keydown', onKey);

  let statsAt = 0;
  let frames = 0;
  let framesSince = performance.now();
  let fps = 0;

  function readStats(nowMs: number): StageStats {
    const info = handle.renderer.info as unknown as {
      render: { drawCalls: number; triangles: number };
      memory: { geometries: number; textures: number; programs: number; total: number };
    };
    frames += 1;
    if (nowMs - framesSince >= 1000) {
      fps = Math.round((frames * 1000) / (nowMs - framesSince));
      frames = 0;
      framesSince = nowMs;
    }
    return {
      backend: handle.backend,
      drawCalls: info.render.drawCalls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.memory.programs,
      bytes: info.memory.total,
      fps,
    };
  }

  const loop = new GameLoop({
    ticksPerSecond: () => 0,
    tick: () => undefined,
    frame: (dt, nowMs) => {
      rig.update(dt, nowMs);
      sky.update(WEATHER, uniforms, { smoke: 0, ash: 0 }, dt);
      applyBackdrop();
      if (spin) turntable.rotation.y += SPIN * dt;
      current?.update?.(dt, nowMs);
      handle.render(scene, rig.camera);
      const stats = readStats(nowMs);
      if (nowMs - statsAt >= STATS_MS) {
        statsAt = nowMs;
        panel.stats = stats;
      }
    },
  });

  // Whatever `?subject=` names, or the first thing in the catalogue.
  show(params.get('subject') ?? SUBJECTS[0]!.id);
  loop.start();

  return () => {
    loop.stop();
    window.removeEventListener('keydown', onKey);
    observer.disconnect();
    current?.dispose();
    panel.dispose();
    plinth.geometry.dispose();
    sky.dispose();
    rig.dispose();
    spectral.dispose();
    material.dispose();
    paletteTexture.dispose();
    handle.dispose();
  };
}

export type { ActionId };
