/**
 * Composition root (§4.1): wires sim, render, ui, input and persistence.
 * Nothing below this file knows about anything beside it.
 */

import { Scene } from 'three/webgpu';

import { attachKeys } from '@input/keys';
import { attachPointer } from '@input/pointer';
import { Autosave } from '@persistence/autosave';
import { DirtyChunks, SaveSlot } from '@persistence/chunks';
import { SaveError } from '@persistence/schema';
import { localStorageAdapter } from '@persistence/storage';
import { MapRig, type GroundRect } from '@render/camera/MapRig';
import { createPaletteTexture } from '@render/materials/palette';
import { createPaletteMaterial } from '@render/materials/paletteMaterial';
import { Picker } from '@render/picking';
import { createRenderer } from '@render/Renderer';
import { ChunkManager } from '@render/scene/ChunkManager';
import { KopdesMesh } from '@render/scene/Kopdes';
import { SelectionRing } from '@render/scene/Overlays';
import { Palms } from '@render/scene/Palms';
import { Sky } from '@render/scene/Sky';
import { digestEvents } from '@render/sync';
import { WORLD } from '@sim/balance/world';
import { createSim, restoreSim, type Sim } from '@sim/index';
import type { BlockId, Command } from '@sim/types';
import { BlockPanel } from '@ui/BlockPanel';
import { Hud } from '@ui/Hud';
import { Menu } from '@ui/Menu';
import { Toasts } from '@ui/Toasts';

import { GameLoop } from './loop.ts';
import { TimeControl } from './timeControl.ts';

const SLOT = 'slot0';

function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
}

