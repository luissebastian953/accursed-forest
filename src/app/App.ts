import { Scene, Vector3 } from 'three/webgpu';

import { Audio } from '@audio/Audio';
import { loadAudioSettings, saveAudioSettings } from '@audio/settings';
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
import { Clouds } from '@render/scene/Clouds';
import { Coins } from '@render/scene/Coins';
import { Excavator } from '@render/scene/Excavator';
import { Fires } from '@render/scene/Fires';
import { KopdesMesh } from '@render/scene/Kopdes';
import { Lightning } from '@render/scene/Lightning';
import { MOTORCADE_MS, Motorcade } from '@render/scene/Motorcade';
import { HazardRing, RangeRing, SelectionRing } from '@render/scene/Overlays';
import { Palms } from '@render/scene/Palms';
import { Police } from '@render/scene/Police';
import { Rain } from '@render/scene/Rain';
import { Sky } from '@render/scene/Sky';
import { SparkleBurst, Sparkles, type SparklePoint } from '@render/scene/Sparkles';
import { TREES_PER_BLOCK, Timber } from '@render/scene/Timber';
import { Wisps, type WispPoint } from '@render/scene/Wisps';
import { WorkSite } from '@render/scene/WorkSite';
import { digestEvents } from '@render/sync';
import { BIOMES } from '@sim/balance/biomes';
import { BANKRUPTCY, ISPO } from '@sim/balance/endings';
import { EXCAVATION } from '@sim/balance/events';
import { FIRE } from '@sim/balance/fire';
import { GROWTH } from '@sim/balance/growth';
import { BABI_NGEPET, SHINY } from '@sim/balance/mobs';
import { BEETLES } from '@sim/balance/pests';
import { SKY } from '@sim/balance/seasons';
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
import { blockLabel } from '@sim/labels';
import { estateForestCover } from '@sim/landscape';
import { runOver } from '@sim/run';
import { creditLine, ispoConditions, matureHectares, ISPO_CONDITIONS } from '@sim/systems/endings';
import { workedBlocks } from '@sim/systems/mobs';
import { ganodermaCounts } from '@sim/systems/pest';
import type { BlockId, Command } from '@sim/types';
import { formatKg, formatRp } from '@ui/format';
import { AuthorityCards, type CardKind } from '@ui/svelte/authorityCardsState.svelte.ts';
import { BlockPanel } from '@ui/svelte/blockPanelState.svelte.ts';
import { CertificatePanel, YearEndCard } from '@ui/svelte/certificateState.svelte.ts';
import { ControlsHelp } from '@ui/svelte/controlsHelpState.svelte.ts';
import { Epilogue } from '@ui/svelte/epilogueState.svelte.ts';
import { HudMarkers, type HudMarker } from '@ui/svelte/hudMarkersState.svelte.ts';
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
import { FIRE_LOCK_SPEED, speedNeedsKopdes, TimeControl, type Speed } from './timeControl.ts';

