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
import { Fires } from '@render/scene/Fires';
import { KopdesMesh } from '@render/scene/Kopdes';
import { HazardRing, RangeRing, SelectionRing } from '@render/scene/Overlays';
import { Palms } from '@render/scene/Palms';
import { Sky } from '@render/scene/Sky';
import { digestEvents } from '@render/sync';
import { FIRE } from '@sim/balance/fire';
import { WORLD } from '@sim/balance/world';
import { HAZE_EVENT, activeEvent, burningBlocks, isWildfire } from '@sim/fire';
import { createSim, restoreSim, type Sim } from '@sim/index';
import type { BlockId, Command } from '@sim/types';
import { BlockPanel } from '@ui/BlockPanel';
import { formatKg, formatRp } from '@ui/format';
import { Hud } from '@ui/Hud';
import { KopdesShop } from '@ui/KopdesShop';
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

  const makeChunks = (): ChunkManager =>
    new ChunkManager({
      world: sim.world,
      material,
      getDiverged: () => sim.state.blocks.values(),
      getTick: () => sim.state.tick,
    });

  const rig = new MapRig({ domElement: handle.canvas, bounds: worldUnits() });
  let chunks = makeChunks();
  const palms = new Palms(material);
  const kopdes = new KopdesMesh(material);
  const ring = new SelectionRing(material);
  const rangeRing = new RangeRing(material);
  const hazardRing = new HazardRing(material);
  const fires = new Fires(material);
  scene.add(
    chunks.group,
    palms.group,
    kopdes.mesh,
    ring.mesh,
    rangeRing.mesh,
    hazardRing.mesh,
    fires.group,
  );

  let picker = new Picker(rig.camera, chunks.group, sim.world);
  const visible: GroundRect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  // Edge vignette while anything burns (§8 panel 7).
  const vignette = document.createElement('div');
  vignette.className = 'pointer-events-none absolute inset-0 z-[5] transition-opacity duration-700';
  vignette.style.boxShadow = 'inset 0 0 140px 30px rgba(255, 96, 24, 0.55)';
  vignette.style.opacity = '0';
  root.appendChild(vignette);

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

  const shop = new KopdesShop(root, {
    dispatch: (command) => dispatch(command),
    close: () => closeShop(),
  });

  const panel = new BlockPanel(root, {
    dispatch: (command) => dispatch(command),
    close: () => select(null),
    openShop: () => openShop(),
    hoverBurn: (blocks) => {
      if (blocks) hazardRing.show(blocks, sim.state, sim.world);
      else hazardRing.hide();
    },
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

  function openShop(): void {
    shop.open(sim);
    rangeRing.show(sim.state, sim.world);
  }

  function closeShop(): void {
    shop.close();
    rangeRing.hide();
  }

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

  function priceTrend(): -1 | 0 | 1 {
    const history = sim.state.economy.tbsPriceHistory;
    const now = sim.state.economy.tbsPrice;
    const earlier = history[Math.max(0, history.length - 11)] ?? now;
    if (now > earlier * 1.01) return 1;
    if (now < earlier * 0.99) return -1;
    return 0;
  }

  let burningCount = 0;

  function refreshHud(): void {
    hud.update({
      cash: sim.state.economy.cash,
      tick: sim.state.tick,
      tbsPrice: sim.state.economy.tbsPrice,
      tbsTrend: priceTrend(),
      regime: sim.state.weather.regime,
      rain: sim.state.weather.rain,
      speed: time.speed,
      locked: time.locked,
      estateCode: sim.world.estateCode,
      backend: handle.backend,
      saveNote,
      saveError,
      firePressure: sim.state.society.firePressure,
      fireThreshold: FIRE.wildfireThreshold,
      burningCount,
      wildfire: isWildfire(sim.state),
      haze: activeEvent(sim.state, HAZE_EVENT) !== undefined,
    });
  }

  // ── Wiring ──────────────────────────────────────────────────────────────
  let palmsDirty = true;
  let animateBlocks = new Set<BlockId>();

  function syncFireState(): void {
    burningCount = burningBlocks(sim.state).length;
    time.lockToRealtime(burningCount > 0);
    fires.sync(sim.state, sim.world);
    vignette.style.opacity = burningCount > 0 ? (isWildfire(sim.state) ? '1' : '0.6') : '0';
  }

  function dispatch(command: Command) {
    const result = sim.dispatch(command);
    if (result.ok) {
      // Commands take effect at once even while paused: the sim's own events
      // only surface on the next tick.
      if ('block' in command) {
        chunks.markBlockDirty(command.block);
        dirty.mark(sim.state.width, command.block);
      }
      if (command.type === 'PlantBlock') {
        palmsDirty = true;
        animateBlocks.add(command.block);
      }
      if (command.type === 'HarvestBlock') palmsDirty = true;
      if (command.type === 'BurnBlock') {
        syncFireState();
        hazardRing.hide();
        toasts.push(
          isWildfire(sim.state)
            ? 'Fire pressure over the line — this is a wildfire now.'
            : `${blockName(command.block)} burning — speed locked to 1×.`,
          isWildfire(sim.state) ? 'error' : 'warn',
        );
      }
      if (command.type === 'PlaceKopdes' || command.type === 'UpgradeKopdes') {
        kopdes.sync(sim.state, sim.world);
        if (shop.isOpen) rangeRing.show(sim.state, sim.world);
      }
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
      hazardRing.hide();
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
    closeShop();
    scene.remove(chunks.group);
    chunks.dispose();
    chunks = makeChunks();
    scene.add(chunks.group);
    picker = new Picker(rig.camera, chunks.group, sim.world);
    palmsDirty = true;
    animateBlocks = new Set();
    kopdes.sync(sim.state, sim.world);
    syncFireState();
    dirty.take();
    focusStart();
    refreshHud();
    refreshMenu();
  }

  function blockName(block: BlockId): string {
    const [x, y] = sim.world.toXY(block);
    return `block ${x}, ${y}`;
  }

  function onTick(): void {
    const events = sim.tick();
    const d = digestEvents(events);

    for (const block of d.terrainBlocks) chunks.markBlockDirty(block);
    if (d.palmBlocks.size > 0) palmsDirty = true;
    for (const block of d.animateBlocks) animateBlocks.add(block);
    if (d.kopdesChanged) kopdes.sync(sim.state, sim.world);

    if (d.yearPassed !== null)
      toasts.push(`Year ${d.yearPassed + 1} begins — ${regimeLine(sim.state.weather.regime)}`);
    for (const block of d.ripeBlocks) toasts.push(`Ripe: ${blockName(block)} is ready to harvest.`);
    for (const sale of d.sold) {
      toasts.push(
        `Sold ${formatKg(sale.kilograms)} of TBS at ${formatRp(sale.price)}/kg — ${formatRp(sale.revenue)}.`,
      );
    }
    for (const t of d.timber)
      toasts.push(`Timber from ${blockName(t.block)} sold for ${formatRp(t.revenue)}.`);
    if (d.kopdesUpgraded !== null) {
      toasts.push(`Kopdes upgraded to level ${d.kopdesUpgraded}.`);
      if (shop.isOpen) rangeRing.show(sim.state, sim.world);
    }
    if (d.wildfireStarted)
      toasts.push(
        'Wildfire. The fire is no longer yours — it burns until the rain comes.',
        'error',
      );
    if (d.wildfireEnded) toasts.push('The wildfire is out. The smoke will take a while to clear.');
    // Fire news is aggregated: a wildfire tick can touch dozens of blocks.
    if (d.fireSpread.length === 1)
      toasts.push(`Fire spread to ${blockName(d.fireSpread[0]!.to)}.`, 'warn');
    else if (d.fireSpread.length > 1)
      toasts.push(`Fire spread to ${d.fireSpread.length} blocks.`, 'warn');
    const lostPalms = d.palmsBurned.reduce((sum, p) => sum + p.count, 0);
    if (d.palmsBurned.length === 1)
      toasts.push(`${lostPalms} palms burned on ${blockName(d.palmsBurned[0]!.block)}.`, 'error');
    else if (d.palmsBurned.length > 1)
      toasts.push(`${lostPalms} palms burned across ${d.palmsBurned.length} blocks.`, 'error');
    if (d.extinguished.size === 1)
      toasts.push(`Rain put out the fire on ${blockName([...d.extinguished][0]!)}.`);
    else if (d.extinguished.size > 1)
      toasts.push(`Rain put out fires on ${d.extinguished.size} blocks.`);
    const burnedClear = [...d.burnFinished].filter((b) => !d.extinguished.has(b));
    if (burnedClear.length === 1)
      toasts.push(
        `${blockName(burnedClear[0]!)} burned clear — the ash will feed it for a season.`,
      );
    else if (burnedClear.length > 1) toasts.push(`${burnedClear.length} blocks burned clear.`);

    if (
      d.burnStarted.size ||
      d.fireSpread.length ||
      d.burnFinished.size ||
      d.extinguished.size ||
      d.wildfireStarted ||
      d.wildfireEnded
    ) {
      syncFireState();
    }

    // Moisture and growth move every tick on every estate block, so every
    // chunk with estate in it is dirty for the save; the dirty set earns its
    // keep on chunks far from the estate that were touched once.
    for (const id of sim.state.blocks.keys()) dirty.mark(sim.state.width, id);

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
    fires.update(nowMs);
    sky.update(sim.state.weather, uniforms);

    refreshHud();
    if (panel.selected !== null) panel.refresh();
    if (shop.isOpen) shop.refresh();
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
    openShop: () => {
      if (shop.isOpen) closeShop();
      else openShop();
    },
    escape: () => {
      if (menu.isOpen) menu.hide();
      else if (shop.isOpen) closeShop();
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
  syncFireState();
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
    shop.dispose();
    menu.dispose();
    toasts.dispose();
    vignette.remove();
    chunks.dispose();
    palms.dispose();
    kopdes.dispose();
    ring.dispose();
    rangeRing.dispose();
    hazardRing.dispose();
    fires.dispose();
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
      return 'forecasters call an El Niño year. Fires will spread.';
    case 'laNina':
      return 'a La Niña year: expect a wet one.';
    case 'normal':
      return 'an ordinary year, as far as anyone can tell.';
  }
}
