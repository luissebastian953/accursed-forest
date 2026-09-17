/**
 * Composition root (§4.1): wires sim, render, ui, input and persistence.
 * Nothing below this file knows about anything beside it.
 */

import { Scene, Vector3 } from 'three/webgpu';

import { attachKeys } from '@input/keys';
import { attachPointer } from '@input/pointer';
import { Autosave } from '@persistence/autosave';
import { DirtyChunks, SaveSlot } from '@persistence/chunks';
import { KEY_PREFIX, SaveError } from '@persistence/schema';
import { QuotaError, localStorageAdapter } from '@persistence/storage';
import { MapRig, type GroundRect } from '@render/camera/MapRig';
import { Glow } from '@render/Glow';
import { createPaletteTexture } from '@render/materials/palette';
import { createPaletteMaterial } from '@render/materials/paletteMaterial';
import { MobField } from '@render/mobs/MobField';
import { Picker } from '@render/picking';
import { createRenderer } from '@render/Renderer';
import { Ceremony } from '@render/scene/Ceremony';
import { landHeight } from '@render/scene/chunkField';
import { ChunkManager } from '@render/scene/ChunkManager';
import { Fires } from '@render/scene/Fires';
import { KopdesMesh } from '@render/scene/Kopdes';
import { Lightning } from '@render/scene/Lightning';
import { MOTORCADE_MS, Motorcade } from '@render/scene/Motorcade';
import { HazardRing, RangeRing, SelectionRing } from '@render/scene/Overlays';
import { Palms } from '@render/scene/Palms';
import { Police } from '@render/scene/Police';
import { Rain } from '@render/scene/Rain';
import { Sky } from '@render/scene/Sky';
import { TREES_PER_BLOCK, Timber } from '@render/scene/Timber';
import { WorkSite } from '@render/scene/WorkSite';
import { digestEvents } from '@render/sync';
import { BIOMES } from '@sim/balance/biomes';
import { BANKRUPTCY, ISPO } from '@sim/balance/endings';
import { FIRE } from '@sim/balance/fire';
import { GROWTH } from '@sim/balance/growth';
import { BEETLES } from '@sim/balance/pests';
import { MACRO_PREFIX } from '@sim/balance/society';
import { WORLD } from '@sim/balance/world';
import { settleCost } from '@sim/commands/settleInvestigation';
import {
  ASH_EVENT,
  DROUGHT_EVENT,
  FLOOD_EVENT,
  HAZE_EVENT,
  activeEvent,
  burningBlocks,
  isWildfire,
} from '@sim/fire';
import { createSim, restoreSim, seedFromEstateCode, type Sim } from '@sim/index';
import { estateForestCover } from '@sim/landscape';
import { runOver } from '@sim/run';
import { creditLine, ispoConditions, matureHectares } from '@sim/systems/endings';
import { workedBlocks } from '@sim/systems/mobs';
import type { BlockId, Command } from '@sim/types';
import { formatKg, formatRp } from '@ui/format';
import { AuthorityCards, type CardKind } from '@ui/svelte/authorityCardsState.svelte.ts';
import { BlockPanel } from '@ui/svelte/blockPanelState.svelte.ts';
import { CertificatePanel, YearEndCard } from '@ui/svelte/certificateState.svelte.ts';
import { ControlsHelp } from '@ui/svelte/controlsHelpState.svelte.ts';
import { Epilogue } from '@ui/svelte/epilogueState.svelte.ts';
import { Hud, type EventChip } from '@ui/svelte/hudState.svelte.ts';
import { KopdesShop } from '@ui/svelte/kopdesShopState.svelte.ts';
import { Menu } from '@ui/svelte/menuState.svelte.ts';
import { NewsPanel } from '@ui/svelte/newsPanelState.svelte.ts';
import { NewsTicker } from '@ui/svelte/newsTickerState.svelte.ts';
import {
  START_FADE_MS,
  StartScreen,
  type SaveSummary,
} from '@ui/svelte/startScreenState.svelte.ts';
import { Toasts } from '@ui/svelte/toastsState.svelte.ts';
import { WorkMarkers, type WorkMarker } from '@ui/svelte/workMarkersState.svelte.ts';

import { t } from '../i18n/index.ts';

import { GameLoop } from './loop.ts';
import { FIRE_LOCK_SPEED, TimeControl } from './timeControl.ts';

const SLOT = 'slot0';
/** Start-of-year snapshots kept for the rewind (§7: the last 25). */
const SNAPSHOTS_KEPT = 25;
/** How often the DOM panels re-read the sim. */
const UI_REFRESH_MS = 100;
const SNAPSHOT_KEY = new RegExp(`^${KEY_PREFIX}:save:year:(\\d+)$`);

function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
}