const SLOT = 'slot0';
/** Start-of-year snapshots kept for the rewind (GDD 7: the last 25). */
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
  // edge that slides in with a selection (GDD 8 panel 9). Laying it over rather
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

  // ── Sound ───────────────────────────────────────────────────────────────
  // The context cannot start until the player has clicked something, so the
  // first gesture anywhere on the page opens it; after that the calls below
  // are cheap no-ops that keep a suspended context awake.
  const audio = new Audio();

  audio.setSettings(loadAudioSettings());

  const unlockAudio = (): void => audio.unlock();

  root.addEventListener('pointerdown', unlockAudio, { passive: true });
  root.addEventListener('keydown', unlockAudio, { passive: true });

  // Every button in the UI taps; a locked one thuds. Disabled buttons never
  // fire click, but Chromium still delivers pointerdown to them, which is
  // the one place this can be heard from.
  const uiPress = (event: PointerEvent): void => {
    const button = (event.target as Element | null)?.closest('button');

    if (!button) return;

    if (button.disabled) audio.play('ui-button-denied');
    // A tap on the handset's own screen is a tap on glass, not on a button
    // in front of the player: the shop and the news feed stay quiet.
    else if (button.classList.contains('btn') && !button.closest('[data-phone]')) {
      audio.play('ui-button-press');
    }
  };

  root.addEventListener('pointerdown', uiPress, { capture: true, passive: true });

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
  function freshSim(seed: number, name = ''): Sim {
    clearSnapshots();
    return createSim(seed, { name });
  }

  // ── Year snapshots (GDD 3.8 rewind, GDD 7) ───────────────────────────────────
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
      getPalms: () => sim.state.palms,
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
    rangeRing.group,
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
  const coins = new Coins(material);
  const lightning = new Lightning();
  const timber = new Timber(material, groundAt);
  const motorcade = new Motorcade(material, groundAt);
  const excavator = new Excavator(material, groundAt);
  const workSite = new WorkSite(material, groundAt);
  const spectral = createPaletteMaterial(paletteTexture, uniforms).material;

  spectral.transparent = true;
  spectral.opacity = 0.45;
  spectral.depthWrite = false;

  // The glints live on the see-through material, like the ghost.
  const sparkles = new Sparkles(spectral);
  const sparkleBurst = new SparkleBurst(spectral);
  const wisps = new Wisps(spectral);
  const clouds = new Clouds(spectral);
  const mobField = new MobField({
    material,
    spectralMaterial: spectral,
    bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 },
    groundAt,
  });
  const glow = new Glow(handle.renderer, scene, rig.camera);

  scene.add(
    coins.mesh,
    sparkles.mesh,
    sparkleBurst.mesh,
    wisps.mesh,
    clouds.mesh,
    police.group,
    ceremony.group,
    motorcade.group,
    excavator.group,
    workSite.group,
    rain.mesh,
    lightning.group,
    timber.group,
    mobField.group,
  );

  const visible: GroundRect = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  // Edge vignette while anything burns (GDD 8 panel 7).
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
  const hudMarkers = new HudMarkers(stage, { select: (block) => select(block) });
  const hud = new Hud(stage, {
    setSpeed: (speed) => requestSpeed(speed),
    setSound: (on) => setSound(on),
    openMenu: () => {
      menu.show();
      refreshMenu();
    },
    openHelp: () => help.toggle(),
    openCertificate: () => {
      if (certificate.isOpen) certificate.hide();
      else {
        // The Ministry looks at the close of each year (GDD 3.8).
        const dayOfYear = sim.state.tick % GROWTH.daysPerYear;

        certificate.show({
          conditions: ispoConditions(sim.state, sim.world),
          daysToCheck: GROWTH.daysPerYear - dayOfYear,
          checkDay: sim.state.tick + (GROWTH.daysPerYear - dayOfYear),
        });
      }
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
        police.sync(sim.state, sim.world, worldNow());
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
      redemption: ['ending.redemption', 'ending.reboisasi'],
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

  /** Sound on or off, from wherever it was asked for; remembered for next time. */
  function setSound(on: boolean): void {
    audio.setSettings({ muted: !on });
    saveAudioSettings(audio.getSettings());
    refreshMenu();
    refreshHud();
  }

  const menu = new Menu(root, {
    newGame: (seed, name) => {
      switchSim(freshSim(seed, name));
      // Started from the title card: the estate is made, so go and play it.
      if (startScreen.isOpen) beginPlay();
    },
    setSound: (on) => setSound(on),
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

  /**
   * Whether an estate is in play. False behind the title screen, where there
   * is nothing to save and nothing a new estate would replace.
   */
  let playing = false;

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
      estateName: sim.state.estateName,
      inPlay: playing,
      hasSave: slot.exists(),
      lastSavedAt,
      saveError,
      sound: !audio.getSettings().muted,
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

  /** The active-events strip (GDD 8 panel 6): what is happening, and for how long. */
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

  /**
   * Every road to the clock, the buttons and the number keys alike, goes
   * through here: 50x stays shut until the Kopdes is big enough for it.
   */
  function requestSpeed(speed: Speed): void {
    if (speedNeedsKopdes(speed, sim.state.kopdes?.level ?? 0)) return;
    time.set(speed);
  }

  /** How long the shower takes to arrive, and to go when the sky clears. */
  const RAIN_FADE_IN = 3;
  const RAIN_FADE_OUT = 4;
  /** How long the sky must stay dry before the shower is treated as over. */
  const RAIN_HOLD = 2.5;
  /** The fire comes up slowly and goes out slowly: it is a state, not a hit. */
  const FIRE_FADE_IN = 1.6;
  const FIRE_FADE_OUT = 2.2;
  /**
   * A bolt this far from where the camera is looking, in blocks, is "far":
   * darker, longer, and arriving after the flash the way sound does.
   */
  const THUNDER_NEAR_BLOCKS = 9;

  /**
   * Endings the epilogue frames as a win: certified either way, the forest
   * back, or the slope put right. The rest, including the estate simply
   * fading out, get the drone.
   */
  const WON: ReadonlySet<string> = new Set(['clean', 'dirty', 'reboisasi', 'redemption']);

  /** Real seconds the sky has been dry; a shower is not over until it holds. */
  let rainDryFor = 0;

  /**
   * The weather's own noise. Rain fades in when the sky turns and away when
   * it clears, riding the day's rain so a storm is heavier than a shower.
   *
   * The sky flips between rain and cloudy on neighbouring days, and at 50x a
   * day is a fifth of a second, so a shower that stopped on every dry day
   * would stutter. It holds through the gaps and only goes when they last.
   */
  function syncWeatherAudio(dtSeconds: number): void {
    const { sky, rain: wetness } = sim.state.weather;

    if (sky === 'rain' || sky === 'storm') {
      rainDryFor = 0;
      audio.startLoop('rain-light', RAIN_FADE_IN);

      const over = (wetness - SKY.rainAbove) / (1 - SKY.rainAbove);

      // Rain is weather, not an event: it sits under the estate's own noises.
      audio.setLoopLevel('rain-light', 0.3 + 0.28 * Math.max(0, Math.min(1, over)));
      return;
    }

    rainDryFor += dtSeconds;
    if (rainDryFor >= RAIN_HOLD) audio.stopLoop('rain-light', RAIN_FADE_OUT);
  }

  /**
   * Fire on the estate, under everything else. It is the loudest thing that
   * can happen and the one the player can least afford to tune out, so it
   * sits low and leans on the vignette and the clock lock to carry the alarm.
   */
  function syncFireAudio(): void {
    if (burningCount > 0) {
      audio.startLoop('fire-crackle', FIRE_FADE_IN);
      // A little more with every block alight, and never much.
      audio.setLoopLevel('fire-crackle', Math.min(0.34, 0.16 + burningCount * 0.03));
    } else {
      audio.stopLoop('fire-crackle', FIRE_FADE_OUT);
    }
  }

  /** Thunder for a bolt, near or far by where it landed. */
  function thunderFor(block: BlockId): void {
    const [bx, by] = sim.world.toXY(block);
    const side = WORLD.blockSide;
    const from = rig.target;
    const blocks = Math.hypot(bx * side + side / 2 - from.x, by * side + side / 2 - from.z) / side;

    if (blocks <= THUNDER_NEAR_BLOCKS) {
      audio.play('thunder-near');
      return;
    }

    // Sound lags light: a bolt across the estate is heard a moment after it
    // is seen, and the further off the longer the wait.
    const far = Math.min(1, (blocks - THUNDER_NEAR_BLOCKS) / 20);

    audio.play('thunder-far', performance.now(), 0.3 + far * 2.2);
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
      kopdesLevel: sim.state.kopdes?.level ?? 0,
      estateCode: sim.world.estateCode,
      sound: !audio.getSettings().muted,
      estateName: sim.state.estateName,
      saveNote,
      saveError,
      firePressure: sim.state.society.firePressure,
      fireThreshold: FIRE.wildfireThreshold,
      burningCount,
      wildfire: isWildfire(sim.state),
      forestCover,
      events: eventChips(),
      attention: watchedByAuthorities() ? sim.state.society.attention : null,
      inputIndex: sim.state.economy.inputPriceIndex,
      ispoMet:
        sim.state.tick >= (ISPO.progressFromYear - 1) * GROWTH.daysPerYear ? ispoMetNow() : null,
      ispoTotal: ISPO_CONDITIONS,
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
    const cashBefore = sim.state.economy.cash;
    const result = sim.dispatch(command);

    if (!result.ok) audio.play('ui-button-denied');

    if (result.ok) {
      ispoCount = null;

      // Money leaving on the player's own order. Coming in is the tick's
      // business (sales), except the tap, which pays with a burst of its own.
      const cashAfter = sim.state.economy.cash;

      if (cashAfter < cashBefore) audio.play('cash-out');
      else if (cashAfter > cashBefore && command.type !== 'TapMob') audio.play('cash-in');

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

      // The new building and its glints belong to the click, not to the tick
      // that follows it: at 1x that was a second of nothing happening.
      if (command.type === 'UpgradeKopdes') {
        kopdes.sync(sim.state, sim.world);
        cheerKopdes();
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

      if (command.type === 'TapMob') {
        const caught = sim.state.mobs.find((m) => m.id === command.mob);

        toasts.push(
          caught?.species === 'babiNgepet'
            ? t('mobs.babiNgepet', { amount: formatRp(BABI_NGEPET.caughtDrop) })
            : t('mobs.golden', { amount: formatRp(SHINY.reward) }),
        );
      }

      if (command.type === 'ChopBlock' || command.type === 'BurnBlock') {
        // The crew and their scaffolding are on the block before the next tick.
        mobField.syncSim(sim.state);
        workSite.sync(sim.state, sim.world);
        excavator.sync(sim.state, sim.world, worldNow());
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

      // The ring is the cursor, not the world: it keeps wall time, so it
      // still pops in when a paused player clicks a block.
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
    police.sync(sim.state, sim.world, worldNow());
    ceremony.sync(sim.state, sim.world, worldNow());
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
    excavator.sync(sim.state, sim.world, worldNow());
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

  /**
   * Whether the attention gauge is worth a place in the bar. It arrives with
   * the first letter and stays while anything is open: a meter above zero, a
   * letter, a case or a suspension. An estate with a clean sheet loses it
   * again rather than carrying a permanent zero.
   */
  function watchedByAuthorities(): boolean {
    const s = sim.state.society;

    if (s.lettersReceived === 0) return false;
    return (
      s.attention > 0 ||
      s.warningLevel > 0 ||
      s.investigationUntil > sim.state.tick ||
      s.operatingBanUntil > sim.state.tick
    );
  }

  /**
   * How many conditions are met today, which is what the certificate panel
   * shows. The bar used to show last year's audited count instead, so the
   * two disagreed for up to a year at a time. Worked out once a day, because
   * it walks every block, and again whenever a command changes something.
   */
  let ispoCount: { tick: number; met: number } | null = null;

  function ispoMetNow(): number {
    if (ispoCount === null || ispoCount.tick !== sim.state.tick) {
      ispoCount = {
        tick: sim.state.tick,
        met: ispoConditions(sim.state, sim.world).filter((c) => c.met).length,
      };
    }

    return ispoCount.met;
  }

  function blockName(block: BlockId): string {
    return `block ${blockLabel(sim.world, block)}`;
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
    if (d.sold.length > 0 || d.timber.length > 0) audio.play('cash-in');

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

    if (d.investigationDropped) {
      police.sync(sim.state, sim.world, worldNow());
      toasts.push('The police file is closed. Nothing on the estate is drawing attention now.');
    }

    if (d.reforestationCredit) {
      const { banDaysLeft } = d.reforestationCredit;

      toasts.push(
        banDaysLeft > 0
          ? `Reforestation noted. Half the suspicion lifts, and the suspension is down to ${banDaysLeft} days.`
          : 'Reforestation noted. Half the suspicion against the estate lifts.',
      );
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
      police.sync(sim.state, sim.world, worldNow());
    if (d.operatingBanLifted) toasts.push('The operating licence is restored. Crews may return.');

    // The year, and how the run ends (GDD 3.8).
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
      ceremony.sync(sim.state, sim.world, worldNow(), true);
      motorcade.arrive(sim.state, sim.world, worldNow());
      focusBlock(sim.state.kopdes.blockId);
      audio.play('win');
      toasts.push('The Ministry has sent a banner. ISPO certified.');
      toasts.push('A motorcade is coming up the road. The President is here.');
      time.set(0);

      const run = sim;

      epilogueTimer = setTimeout(() => {
        if (sim === run && runOver(sim.state)) showEpilogue();
      }, MOTORCADE_MS);
    } else if (d.runEnded) {
      // The certified run plays its fanfare above and holds the epilogue
      // until the motorcade arrives; everything else lands here.
      audio.play(WON.has(d.runEnded) ? 'win' : 'gameover');
      showEpilogue();
    } else if (d.operatingBanned) {
      audio.play('warning');
      showCard('ban');
    } else if (d.investigationOpened) {
      audio.play('warning');
      showCard('investigation');
    } else if (d.letter) {
      audio.play('warning');
      showCard('letter');
    }

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
      lightning.strike(sim.state, sim.world, bolt.block, worldNow());
      sky.flash(worldNow());
      thunderFor(bolt.block);

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
    excavator.sync(sim.state, sim.world, worldNow());

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
   * The world's own clock: wall time, less every moment the estate was
   * paused. Everything that moves in the scene reads this instead of
   * `performance.now()`, so Pause stops the clouds, the mobs, the fires and
   * the crews along with the days. The camera and the interface keep wall
   * time, because a paused player still wants to look around.
   */
  let worldMs = 0;
  const worldNow = (): number => worldMs;

  /**
   * A forest block gives up a tree at each quarter of the chop, and whatever
   * is left when the block clears; a block that clears while unwatched (a
   * loaded save, a 50× skip) just drops what remains.
   */
  const treesFelled = new Map<BlockId, number>();

  function fellChoppedTrees(cleared: ReadonlySet<BlockId>): void {
    const now = worldNow();

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

  /**
   * The pin layer (design kit 6a): the Kopdes, and any block the pests have
   * got into. Beetles only matter once there are enough of them to bore a
   * palm, so a stray one does not plant a pin on the map.
   */
  const PIN_LIFT = 4.6;
  const BEETLES_WORTH_A_PIN = 12;
  /** An estate in trouble everywhere is not helped by a screen full of pins. */
  const MAX_PEST_PINS = 10;
  const pinPoint = new Vector3();
  const hudMarkerItems: HudMarker[] = [];

  function syncHudMarkers(): void {
    hudMarkerItems.length = 0;

    const { state, world } = sim;
    const width = handle.canvas.clientWidth;
    const height = handle.canvas.clientHeight;

    rig.camera.updateMatrixWorld();

    const side = WORLD.blockSide;
    const pin = (
      block: BlockId,
      kind: HudMarker['kind'],
      label: string,
      detail: string,
      alert: boolean,
    ) => {
      const [bx, by] = world.toXY(block);
      const cx = bx * side + side / 2;
      const cz = by * side + side / 2;

      pinPoint.set(cx, groundAt(cx, cz) + PIN_LIFT, cz).project(rig.camera);
      // Behind the camera, or off the edge: no pin, and no work done for one.
      if (pinPoint.z > 1) return;
      hudMarkerItems.push({
        id: `${kind}:${block}`,
        kind,
        block,
        x: ((pinPoint.x + 1) / 2) * width,
        y: ((1 - pinPoint.y) / 2) * height,
        label,
        detail,
        alert,
      });
    };

    if (state.kopdes) {
      pin(
        state.kopdes.blockId,
        'workshop',
        t('markers.workshop'),
        t('markers.workshopDetail', {
          at: blockLabel(world, state.kopdes.blockId),
          level: state.kopdes.level,
        }),
        false,
      );
    }

    // A slope that gave way keeps its pin until something is planted on it.
    for (const [id, block] of state.blocks) {
      if (!block.owned || block.landslideAt < 0) continue;
      pin(
        id,
        'landslide',
        t('markers.landslide'),
        block.landslidePalms > 0
          ? t('markers.landslideDetail', { palms: block.landslidePalms })
          : t('markers.landslideBare'),
        true,
      );
    }

    for (const [id, palms] of state.palms) {
      const block = state.blocks.get(id);

      if (!block?.owned || block.species !== 'palm') continue;

      const counts = ganodermaCounts(palms);
      const sick = counts.symptomatic + counts.dead;

      if (sick > 0) {
        const treated = block.trichodermaUntil > state.tick;

        pin(
          id,
          'ganoderma',
          t('markers.ganoderma'),
          t(treated ? 'markers.ganodermaHeld' : 'markers.ganodermaDetail', {
            sick,
            total: palms.plantedAt.length,
          }),
          !treated,
        );
      }

      if (block.beetles >= BEETLES_WORTH_A_PIN) {
        pin(
          id,
          'beetle',
          t('markers.beetle'),
          t('markers.beetleDetail', {
            beetles: Math.round(block.beetles),
            debris: Math.round(block.debris),
          }),
          block.trapsUntil <= state.tick,
        );
      }
    }

    // The Kopdes always keeps its pin, and so does a landslide: it is one
    // block's whole crop. The pest ones give way to the worst of them.
    const kept = hudMarkerItems.filter((m) => m.kind === 'workshop' || m.kind === 'landslide');
    const pests = hudMarkerItems
      .filter((m) => m.kind !== 'workshop' && m.kind !== 'landslide')
      .sort((a, b) => Number(b.alert) - Number(a.alert))
      .slice(0, MAX_PEST_PINS);

    hudMarkers.update([...kept, ...pests]);
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

      const digging = block.excavateUntil > sim.state.tick;

      items.push({
        id,
        x: ((markerPoint.x + 1) / 2) * width,
        y: ((1 - markerPoint.y) / 2) * height,
        progress: digging
          ? 1 - (block.excavateUntil - sim.state.tick) / EXCAVATION.days
          : block.clearProgress,
        kind: digging ? 'dig' : block.burning ? 'burn' : 'chop',
      });
    }

    workMarkers.update(items);
  }

  function onFrame(dt: number, nowMs: number): void {
    // Nothing in the world moves while the clock is stopped.
    const running = time.speed > 0;
    const worldDt = running ? dt : 0;

    if (running) worldMs += dt * 1000;

    rig.update(dt, nowMs);
    rig.visibleGround(visible);
    chunks.update(visible, nowMs);

    if (palmsDirty) {
      palms.sync(sim.state, sim.world, worldMs, animateBlocks);
      animateBlocks = new Set();
      palmsDirty = false;
    }

    palms.update(worldMs);
    ring.update(nowMs, running);
    police.update(worldMs);
    ceremony.update(worldMs);
    motorcade.update(worldMs);
    excavator.update(worldMs);
    ticker.update(sim.state.society.news, unreadWarnings());
    newsPanel.update(sim.state.society.news, newsStatus());
    fires.update(worldMs);
    sky.update(sim.state.weather, uniforms, atmosphere(), worldDt, worldMs);
    rain.update(worldDt, sim.state.weather.rain, sim.state.weather.sky, visible, running);
    syncWeatherAudio(dt);
    syncFireAudio();
    lightning.update(worldMs);
    timber.update(worldMs);
    mobField.update(worldDt, time.secondsPerTick);
    coins.update(worldDt);
    sparkleBurst.update(worldDt);
    clouds.update(worldDt, rig.camera, visible);
    syncSparkles(worldMs);
    syncWorkMarkers();
    syncHudMarkers();

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
    // Fire, gold coins in the air, and the glints over anything worth
    // clicking, which is also what marks the golden capybara.
    if (fires.burning || coins.count > 0 || sparklePoints.length > 0) glow.render();
    else handle.render(scene, rig.camera);
  }

  const loop = new GameLoop({
    ticksPerSecond: () => time.ticksPerSecond,
    tick: onTick,
    frame: onFrame,
  });

  /**
   * Some mobs are worth a click rather than a block: the golden capybara, and
   * the babi ngepet on the day it stands up at the Kopdes. Both sparkle while
   * they can be caught, and their drawn position is projected on the click;
   * the crowd mesh itself cannot be picked apart.
   */
  /** Whether a mob is standing on land the player owns. */
  function onTheEstate(mob: (typeof sim.state.mobs)[number]): boolean {
    const x = Math.floor(mob.x);
    const y = Math.floor(mob.z);

    if (!sim.world.inBounds(x, y)) return false;
    return sim.state.blocks.get(sim.world.toId(x, y))?.owned ?? false;
  }

  /**
   * What is worth a click: the golden capybara, and the babi ngepet once it is
   * on your land, whether it is still ambling in as a pig or up on two legs.
   * The sim decides what that is worth; this only decides what glints.
   */
  function worthAClick(mob: (typeof sim.state.mobs)[number]): boolean {
    if (mob.shiny) return true;
    return mob.species === 'babiNgepet' && (mob.standing || onTheEstate(mob));
  }

  const sparklePoints: SparklePoint[] = [];
  const wispPoints: WispPoint[] = [];

  /** One throw of glints over the Kopdes, from the roof and the corners. */
  function cheerKopdes(): void {
    const kopdes = sim.state.kopdes;

    if (!kopdes) return;

    const side = WORLD.blockSide;
    const [bx, by] = sim.world.toXY(kopdes.blockId);
    const x = bx * side + side / 2;
    const z = by * side + side / 2;
    const y = groundAt(x, z);

    for (const [dx, dy, dz, n] of [
      [0, 5.2, 0, 16],
      [-2.4, 3, 1.8, 9],
      [2.4, 3, -1.8, 9],
    ] as const) {
      sparkleBurst.burst(x + dx, y + dy, z + dz, n);
    }
  }

  function syncSparkles(nowMs: number): void {
    sparklePoints.length = 0;
    wispPoints.length = 0;

    for (const mob of sim.state.mobs) {
      const glints = worthAClick(mob);
      // The babi ngepet smokes from the moment it sets foot on the estate,
      // which is also the moment it is worth clicking.
      const smokes = mob.species === 'babiNgepet' && (mob.standing || onTheEstate(mob));

      if (!glints && !smokes) continue;

      const drawn = mobField.positionOf(mob.id);
      const x = drawn?.x ?? mob.x * WORLD.blockSide;
      const z = drawn?.z ?? mob.z * WORLD.blockSide;
      const y = drawn?.y ?? groundAt(x, z);

      if (glints) sparklePoints.push({ x, y, z });
      if (smokes) wispPoints.push({ x, y, z });
    }

    sparkles.update(sparklePoints, nowMs);
    wisps.update(wispPoints, nowMs);
  }

  const TAP_RADIUS_PX = 42;
  const tapPoint = new Vector3();

  function tapMobAt(ndcX: number, ndcY: number): boolean {
    const width = handle.canvas.clientWidth;
    const height = handle.canvas.clientHeight;
    const clickX = ((ndcX + 1) / 2) * width;
    const clickY = ((1 - ndcY) / 2) * height;

    rig.camera.updateMatrixWorld();

    let best: { id: number; distance: number } | null = null;

    for (const mob of sim.state.mobs) {
      if (!worthAClick(mob)) continue;

      const drawn = mobField.positionOf(mob.id);
      const x = drawn?.x ?? mob.x * WORLD.blockSide;
      const z = drawn?.z ?? mob.z * WORLD.blockSide;

      tapPoint.set(x, (drawn?.y ?? groundAt(x, z)) + 1, z).project(rig.camera);

      const distance = Math.hypot(
        ((tapPoint.x + 1) / 2) * width - clickX,
        ((1 - tapPoint.y) / 2) * height - clickY,
      );

      if (distance <= TAP_RADIUS_PX && (!best || distance < best.distance)) {
        best = { id: mob.id, distance };
      }
    }

    if (!best) return false;

    const mob = sim.state.mobs.find((m) => m.id === best.id);
    const runs = mob?.species === 'babiNgepet';
    const at = mobField.positionOf(best.id);

    if (!dispatch({ type: 'TapMob', mob: best.id }).ok) return false;
    // Coins first, so they fall from where it was standing.
    if (at) coins.burst(at.x, at.y + 1.2, at.z, runs ? 14 : 10);
    audio.play('coins-burst');
    // The pig bolts and is gone into the trees; the capybara is simply not
    // there any more.
    if (runs) mobField.flee(best.id);
    else mobField.vanish(best.id);
    mobField.syncSim(sim.state);
    return true;
  }

  const detachPointer = attachPointer(handle.canvas, {
    onClick: (ndc) => {
      if (tapMobAt(ndc.x, ndc.y)) return;
      select(picker.pickBlock(ndc.x, ndc.y));
    },
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
    setSpeed: (speed) => requestSpeed(speed),
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
  police.sync(sim.state, sim.world, worldNow());
  ceremony.sync(sim.state, sim.world, worldNow());
  motorcade.sync(sim.state, sim.world);
  workSite.sync(sim.state, sim.world);
  excavator.sync(sim.state, sim.world, worldNow());
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
      // What the renderer is holding, for watching a long run for leaks. The
      // workbench shows the same numbers with a UI around them.
      gpu: () => {
        const info = handle.renderer.info as unknown as {
          render: { drawCalls: number; triangles: number };
          memory: { geometries: number; textures: number; programs: number; total: number };
        };

        return {
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.memory.programs,
          bytes: info.memory.total,
          drawCalls: info.render.drawCalls,
          triangles: info.render.triangles,
        };
      },
      audio,
      // What the one-shot effects are holding, for the browser suite.
      effects: () => ({ sparkleBurst: sparkleBurst.mesh.count }),
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
  // A named estate is greeted by name, with its code in hand for sharing.
  const welcome = () =>
    toasts.push(
      t('start.welcome', {
        code: sim.state.estateName
          ? `${sim.state.estateName} (${sim.world.estateCode})`
          : sim.world.estateCode,
      }),
    );
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
      code: state.estateName
        ? `${state.estateName} (${sim.world.estateCode})`
        : sim.world.estateCode,
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
      // The save is about to be replaced, so the player names what replaces
      // it and sees the warning first: the same form the menu uses.
      refreshMenu();
      menu.show();
      menu.openNew(true);
    },
    loadOther: () => menu.toggle(),
    useCode: (code, name) => {
      // The seed box wins when it is filled; otherwise the name settles the
      // world, so naming an estate is enough to start one.
      const from = code === '' ? name : code;
      const seed = from === '' ? randomSeed() : seedFromEstateCode(from);

      if (seed === null) return t('start.codeError');
      switchSim(freshSim(seed, name));
      beginPlay();
      return null;
    },
    howToPlay: () => help.toggle(),
    settings: () => menu.toggle(),
  });

  /** Fade the title out and pull the camera in on the estate; the clock starts with it. */
  function beginPlay(): void {
    playing = true;
    refreshMenu();
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
      estateName: sim.state.estateName,
      save: slot.exists() ? saveSummary() : null,
      build: t('start.build', {
        version: __APP_VERSION__,
        backend: handle.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2',
      }),
    });
  } else {
    // Straight into play: a dev or test URL that names a world, or a run that
    // is already over and reopens on its epilogue.
    playing = true;
    refreshMenu();
    if (!slot.exists()) welcome();
  }

  return () => {
    if (epilogueTimer !== null) clearTimeout(epilogueTimer);
    loop.stop();
    detachAutosave();
    detachKeys();
    detachPointer();
    root.removeEventListener('pointerdown', unlockAudio);
    root.removeEventListener('keydown', unlockAudio);
    root.removeEventListener('pointerdown', uiPress, { capture: true });
    audio.dispose();
    observer.disconnect();
    hud.dispose();
    workMarkers.dispose();
    hudMarkers.dispose();
    coins.dispose();
    sparkles.dispose();
    sparkleBurst.dispose();
    wisps.dispose();
    clouds.dispose();
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
    excavator.dispose();
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