export async function startApp(root: HTMLElement): Promise<() => void> {
  const params = new URLSearchParams(location.search);
  root.style.position = 'relative';

  // ── Persistence ─────────────────────────────────────────────────────────
  const storage = localStorageAdapter();
  const slot = new SaveSlot({ storage, slot: SLOT, appVersion: __APP_VERSION__ });
  const dirty = new DirtyChunks();

  // ── UI shell (needed before the sim so load errors can be shown) ───────
  const toasts = new Toasts(root);
  let saveError: string | null = null;
  let saveNote: string | null = null;

  // ── Sim ─────────────────────────────────────────────────────────────────
  let sim: Sim = bootSim();

  function bootSim(): Sim {
    const seedParam = params.get('seed');
    if (seedParam !== null) return createSim(Number(seedParam) >>> 0);
    if (params.has('fresh') || !slot.exists()) return createSim(randomSeed());
    try {
      return restoreSim(slot.load());
    } catch (error) {
      const message = error instanceof SaveError ? error.message : String(error);
      toasts.push(`Could not load the save: ${message}. Starting a new estate.`, 'error');
      return createSim(randomSeed());
    }
  }

  // ── Renderer & scene ────────────────────────────────────────────────────
  const handle = await createRenderer(root, { forceWebGL: params.has('webgl') });
  const scene = new Scene();
  const sky = new Sky(scene);

  const paletteTexture = createPaletteTexture();
  const { material, uniforms } = createPaletteMaterial(paletteTexture);

  const worldUnits = (): GroundRect => ({
    minX: 0,
    maxX: sim.world.width * WORLD.blockSide,
    minZ: 0,
    maxZ: sim.world.height * WORLD.blockSide,
  });

  const rig = new MapRig({ domElement: handle.canvas, bounds: worldUnits() });
  let chunks = new ChunkManager({
    world: sim.world,
    material,
    getDiverged: () => sim.state.blocks.values(),
  });
  const palms = new Palms(material);
  const kopdes = new KopdesMesh(material);
  const ring = new SelectionRing(material);
  scene.add(chunks.group, palms.group, kopdes.mesh, ring.mesh);

  let picker = new Picker(rig.camera, chunks.group, sim.world);
  const visible: GroundRect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  // ── Time ────────────────────────────────────────────────────────────────
  const time = new TimeControl();
  const autosave = new Autosave({
    slot,
    getState: () => sim.state,
    dirty,
    onSaved: () => {
      saveError = null;
      saveNote = 'saved';
      setTimeout(() => {
        saveNote = null;
      }, 2500);
    },
    onError: (error) => {
      saveError = error instanceof Error ? error.message : String(error);
      toasts.push(`Autosave failed: ${saveError}`, 'error');
    },
  });

  // ── UI ──────────────────────────────────────────────────────────────────
  const hud = new Hud(root, {
    setSpeed: (speed) => time.set(speed),
    openMenu: () => {
      menu.show();
      refreshMenu();
    },
  });

  const panel = new BlockPanel(root, {
    dispatch: (command) => dispatch(command),
    close: () => select(null),
  });

  const menu = new Menu(root, {
    newGame: (seed) => switchSim(createSim(seed)),
    save: () => {
      if (autosave.saveNow()) toasts.push('Saved.');
      refreshMenu();
    },
    load: () => {
      try {
        switchSim(restoreSim(slot.load()));
        toasts.push('Loaded.');
      } catch (error) {
        toasts.push(
          `Load failed: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
      }
      refreshMenu();
    },
  });

  function refreshMenu(): void {
    let lastSavedAt: string | null = null;
    const manifest = storage.get(slot.manifestKey);
    if (manifest) {
      try {
        lastSavedAt = (JSON.parse(manifest) as { savedAt?: string }).savedAt ?? null;
      } catch {
        lastSavedAt = null;
      }
    }
    menu.update({
      estateCode: sim.world.estateCode,
      hasSave: slot.exists(),
      lastSavedAt,
      saveError,
    });
  }

  function refreshHud(): void {
    hud.update({
      cash: sim.state.economy.cash,
      tick: sim.state.tick,
      regime: sim.state.weather.regime,
      rain: sim.state.weather.rain,
      speed: time.speed,
      locked: time.locked,
      estateCode: sim.world.estateCode,
      backend: handle.backend,
      saveNote,
      saveError,
    });
  }

  // ── Wiring ──────────────────────────────────────────────────────────────
  let palmsDirty = true;
  let animateBlocks = new Set<BlockId>();

  function dispatch(command: Command) {
    const result = sim.dispatch(command);
    if (result.ok) {
      // Commands take effect at once even while paused: the sim's own events
      // only surface on the next tick.
      chunks.markBlockDirty(command.block);
      dirty.mark(sim.state.width, command.block);
      if (command.type === 'PlantBlock') {
        palmsDirty = true;
        animateBlocks.add(command.block);
      }
      if (command.type === 'PlaceKopdes') kopdes.sync(sim.state, sim.world);
      if (ring.block !== null) ring.show(sim.state, sim.world, ring.block, performance.now());
      refreshHud();
    } else {
      toasts.push(result.reason, 'warn');
    }
    return result;
  }

  function select(block: BlockId | null): void {
    if (block === null) {
      ring.hide();
      panel.show(sim, null);
      return;
    }
    ring.show(sim.state, sim.world, block, performance.now());
    panel.show(sim, block);
  }

  function focusBlock(block: BlockId): void {
    const [bx, by] = sim.world.toXY(block);
    rig.focus((bx + 0.5) * WORLD.blockSide, (by + 0.5) * WORLD.blockSide, performance.now());
  }

  function focusStart(): void {
    const k = sim.state.kopdes?.blockId ?? sim.state.worldGen.kopdesBlock;
    const [bx, by] = sim.world.toXY(k);
    rig.jumpTo((bx + 0.5) * WORLD.blockSide, (by + 0.5) * WORLD.blockSide);
  }

  function switchSim(next: Sim): void {
    sim = next;
    select(null);
    scene.remove(chunks.group);
    chunks.dispose();
    chunks = new ChunkManager({
      world: sim.world,
      material,
      getDiverged: () => sim.state.blocks.values(),
    });
    scene.add(chunks.group);
    picker = new Picker(rig.camera, chunks.group, sim.world);
    palmsDirty = true;
    animateBlocks = new Set();
    kopdes.sync(sim.state, sim.world);
    dirty.take();
    focusStart();
    refreshHud();
    refreshMenu();
  }

  function onTick(): void {
    const events = sim.tick();
    const digest = digestEvents(events);

    for (const block of digest.terrainBlocks) chunks.markBlockDirty(block);
    if (digest.palmBlocks.size > 0) palmsDirty = true;
    for (const block of digest.animateBlocks) animateBlocks.add(block);
    if (digest.kopdesChanged) kopdes.sync(sim.state, sim.world);
    if (digest.yearPassed !== null)
      toasts.push(`Year ${digest.yearPassed + 1} begins — ${regimeLine(sim.state.weather.regime)}`);

    // Moisture and growth move every tick on every estate block, so every
    // chunk with estate in it is dirty for the save; the dirty set earns its
    // keep on chunks far from the estate that were touched once.
    for (const id of sim.state.blocks.keys()) dirty.mark(sim.state.width, id);

    let burning = false;
    for (const block of sim.state.blocks.values()) if (block.burning) burning = true;
    time.lockToRealtime(burning);

    autosave.onTick(sim.state.tick);
  }

  function onFrame(dt: number, nowMs: number): void {
    rig.update(dt, nowMs);
    rig.visibleGround(visible);
    chunks.update(visible, nowMs);

    if (palmsDirty) {
      palms.sync(sim.state, sim.world, nowMs, animateBlocks);
      animateBlocks = new Set();
      palmsDirty = false;
    }
    palms.update(nowMs);
    ring.update(nowMs);
    sky.update(sim.state.weather, uniforms);

    refreshHud();
    if (panel.selected !== null) panel.refresh();
    handle.render(scene, rig.camera);
  }

  const loop = new GameLoop({
    ticksPerSecond: () => time.ticksPerSecond,
    tick: onTick,
    frame: onFrame,
  });

  const detachPointer = attachPointer(handle.canvas, {
    onClick: (ndc) => select(picker.pickBlock(ndc.x, ndc.y)),
    onDoubleClick: (ndc) => {
      const block = picker.pickBlock(ndc.x, ndc.y);
      if (block !== null) {
        select(block);
        focusBlock(block);
      }
    },
  });

  const detachKeys = attachKeys({
    togglePause: () => time.togglePause(),
    setSpeed: (speed) => time.set(speed),
    rotate: (direction) => rig.rotate(direction, performance.now()),
    focusKopdes: () => focusBlock(sim.state.kopdes?.blockId ?? sim.state.worldGen.kopdesBlock),
    escape: () => {
      if (menu.isOpen) menu.hide();
      else select(null);
    },
  });

  const resize = (): void => {
    const { width, height } = handle.resize();
    rig.setAspect(width / height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const detachAutosave = autosave.attach();

  kopdes.sync(sim.state, sim.world);
  focusStart();
  refreshHud();
  refreshMenu();
  time.subscribe(() => refreshHud());
  loop.start();

  if (!slot.exists() && !params.has('seed')) {
    toasts.push(`New estate ${sim.world.estateCode}. Click a block to begin.`);
  }

  return () => {
    loop.stop();
    detachAutosave();
    detachKeys();
    detachPointer();
    observer.disconnect();
    hud.dispose();
    panel.dispose();
    menu.dispose();
    toasts.dispose();
    chunks.dispose();
    palms.dispose();
    kopdes.dispose();
    ring.dispose();
    sky.dispose();
    rig.dispose();
    material.dispose();
    paletteTexture.dispose();
    handle.dispose();
  };
}

function regimeLine(regime: 'normal' | 'elNino' | 'laNina'): string {
  switch (regime) {
    case 'elNino':
      return 'forecasters call an El Niño year.';
    case 'laNina':
      return 'a La Niña year: expect a wet one.';
    case 'normal':
      return 'an ordinary year, as far as anyone can tell.';
  }
}