export async function startApp(root: HTMLElement): Promise<() => void> {
  const params = new URLSearchParams(location.search);
  root.style.position = 'relative';
  // The world fills the root; the block panel is an aside laid over its right
  // edge that slides in with a selection (§8 panel 9). Laying it over rather
  // than docking it means the canvas never resizes when it comes and goes;
  // the HUD and ticker shift left by its width instead (`--chrome-right`).
  // Modals mount on the root so they cover both.
  const stage = document.createElement('div');
  stage.className = 'absolute inset-0';
  stage.style.setProperty('--chrome-right', '0px');
  const aside = document.createElement('aside');
  aside.className =
    'aside aside-hidden absolute bottom-0 right-0 top-0 z-10 flex flex-col overflow-hidden border-l-2 border-[#f2e0b0] bg-[#fff6e0]';
  root.append(stage, aside);
  /** The aside slides in from the right with a selection and away without one. */
  const setAsideOpen = (open: boolean): void => {
    aside.classList.toggle('aside-hidden', !open);
    stage.style.setProperty('--chrome-right', open ? 'var(--aside-w)' : '0px');
  };

  // ── Persistence ─────────────────────────────────────────────────────────
  const storage = localStorageAdapter();
  const slot = new SaveSlot({ storage, slot: SLOT, appVersion: __APP_VERSION__ });
  const dirty = new DirtyChunks();

  // ── UI shell (needed before the sim so load errors can be shown) ───────
  const toasts = new Toasts(stage);
  let saveError: string | null = null;
  let saveNote: string | null = null;

  // ── Sim ─────────────────────────────────────────────────────────────────
  let sim: Sim = bootSim();

  function bootSim(): Sim {
    const seedParam = params.get('seed');
    if (seedParam !== null) return freshSim(Number(seedParam) >>> 0);
    if (params.has('fresh') || !slot.exists()) return freshSim(randomSeed());
    try {
      return restoreSim(slot.load());
    } catch (error) {
      const message = error instanceof SaveError ? error.message : String(error);
      toasts.push(`Could not load the save: ${message}. Starting a new estate.`, 'error');
      return freshSim(randomSeed());
    }
  }

  /** A new run: the old run's year snapshots would rewind into someone else's estate. */
  function freshSim(seed: number): Sim {
    clearSnapshots();
    return createSim(seed);
  }

  // ── Year snapshots (§3.8 rewind, §7) ───────────────────────────────────
  function snapshotSlot(year: number): SaveSlot {
    return new SaveSlot({
      storage,
      slot: `year:${year}`,
      appVersion: __APP_VERSION__,
      compressManifest: true,
    });
  }

  /** Years with a snapshot, newest first. */
  function snapshotYears(): number[] {
    const years: number[] = [];
    for (const key of storage.keys()) {
      const match = SNAPSHOT_KEY.exec(key);
      if (match) years.push(Number(match[1]));
    }
    return years.sort((a, b) => b - a);
  }

  function clearSnapshots(after = 0): void {
    for (const year of snapshotYears()) if (year > after) snapshotSlot(year).delete();
  }

  /** Snapshot the start of `year`. On a full disk the oldest snapshots make room. */
  function writeSnapshot(year: number): void {
    const years = snapshotYears();
    for (const old of years.slice(SNAPSHOTS_KEPT - 1)) snapshotSlot(old).delete();
    for (let attempt = 0; attempt < SNAPSHOTS_KEPT; attempt++) {
      try {
        snapshotSlot(year).save(sim.state);
        return;
      } catch (error) {
        snapshotSlot(year).delete();
        const oldest = snapshotYears().at(-1);
        if (!(error instanceof QuotaError) || oldest === undefined) {
          toasts.push(`Could not keep a snapshot of Year ${year}: storage is full.`, 'warn');
          return;
        }
        snapshotSlot(oldest).delete();
      }
    }
  }

  // ── Renderer & scene ────────────────────────────────────────────────────
  const handle = await createRenderer(stage, { forceWebGL: params.has('webgl') });
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
      getFlooded: () => floodedNow(),
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
    kopdes.post,
    ring.group,
    rangeRing.mesh,
    hazardRing.mesh,
    fires.group,
  );

  let picker = new Picker(rig.camera, chunks.group, sim.world);
  /** The land under a world point, exactly as the mesher draws it. */
  const groundAt = (x: number, z: number): number =>
    landHeight(sim.world, (id) => sim.state.blocks.get(id)?.phase ?? 'wild', x, z);
  const police = new Police(material, groundAt);
  const ceremony = new Ceremony(material);
  const rain = new Rain(material);
  const lightning = new Lightning();
  const timber = new Timber(material, groundAt);
  const motorcade = new Motorcade(material, groundAt);
  const workSite = new WorkSite(material, groundAt);
  const spectral = createPaletteMaterial(paletteTexture, uniforms).material;
  spectral.transparent = true;
  spectral.opacity = 0.45;
  spectral.depthWrite = false;
  const mobField = new MobField({
    material,
    spectralMaterial: spectral,
    bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    groundAt,
  });
  const glow = new Glow(handle.renderer, scene, rig.camera);
  scene.add(
    police.group,
    ceremony.group,
    motorcade.group,
    workSite.group,
    rain.mesh,
    lightning.group,
    timber.group,
    mobField.group,
  );
  const visible: GroundRect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  // Edge vignette while anything burns (§8 panel 7).
  const vignette = document.createElement('div');
  vignette.className = 'pointer-events-none absolute inset-0 z-[5] transition-opacity duration-700';
  vignette.style.boxShadow = 'inset 0 0 140px 30px rgba(255, 96, 24, 0.55)';
  vignette.style.opacity = '0';
  stage.appendChild(vignette);

  // ── Time ────────────────────────────────────────────────────────────────
  const time = new TimeControl(params.has('turbo') ? 20 : 1);
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
      // The save outranks the rewind: make room by dropping the oldest snapshots.
      const oldest = snapshotYears().slice(-3);
      if (error instanceof QuotaError && oldest.length > 0) {
        for (const year of oldest) snapshotSlot(year).delete();
        queueMicrotask(() => autosave.saveNow());
        return;
      }
      saveError = error instanceof Error ? error.message : String(error);
      toasts.push(`Autosave failed: ${saveError}`, 'error');
    },
  });

  // ── UI ──────────────────────────────────────────────────────────────────
  const workMarkers = new WorkMarkers(stage);
  const hud = new Hud(stage, {
    setSpeed: (speed) => time.set(speed),
    openMenu: () => {
      menu.show();
      refreshMenu();
    },
    openHelp: () => help.toggle(),
    openCertificate: () => {
      if (certificate.isOpen) certificate.hide();
      else certificate.show(ispoConditions(sim.state, sim.world));
    },
  });

  const shop = new KopdesShop(stage, {
    dispatch: (command) => dispatch(command),
    close: () => closeShop(),
  });

  const panel = new BlockPanel(aside, {
    dispatch: (command) => dispatch(command),
    close: () => select(null),
    openShop: () => openShop(),
    hoverBurn: (blocks) => {
      if (blocks) hazardRing.show(blocks, sim.state, sim.world);
      else hazardRing.hide();
    },
  });

  // ── News and the authorities ────────────────────────────────────────────
  const readKey = (): string => `accursed-forest:news-read:${sim.world.estateCode}`;
  let newsReadTick = loadReadTick();

  function loadReadTick(): number {
    try {
      return Number(localStorage.getItem(readKey()) ?? -1);
    } catch {
      return -1;
    }
  }

  function markNewsRead(): void {
    newsReadTick = sim.state.tick;
    try {
      localStorage.setItem(readKey(), String(newsReadTick));
    } catch {
      // Storage off: read state lasts for the session.
    }
  }

  function unreadWarnings(): number {
    let n = 0;
    for (const item of sim.state.society.news) {
      if (item.tick > newsReadTick && (item.severity === 'warning' || item.severity === 'critical'))
        n += 1;
    }
    return n;
  }

  const ticker = new NewsTicker(stage, { open: () => openNews() });
  const newsStatus = () => ({ tick: sim.state.tick, unread: unreadWarnings() });
  const newsPanel = new NewsPanel(stage, {
    focus: (block) => {
      select(block);
      focusBlock(block);
    },
    close: () => {
      // Looked at: whatever was new is read once the phone goes away.
      markNewsRead();
      newsPanel.hide();
    },
    markRead: () => {
      markNewsRead();
      newsPanel.update(sim.state.society.news, newsStatus());
    },
  });

  function openNews(): void {
    if (shop.isOpen) closeShop();
    newsPanel.show(sim.state.society.news, newsStatus());
  }

  const cards = new AuthorityCards(root, {
    dismiss: () => closeCard(),
    settle: () => {
      const result = dispatch({ type: 'SettleInvestigation' });
      if (result.ok) {
        police.sync(sim.state, sim.world, performance.now());
        closeCard();
      }
    },
  });

  /**
   * A card stopped the clock so it would be read; when it goes, the estate
   * starts running again rather than leaving the player on a paused screen.
   */
  function closeCard(): void {
    cards.hide();
    if (time.speed === 0) time.set(1);
  }

  const certificate = new CertificatePanel(stage, { close: () => certificate.hide() });
  const help = new ControlsHelp(stage, { close: () => help.hide() });
  const yearEnd = new YearEndCard(stage);

  const epilogue = new Epilogue(root, {
    rewind: (year) => rewindTo(year),
    keepPlaying: () => {
      if (dispatch({ type: 'KeepPlaying' }).ok) {
        epilogue.hide();
        toasts.push('Playing on in sandbox. Nothing ends the run from here.');
        time.set(1);
      }
    },
    newEstate: () => switchSim(freshSim(randomSeed())),
  });

  let epilogueTimer: ReturnType<typeof setTimeout> | null = null;

  function showEpilogue(): void {
    if (epilogueTimer !== null) clearTimeout(epilogueTimer);
    epilogueTimer = null;
    const { state } = sim;
    const ending = state.run.ending;
    if (!ending) return;
    const keys: Record<typeof ending, string[]> = {
      clean: ['ispo.clean'],
      dirty: ['ispo.dirty'],
      reboisasi: ['ending.reboisasi'],
      fade: ['ending.fade'],
      bankrupt: ['ending.bankrupt'],
      banned: ['ending.banned'],
      arrested: ['authority.arrested'],
    };
    epilogue.show({
      ending,
      endedAt: state.run.endedAt ?? state.tick,
      estateCode: sim.world.estateCode,
      headline: state.society.news.findLast((n) => keys[ending].includes(n.key)) ?? null,
      stats: state.run.stats,
      cash: state.economy.cash,
      profitTotal: state.run.profitTotal + state.run.yearProfit,
      years: state.run.years,
      forestCover: estateForestCover(state, sim.world),
      matureHectares: matureHectares(state),
      letters: state.society.lettersReceived,
      insolventFor: state.run.insolventFor,
      chronicle: state.run.chronicle,
      rewindYears: snapshotYears(),
    });
    certificate.hide();
    yearEnd.hide();
    time.set(0);
  }

  function rewindTo(year: number): void {
    try {
      const next = restoreSim(snapshotSlot(year).load());
      // The future after this year belongs to the timeline being abandoned.
      clearSnapshots(year);
      switchSim(next);
      autosave.saveNow();
      toasts.push(`Back to the start of Year ${year}. Same seed, same weather ahead.`);
    } catch (error) {
      toasts.push(
        `Could not return to Year ${year}: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }

  function showCard(kind: CardKind): void {
    const { state } = sim;
    const latest = [...state.society.news].reverse();
    const headline =
      latest.find((n) =>
        kind === 'letter'
          ? n.key === 'authority.letter'
          : kind === 'ban'
            ? n.key === 'authority.operatingBan'
            : n.key.startsWith('authority.investigation'),
      ) ?? null;
    const settle = { type: 'SettleInvestigation' } as const;
    cards.show({
      kind,
      tick: state.tick,
      headline,
      until:
        kind === 'investigation'
          ? state.society.investigationUntil
          : kind === 'ban'
            ? state.society.operatingBanUntil
            : null,
      settleCost: kind === 'investigation' ? settleCost(state) : null,
      settleRejection: kind === 'investigation' ? sim.validate(settle) : null,
    });
    // Paperwork stops the clock so it gets read.
    time.set(0);
  }

  const menu = new Menu(root, {
    newGame: (seed) => switchSim(freshSim(seed)),
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
    // One phone at a time.
    if (newsPanel.isOpen) newsPanel.hide();
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
  let forestCover = 0;

  /** Blocks under water in the flood that is running, if any. */
  function floodedNow(): ReadonlySet<BlockId> {
    return new Set(activeEvent(sim.state, FLOOD_EVENT)?.blocks ?? []);
  }

  /** The active-events strip (§8 panel 6): what is happening, and for how long. */
  function eventChips(): EventChip[] {
    const { state } = sim;
    const left = (id: string): number | null => {
      const e = activeEvent(state, id);
      return e ? Math.max(0, e.endsAt - state.tick) : null;
    };
    const chips: EventChip[] = [];
    if (isWildfire(state))
      chips.push({ id: 'wildfire', label: t('events.wildfire'), daysLeft: null, tone: 'fire' });
    if (activeEvent(state, HAZE_EVENT)) {
      chips.push({
        id: 'haze',
        label: isWildfire(state) ? t('events.smoke') : t('events.haze'),
        daysLeft: isWildfire(state) ? null : left(HAZE_EVENT),
        tone: 'smoke',
      });
    }
    if (activeEvent(state, ASH_EVENT))
      chips.push({
        id: 'ash',
        label: t('events.ash'),
        daysLeft: left(ASH_EVENT),
        tone: 'ash',
      });
    if (activeEvent(state, FLOOD_EVENT)) {
      const n = activeEvent(state, FLOOD_EVENT)!.blocks?.length ?? 0;
      chips.push({
        id: 'flood',
        label:
          n === 0
            ? t('events.floodDownstream')
            : n === 1
              ? t('events.floodOne', { n })
              : t('events.floodMany', { n }),
        daysLeft: left(FLOOD_EVENT),
        tone: 'water',
      });
    }
    if (activeEvent(state, DROUGHT_EVENT)) {
      chips.push({
        id: 'drought',
        label: t('events.drought', { n: state.weather.dryStreak }),
        daysLeft: null,
        tone: 'dry',
      });
    }
    const plagued = plaguedCount();
    if (plagued > 0)
      chips.push({
        id: 'plague',
        label:
          plagued === 1
            ? t('events.plagueOne', { n: plagued })
            : t('events.plagueMany', { n: plagued }),
        daysLeft: null,
        tone: 'pest',
      });
    for (const event of state.weather.activeEvents) {
      if (!event.id.startsWith(MACRO_PREFIX)) continue;
      const id = event.id.slice(MACRO_PREFIX.length);
      chips.push({
        id,
        label: t(`events.${id}`),
        daysLeft: Math.max(0, event.endsAt - state.tick),
        tone: 'econ',
      });
    }
    if (state.society.operatingBanUntil > state.tick) {
      chips.push({
        id: 'ban',
        label: t('events.ban'),
        daysLeft: state.society.operatingBanUntil - state.tick,
        tone: 'pest',
      });
    }
    if (state.run.insolventFor > 0 && !runOver(state)) {
      chips.push({
        id: 'insolvent',
        label:
          creditLine(state, sim.world) > 0
            ? t('events.insolventCredit')
            : t('events.insolventNothing'),
        daysLeft: BANKRUPTCY.daysInRed - state.run.insolventFor,
        tone: 'pest',
      });
    }
    if (state.society.investigationUntil > state.tick) {
      chips.push({
        id: 'investigation',
        label: t('events.investigation'),
        daysLeft: state.society.investigationUntil - state.tick,
        tone: 'pest',
      });
    }
    return chips;
  }

  function plaguedCount(): number {
    let n = 0;
    for (const block of sim.state.blocks.values()) if (block.plagued) n += 1;
    return n;
  }

  function refreshHud(): void {
    hud.update({
      cash: sim.state.economy.cash,
      tick: sim.state.tick,
      tbsPrice: sim.state.economy.tbsPrice,
      tbsTrend: priceTrend(),
      regime: sim.state.weather.regime,
      rain: sim.state.weather.rain,
      sky: sim.state.weather.sky,
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
      forestCover,
      events: eventChips(),
      attention: sim.state.society.lettersReceived > 0 ? sim.state.society.attention : null,
      inputIndex: sim.state.economy.inputPriceIndex,
      ispoMet:
        sim.state.tick >= (ISPO.progressFromYear - 1) * GROWTH.daysPerYear
          ? (sim.state.run.years.at(-1)?.conditionsMet ?? 0)
          : null,
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
      if (
        command.type === 'ChopBlock' ||
        command.type === 'PlantBlock' ||
        command.type === 'BurnBlock'
      ) {
        forestCover = estateForestCover(sim.state, sim.world);
      }
      if (
        command.type === 'HarvestBlock' ||
        command.type === 'RemovePalm' ||
        command.type === 'TrenchPalm' ||
        command.type === 'ReplantBlock'
      ) {
        palmsDirty = true;
      }
      if (command.type === 'ChopBlock' || command.type === 'BurnBlock') {
        // The crew and their scaffolding are on the block before the next tick.
        mobField.syncSim(sim.state);
        workSite.sync(sim.state, sim.world);
      }
      if (command.type === 'BurnBlock') {
        syncFireState();
        hazardRing.hide();
        toasts.push(
          isWildfire(sim.state)
            ? 'Fire pressure over the line; this is a wildfire now.'
            : `${blockName(command.block)} burning; speed capped at ${FIRE_LOCK_SPEED}×.`,
          isWildfire(sim.state) ? 'error' : 'warn',
        );
      }
      if (command.type === 'HireWorker' || command.type === 'DismissWorker') {
        mobField.syncSim(sim.state);
        kopdes.sync(sim.state, sim.world);
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
      setAsideOpen(false);
      return;
    }
    ring.show(sim.state, sim.world, block, performance.now());
    panel.show(sim, block);
    setAsideOpen(true);
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
    police.sync(sim.state, sim.world, performance.now());
    ceremony.sync(sim.state, sim.world, performance.now());
    motorcade.sync(sim.state, sim.world);
    cards.hide();
    newsPanel.hide();
    epilogue.hide();
    certificate.hide();
    yearEnd.hide();
    newsReadTick = Math.min(loadReadTick(), sim.state.tick);
    picker = new Picker(rig.camera, chunks.group, sim.world);
    mobField.clear();
    mobField.syncSim(sim.state);
    workSite.sync(sim.state, sim.world);
    palmsDirty = true;
    animateBlocks = new Set();
    kopdes.sync(sim.state, sim.world);
    syncFireState();
    forestCover = estateForestCover(sim.state, sim.world);
    lastFlooded = new Set();
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
      toasts.push(`Year ${d.yearPassed + 1} begins; ${regimeLine(sim.state.weather.regime)}`);
    for (const block of d.ripeBlocks) toasts.push(`Ripe: ${blockName(block)} is ready to harvest.`);
    for (const sale of d.sold) {
      toasts.push(
        `Sold ${formatKg(sale.kilograms)} of TBS at ${formatRp(sale.price)}/kg: ${formatRp(sale.revenue)}.`,
      );
    }
    for (const t of d.timber)
      toasts.push(`Timber from ${blockName(t.block)} sold for ${formatRp(t.revenue)}.`);
    if (d.kopdesUpgraded !== null) {
      toasts.push(`Kopdes upgraded to level ${d.kopdesUpgraded}.`);
      if (shop.isOpen) rangeRing.show(sim.state, sim.world);
    }
    if (d.wildfireStarted)
      toasts.push('Wildfire. The fire is no longer yours; it burns until the rain comes.', 'error');
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
      toasts.push(`${blockName(burnedClear[0]!)} burned clear; the ash will feed it for a season.`);
    else if (burnedClear.length > 1) toasts.push(`${burnedClear.length} blocks burned clear.`);

    // The authorities.
    if (d.investigationOpened || d.investigationEnded || d.arrested)
      police.sync(sim.state, sim.world, performance.now());
    if (d.operatingBanLifted) toasts.push('The operating licence is restored. Crews may return.');

    // The year, and how the run ends (§3.8).
    if (d.yearClosed && !runOver(sim.state)) {
      writeSnapshot(d.yearClosed.year + 1);
      const years = sim.state.run.years;
      yearEnd.show({
        summary: d.yearClosed,
        previous: years.at(-2) ?? null,
        conditionsMet:
          d.yearClosed.year + 1 >= ISPO.progressFromYear ? d.yearClosed.conditionsMet : null,
      });
    }
    if (d.certified && sim.state.kopdes) {
      // The win: the Ministry's banner and fireworks, and the President's
      // motorcade up to the Kopdes door. The epilogue opens once he is there.
      ceremony.sync(sim.state, sim.world, performance.now(), true);
      motorcade.arrive(sim.state, sim.world, performance.now());
      focusBlock(sim.state.kopdes.blockId);
      toasts.push('The Ministry has sent a banner. ISPO certified.');
      toasts.push('A motorcade is coming up the road. The President is here.');
      time.set(0);
      const run = sim;
      epilogueTimer = setTimeout(() => {
        if (sim === run && runOver(sim.state)) showEpilogue();
      }, MOTORCADE_MS);
    } else if (d.runEnded) showEpilogue();
    else if (d.operatingBanned) showCard('ban');
    else if (d.investigationOpened) showCard('investigation');
    else if (d.letter) showCard('letter');

    // Economic and government news that has no card or toast of its own.
    for (const item of d.news) {
      if (item.lane === 'natural' || item.key.startsWith('authority.')) continue;
      if (item.severity === 'info') continue;

      const match = sim.state.society.news.findLast(
        (n) => n.key === item.key && n.tick === sim.state.tick,
      );
      if (match)
        toasts.push(
          `📰 ${match.title}`,
          item.severity === 'warning' || item.severity === 'critical' ? 'warn' : 'info',
        );
    }

    // Weather news.
    for (const started of d.weatherStarted)
      toasts.push(
        weatherStartLine(started.id, started.days),
        started.id === 'haze' ? 'warn' : 'error',
      );
    for (const ended of d.weatherEnded) {
      const line = weatherEndLine(ended);
      if (line) toasts.push(line);
    }
    if (d.flooded.size > 0) {
      for (const block of d.flooded) chunks.markBlockDirty(block);
    }
    if (d.weatherEnded.includes(FLOOD_EVENT)) {
      // The water goes down: every block that was under it needs its ground back.
      for (const block of lastFlooded) chunks.markBlockDirty(block);
    }
    lastFlooded = floodedNow();
    for (const slide of d.landslides) {
      toasts.push(
        slide.palmsLost > 0
          ? `Landslide on ${blockName(slide.block)}; ${slide.palmsLost} palms buried. Bare slopes do not hold in the rains.`
          : `Landslide on ${blockName(slide.block)}. Bare slopes do not hold in the rains.`,
        'error',
      );
    }
    if (d.ashSettled) toasts.push('The ash has settled. It will feed the soil for a season.');
    if (d.sparks.size > 0) toasts.push('Drought: a spark caught a debris pile.', 'error');
    for (const bolt of d.lightning) {
      lightning.strike(sim.state, sim.world, bolt.block, performance.now());
      sky.flash(performance.now());
      if (bolt.ignited) {
        toasts.push(`Lightning has set ${blockName(bolt.block)} alight.`, 'error');
        chunks.markBlockDirty(bolt.block);
      }
    }
    if (d.lightning.some((b) => b.ignited)) syncFireState();

    // Trees down, thieves, and the people on the estate.
    fellChoppedTrees(d.felled);
    for (const theft of d.stolen) {
      toasts.push(
        `Thieves took ${formatKg(theft.kilograms)} of fruit from ${blockName(theft.block)}. A security guard would have stopped them.`,
        'error',
      );
    }
    if (d.cashStolen > 0) {
      toasts.push(
        `${formatRp(d.cashStolen)} is missing from the Kopdes. Staff blame a pig that stood up.`,
        'error',
      );
    }
    if (d.thiefCaught) toasts.push('Security saw off a fruit thief.');
    mobField.syncSim(sim.state);
    workSite.sync(sim.state, sim.world);
    const drowned = d.palmsDied.filter((p) => p.cause === 'flood').length;
    if (drowned > 0)
      toasts.push(
        `${drowned} young palm${drowned === 1 ? '' : 's'} drowned in the flood.`,
        'error',
      );
    const ashed = d.palmsDied.filter((p) => p.cause === 'ash').length;
    if (ashed > 0)
      toasts.push(`${ashed} young palm${ashed === 1 ? '' : 's'} lost to the ash.`, 'error');
    forestCover = estateForestCover(sim.state, sim.world);

    // Pest news, aggregated per tick.
    for (const [block, count] of d.palmSick) {
      toasts.push(
        `Ganoderma: ${count} palm${count === 1 ? '' : 's'} on ${blockName(block)} turned visibly sick. Remove them before it spreads.`,
        'warn',
      );
    }
    const byBeetles = d.palmsDied.filter((p) => p.cause === 'beetles').length;
    const byGanoderma = d.palmsDied.filter((p) => p.cause === 'ganoderma').length;
    if (byBeetles > 0) {
      toasts.push(
        `${byBeetles} young palm${byBeetles === 1 ? '' : 's'} killed by beetles; sanitize the debris.`,
        'error',
      );
    }
    if (byGanoderma > 0) {
      toasts.push(
        `${byGanoderma} palm${byGanoderma === 1 ? '' : 's'} died of Ganoderma. The stumps are still infectious.`,
        'error',
      );
    }
    for (const block of d.plagueStarted)
      toasts.push(`Plague on ${blockName(block)}; pests are out of hand there.`, 'error');
    for (const block of d.plagueEnded)
      toasts.push(`The plague on ${blockName(block)} has been pushed back.`);
    for (const r of d.replanted)
      toasts.push(`${r.count} gap${r.count === 1 ? '' : 's'} replanted on ${blockName(r.block)}.`);

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

  let lastFlooded: ReadonlySet<BlockId> = new Set();

  /** Smoke and ash for the sky: your own wildfire is thicker than regional haze. */
  function atmosphere(): { smoke: number; ash: number } {
    const { state } = sim;
    const smoke = isWildfire(state) ? 1 : activeEvent(state, HAZE_EVENT) ? 0.6 : 0;
    return { smoke, ash: activeEvent(state, ASH_EVENT) ? 1 : 0 };
  }

  let lastUiMs = -1;

  /**
   * A forest block gives up a tree at each quarter of the chop, and whatever
   * is left when the block clears; a block that clears while unwatched (a
   * loaded save, a 50× skip) just drops what remains.
   */
  const treesFelled = new Map<BlockId, number>();
  function fellChoppedTrees(cleared: ReadonlySet<BlockId>): void {
    const now = performance.now();
    for (const block of sim.state.blocks.values()) {
      if (block.phase !== 'clearing' || !BIOMES[block.biome].forestCover) continue;
      const due = Math.min(TREES_PER_BLOCK - 1, Math.floor(block.clearProgress * TREES_PER_BLOCK));
      const done = treesFelled.get(block.id) ?? 0;
      for (let i = done; i < due; i++) timber.fell(sim.world, block.id, now + (i - done) * 600, i);
      if (due > done) treesFelled.set(block.id, due);
    }
    for (const block of cleared) {
      timber.fellAll(sim.world, block, now, treesFelled.get(block) ?? 0);
      treesFelled.delete(block);
    }
  }

  /** Head-room above the work site's pillars for the progress ring. */
  const MARKER_LIFT = 7;
  const markerPoint = new Vector3();
  /** A progress ring over every block a crew is working, projected each frame. */
  function syncWorkMarkers(): void {
    const working = workedBlocks(sim.state);
    if (working.size === 0) {
      workMarkers.update([]);
      return;
    }
    const side = WORLD.blockSide;
    const width = handle.canvas.clientWidth;
    const height = handle.canvas.clientHeight;
    rig.camera.updateMatrixWorld();
    const items: WorkMarker[] = [];
    for (const id of working) {
      const block = sim.state.blocks.get(id);
      if (!block) continue;
      const [bx, by] = sim.world.toXY(id);
      const cx = bx * side + side / 2;
      const cz = by * side + side / 2;
      markerPoint.set(cx, groundAt(cx, cz) + MARKER_LIFT, cz).project(rig.camera);
      items.push({
        id,
        x: ((markerPoint.x + 1) / 2) * width,
        y: ((1 - markerPoint.y) / 2) * height,
        progress: block.clearProgress,
        kind: block.burning ? 'burn' : 'chop',
      });
    }
    workMarkers.update(items);
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
    police.update(nowMs);
    ceremony.update(nowMs);
    motorcade.update(nowMs);
    ticker.update(sim.state.society.news, unreadWarnings());
    newsPanel.update(sim.state.society.news, newsStatus());
    fires.update(nowMs);
    sky.update(sim.state.weather, uniforms, atmosphere(), dt, nowMs);
    rain.update(dt, sim.state.weather.rain, visible, time.speed > 0);
    lightning.update(nowMs);
    timber.update(nowMs);
    mobField.update(dt, time.secondsPerTick);
    syncWorkMarkers();

    // The panels are DOM: ten refreshes a second is plenty, and it leaves the
    // frame budget to the world. (Every frame cost the sim a third of its
    // ticks at 20x on the software renderer.)
    if (nowMs - lastUiMs >= UI_REFRESH_MS) {
      lastUiMs = nowMs;
      refreshHud();
      if (panel.selected !== null) panel.refresh();
      if (shop.isOpen) shop.refresh();
    }
    // Bloom only while something glows: it costs a few full-screen passes.
    if (fires.burning) glow.render();
    else handle.render(scene, rig.camera);
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
    openNews: () => {
      if (newsPanel.isOpen) newsPanel.hide();
      else openNews();
    },
    toggleHelp: () => help.toggle(),
    openShop: () => {
      if (shop.isOpen) closeShop();
      else openShop();
    },
    escape: () => {
      if (epilogue.isOpen) return;
      if (cards.showing) closeCard();
      else if (certificate.isOpen) certificate.hide();
      else if (help.isOpen) help.hide();
      else if (newsPanel.isOpen) newsPanel.hide();
      else if (menu.isOpen) menu.hide();
      else if (shop.isOpen) closeShop();
      else select(null);
    },
  });

  const resize = (): void => {
    const { width, height } = handle.resize();
    rig.setAspect(width / height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  const detachAutosave = autosave.attach();

  kopdes.sync(sim.state, sim.world);
  syncFireState();
  forestCover = estateForestCover(sim.state, sim.world);
  select(null);
  focusStart();
  refreshHud();
  refreshMenu();
  police.sync(sim.state, sim.world, performance.now());
  ceremony.sync(sim.state, sim.world, performance.now());
  motorcade.sync(sim.state, sim.world);
  workSite.sync(sim.state, sim.world);
  if (runOver(sim.state)) showEpilogue();
  time.subscribe(() => refreshHud());
  // `?debug` exposes the running sim for the browser suite and for poking at
  // events by hand. Single-player and local, so this is a console, not a cheat.
  if (params.has('debug')) {
    (window as unknown as { __sawit: unknown }).__sawit = {
      sim: () => sim,
      redrawTerrain: (blocks: BlockId[]) => {
        for (const block of blocks) chunks.markBlockDirty(block);
      },
      redrawPalms: () => {
        palmsDirty = true;
      },
      timber,
      mobField,
      police,
      motorcade,
      showEpilogue,
    };
  }

  loop.start();

  // The title screen, over the estate pulled back to a backdrop. Dev and
  // test URLs that name a world (`?seed`, `?fresh`) go straight in.
  const welcome = () => toasts.push(t('start.welcome', { code: sim.world.estateCode }));
  // A run that is already over reopens on its epilogue, not the title.
  const titleScreen = !params.has('seed') && !params.has('fresh') && !runOver(sim.state);
  /** What the welcome-back card says about the loaded save. */
  function saveSummary(): SaveSummary {
    const { state } = sim;
    let savedAt: string | null = null;
    const manifest = storage.get(slot.manifestKey);
    if (manifest) {
      try {
        savedAt = (JSON.parse(manifest) as { savedAt?: string }).savedAt ?? null;
      } catch {
        savedAt = null;
      }
    }
    let planted = 0;
    let beetleBlocks = 0;
    for (const block of state.blocks.values()) {
      if (block.phase === 'planted') planted += 1;
      if (block.phase === 'planted' && block.beetles > BEETLES.seedPopulation) beetleBlocks += 1;
    }
    const chips: SaveSummary['chips'] = eventChips().map((c) => ({
      icon: c.tone === 'water' ? 'rain' : c.tone === 'fire' ? 'fire' : 'haze',
      label:
        c.daysLeft === null ? c.label : t('events.withDays', { label: c.label, n: c.daysLeft }),
      tone: c.tone,
    }));
    if (beetleBlocks > 0)
      chips.push({
        icon: 'beetle',
        label:
          beetleBlocks === 1
            ? t('events.beetlesOne', { n: beetleBlocks })
            : t('events.beetlesMany', { n: beetleBlocks }),
        tone: 'pest',
      });
    const met = ispoConditions(state, sim.world).filter((c) => c.met).length;
    chips.push({ icon: 'certificate-ispo', label: t('events.ispo', { met }), tone: 'plain' });
    return {
      code: sim.world.estateCode,
      savedAt,
      year: Math.floor(state.tick / GROWTH.daysPerYear) + 1,
      day: (state.tick % GROWTH.daysPerYear) + 1,
      plantedHectares: planted,
      cash: state.economy.cash,
      chips,
    };
  }
  const startScreen = new StartScreen(root, {
    start: () => beginPlay(),
    resume: () => beginPlay(),
    newEstate: () => {
      switchSim(freshSim(randomSeed()));
      beginPlay();
    },
    loadOther: () => menu.toggle(),
    useCode: (code) => {
      const seed = seedFromEstateCode(code);
      if (seed === null) return t('start.codeError');
      switchSim(freshSim(seed));
      beginPlay();
      return null;
    },
    howToPlay: () => help.toggle(),
    settings: () => menu.toggle(),
  });
  /** Fade the title out and pull the camera in on the estate; the clock starts with it. */
  function beginPlay(): void {
    startScreen.dismiss();
    hud.setHidden(false);
    ticker.setHidden(false);
    const now = performance.now();
    if (sim.state.kopdes) focusBlock(sim.state.kopdes.blockId);
    rig.zoomTo(1.5, now, START_FADE_MS + 900);
    time.set(1);
    welcome();
  }
  if (titleScreen) {
    time.set(0);
    rig.setZoom(0.62);
    // Nothing but the estate behind the title: the bar and the ticker slide off.
    hud.setHidden(true);
    ticker.setHidden(true);
    select(null);
    startScreen.show({
      estateCode: sim.world.estateCode,
      save: slot.exists() ? saveSummary() : null,
      build: t('start.build', {
        version: __APP_VERSION__,
        backend: handle.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2',
      }),
    });
  } else if (!slot.exists()) {
    welcome();
  }

  return () => {
    if (epilogueTimer !== null) clearTimeout(epilogueTimer);
    loop.stop();
    detachAutosave();
    detachKeys();
    detachPointer();
    observer.disconnect();
    hud.dispose();
    workMarkers.dispose();
    panel.dispose();
    shop.dispose();
    menu.dispose();
    toasts.dispose();
    ticker.dispose();
    newsPanel.dispose();
    cards.dispose();
    epilogue.dispose();
    startScreen.dispose();
    certificate.dispose();
    help.dispose();
    yearEnd.dispose();
    vignette.remove();
    chunks.dispose();
    palms.dispose();
    kopdes.dispose();
    ring.dispose();
    rangeRing.dispose();
    hazardRing.dispose();
    fires.dispose();
    police.dispose();
    ceremony.dispose();
    motorcade.dispose();
    workSite.dispose();
    rain.dispose();
    lightning.dispose();
    timber.dispose();
    mobField.dispose();
    spectral.dispose();
    glow.dispose();
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

function weatherStartLine(id: string, days: number): string {
  switch (id) {
    case 'haze':
      return `Haze has drifted over the province; less sun and lower prices for about ${days} days.`;
    case 'ash':
      return `Ash is falling from a distant eruption. Harvest is halted for about ${days} days.`;
    case 'flood':
      return `The river is up. Low ground by the water is flooding for about ${days} days.`;
    case 'drought':
      return 'Drought. Unirrigated land is drying out, and debris piles will catch.';
    default:
      return `${id} has begun.`;
  }
}

function weatherEndLine(id: string): string | null {
  switch (id) {
    case 'haze':
      return 'The haze has cleared.';
    case 'flood':
      return 'The flood water has gone down.';
    case 'drought':
      return 'The rain has come back. The drought is over.';
    default:
      return null;
  }
}
