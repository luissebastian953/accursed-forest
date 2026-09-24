import { mount, unmount, type Component } from 'svelte';

import { clamp01 } from '@shared/math';
import { BIOMES } from '@sim/balance/biomes';
import { COVER_CROP } from '@sim/balance/events';
import { FIRE } from '@sim/balance/fire';
import {
  FERTILIZER_YIELD_BONUS,
  FOREST_GROWTH,
  GROWTH,
  HARVEST_ROTATION_DAYS,
} from '@sim/balance/growth';
import { GANODERMA, PEST_LABOUR, PLAGUE } from '@sim/balance/pests';
import {
  CLEAR_PLANTATION,
  DRAINAGE_COST,
  ECONOMY,
  HARVEST,
  IRRIGATION_COST,
  ITEM_PRICES,
  KOPDES_BUILD_COST,
} from '@sim/balance/prices';
import { isWetSeason } from '@sim/balance/seasons';
import { landPrice } from '@sim/commands/buyBlock';
import { itemPrice } from '@sim/commands/buyItem';
import { chopCost } from '@sim/commands/chopBlock';
import { clearPlantationCost, palmsStanding } from '@sim/commands/clearPlantation';
import { seedlingItem, seedlingsNeeded } from '@sim/commands/plantBlock';
import { reforestCost, saplingShortfall } from '@sim/commands/reforestBlock';
import { settleCost, settleListening, settleable } from '@sim/commands/settleInvestigation';
import { kopdesMaturedNeeded, kopdesUpgradeCost } from '@sim/commands/upgradeKopdes';
import { EventSink } from '@sim/events';
import { isFuel, isWildfire } from '@sim/fire';
import type { Sim } from '@sim/index';
import { distanceToKopdes, inKopdesRange, kopdesRange } from '@sim/kopdes';
import { slotLabel } from '@sim/labels';
import { coverCropEstablished, forestCoverAround, landslideChance } from '@sim/landscape';
import { isBearing, isYoung, slotStage } from '@sim/palms';
import { hasWon } from '@sim/run';
import { neighbourIds, readBlock } from '@sim/state';
import { matureHectares } from '@sim/systems/endings';
import { growthMultiplier } from '@sim/systems/growth';
import { daysUntilRipe, harvestCapKg, harvestableKg } from '@sim/systems/harvest';
import { beetleCapacity, ganodermaCounts, pestPressure, plantableSlots } from '@sim/systems/pest';
import type {
  Biome,
  Block,
  BlockId,
  Command,
  DispatchResult,
  FireIntensity,
  GrowthStage,
  ItemId,
  PalmArrays,
  SimState,
  Species,
} from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { t } from '../../../i18n/index.ts';
import { formatKg, formatPercent, formatRp, formatRpCompact, formatTonnes } from '../../format.ts';
import type { IconName } from '../../icons.ts';
import type { TipTone } from '../base/tooltip.ts';

import BlockPanelView_ from './BlockPanel.svelte';

export interface BlockPanelHandlers {
  dispatch(command: Command): DispatchResult;
  close(): void;
  openShop(): void;
  /** Hovering a Burn button previews which neighbours could catch (GDD 8 panel 22). */
  hoverBurn(blocks: BlockId[] | null): void;
  /** Select another block and bring the camera to it, from the Kopdes list. */
  focus(block: BlockId): void;
}

/** A button that issues a command, with the sim's reason when it is greyed out. */
export interface ActionView {
  label: string;
  command: Command;
  testId: string;
  rejection: string | null;
  /** Secondary actions render smaller and grey. */
  minor: boolean;
  cost?: number;
  icon?: IconName;
  /** Shown in place of the cost, for actions whose reward is the point. */
  badge?: string;
  /** The block has this problem right now, so the button asks to be pressed. */
  urgent?: boolean;
}

/** One stat tile in the panel's grid: a label, a value, and an optional note. */
interface TileView {
  label: string;
  value: string;
  note: string | null;
  testId?: string;
  /** 0..100: the moisture tile draws a bar as well. */
  gauge?: number;
}

type SlotGrid = NonNullable<NonNullable<BlockView['pests']>['grid']>;
type SlotDetail = SlotGrid['detail'];

/** One hovered square, read as a caption, a state and the figure to act on. */
export interface SlotTip {
  tone: TipTone;
  icon: IconName | null;
  at: string;
  head: string;
  figure: string;
  /** The figure is the reason to look: it gets the loud colour. */
  hot: boolean;
}

export interface BlockView {
  x: number;
  y: number;
  icon: IconName;
  title: string;
  phase: string;
  tiles: TileView[];
  /**
   * The upgrade, gated by bearing blocks and then by cash (GDD 8 panel 9e).
   * `null` at the highest level, where there is nothing left to buy.
   */
  upgrade: {
    matured: number;
    needed: number;
    cost: number;
    cash: number;
    rejection: string | null;
    nextLevel: number;
    nextRange: number;
    range: number;
    command: Command;
  } | null;
  /** Everything this Kopdes serves, as a status report (GDD 8 panel 9d). */
  kopdes: {
    level: number;
    range: number;
    atMax: boolean;
    shopItems: number;
    price: string;
    trend: 'up' | 'down' | 'flat';
    soldKg: string;
    soldRp: string;
    blocksInRange: number;
    yours: number;
    land: { key: LandKind; hectares: number }[];
    crew: {
      onAuto: number;
      ofBlocks: number;
      nextRound: string | null;
      perRound: number;
      unpicked: number;
    } | null;
    stock: { item: ItemId; label: string; icon: IconName; count: number }[];
    attention: { block: BlockId; kind: 'beetle' | 'ganoderma'; label: string }[];
  } | null;
  palms: {
    heading: string;
    count: number;
    icon: IconName;
    /** The eyebrow over the card: the stage the stand is mostly in. */
    caption: string;
    stageLine: string;
    /** The chip on the right, with the per-stage breakdown behind it. */
    stage: string;
    stages: string;
    /** Three segments, `step` 1-based, `fill` the progress inside that one. */
    step: number;
    fill: number;
    /** What the bar is counting: growth-days before bearing, kilograms after. */
    figure: string;
    note: string;
    growth: string | null;
    bearing: { kg: string; note: string; ripe: boolean; full: boolean } | null;
  } | null;
  pests: {
    plagued: boolean;
    pressure: string;
    beetles: string;
    ganoderma: string | null;
    windows: string | null;
    breeding: boolean;
    treatments: ActionView[];
    grid: {
      /** `sick`: Ganoderma is showing; the cell carries a warning mark. */
      cells: {
        slot: number;
        cls: string;
        title: string;
        sick: boolean;
        /** Bearing and carrying fruit: the only slot state with a mark of its own. */
        fruit: boolean;
        tip: SlotTip;
      }[];
      /** How many slots are carrying fruit right now, for the header count. */
      ripe: number;
      detail:
        | { kind: 'palm'; head: string; health: string; lines: string[]; actions: ActionView[] }
        | { kind: 'empty'; text: string }
        | null;
    } | null;
  } | null;
  burn: {
    fuel: BlockId[];
    meta: string;
    options: {
      intensity: FireIntensity;
      label: string;
      sub: string;
      tips: boolean;
      title: string;
      command: Command;
      rejection: string | null;
    }[];
    preview: string;
    wildfire: boolean;
    /** Why the whole group is dead once the estate has won (GDD 3.8). */
    wonNote: string | null;
  } | null;
  minor: ActionView[];
  major: ActionView[];
  autoHarvest: { on: boolean; command: Command } | null;
  /**
   * Open land, where the block can go either way: the crew clears it, or the
   * saplings keep it green. Paired so the choice reads as a choice.
   */
  land: {
    chop: ActionView;
    chopNote: string;
    reforest: ActionView & { detail: string; locked: boolean; note: string };
  } | null;
  /**
   * The envelope: what it would cost to make a case and a suspension go away,
   * and why the button is dead when it is.
   */
  settle: { cost: number; enabled: boolean; note: string } | null;
  /** A crew has the block: the panel reports, and nothing on it can be pressed. */
  busy: boolean;
  /**
   * The one thing on a planted block that cannot be taken back (GDD 8 panel
   * 13a): felling the lot, priced and named to read as a loss, not a form.
   */
  danger: {
    cost: number;
    palms: number;
    /** What stands there, as the copy names it: palms, or the saplings of a forest. */
    what: string;
    fruitKg: number;
    years: number;
    days: number;
    rejection: string | null;
    command: Command;
  } | null;
}

/** What clearing a plantation would cost, in money and in what stands on it. */
function dangerView(sim: Sim, id: BlockId): BlockView['danger'] {
  const { state, world } = sim;
  const block = readBlock(state, world, id);

  if (block.phase !== 'planted' && block.phase !== 'reforesting') return null;
  if (block.fellingUntil > state.tick) return null;

  const palms = palmsStanding(state, id);

  if (palms === 0) return null;

  const stand = state.palms.get(id);
  let oldest = state.tick;

  if (stand) for (const t of stand.plantedAt) if (t >= 0 && t < oldest) oldest = t;

  const command: Command = { type: 'ClearPlantation', block: id };

  return {
    cost: clearPlantationCost(state, id),
    palms,
    what: block.phase === 'reforesting' ? t('block.whatTrees') : t('block.whatPalms'),
    fruitKg: stand && block.species === 'palm' ? harvestableKg(stand, 'palm', state.tick) : 0,
    years: Math.floor((state.tick - oldest) / GROWTH.daysPerYear),
    days: CLEAR_PLANTATION.days,
    rejection: sim.validate(command)?.reason ?? null,
    command,
  };
}

/**
 * Open land's two futures (GDD 8 panel 11a): the crew with its timber, or
 * the saplings, reforested in one step at the whole price.
 */
function landView(sim: Sim, id: BlockId, chop: ActionView): BlockView['land'] {
  const { state, world } = sim;
  const block = readBlock(state, world, id);
  const ctx = { state, world, events: new EventSink() };
  const needed = seedlingsNeeded(block.biome);
  const short = saplingShortfall(ctx, id);
  const cost = reforestCost(ctx, id);
  const command: Command = { type: 'ReforestBlock', block: id };
  // Nowhere to buy saplings is a different kind of no from too little cash:
  // one is a building the estate has not put up yet.
  const locked = short > 0 && (!state.kopdes || !inKopdesRange(state, world, id));
  const poor = !locked && state.economy.cash < cost;

  return {
    chop,
    chopNote: t('block.chopNote', { days: BIOMES[block.biome].chopDays }),
    reforest: {
      label: t('block.reforest'),
      command,
      testId: 'action-ReforestBlock',
      rejection: sim.validate(command)?.reason ?? null,
      minor: false,
      cost,
      icon: 'shop-sapling',
      detail: t('block.saplings', { n: needed }),
      locked,
      note: locked
        ? t('block.reforestLocked', { n: kopdesRange(state.kopdes?.level ?? 1) })
        : poor
          ? t('block.reforestPoor', {
              cost: formatRp(cost),
              cash: formatRp(Math.max(0, state.economy.cash)),
            })
          : t('block.reforestNote'),
    },
  };
}

/**
 * The coordination fee, as the Kopdes offers it (GDD 3.9): shown only with
 * something to settle, and says plainly when the office will not take it.
 */
function settleView(state: SimState, phase: string): BlockView['settle'] {
  if (phase !== 'kopdes' || !settleable(state)) return null;

  const listening = settleListening(state);
  const cost = settleCost(state);

  return {
    cost,
    enabled: listening && state.economy.cash >= cost,
    note: !listening
      ? t('block.settleQuiet')
      : state.economy.cash < cost
        ? t('block.settleCostly')
        : t('block.settleNote'),
  };
}

/** Which icon heads the panel: what is on the block, or what it is. */
function blockIcon(biome: Biome, phase: string): IconName {
  if (phase === 'kopdes') return 'kopdes';
  if (phase === 'reforesting') return 'shop-sapling';
  if (phase === 'planted') return 'biome-palm-planted';
  if (phase === 'cleared' || phase === 'clearing') return 'biome-forest-cleared';

  switch (biome) {
    case 'forest':
    case 'protected':
    case 'rubber':
      return 'biome-forest-wild';
    case 'scrub':
      return 'biome-scrub';
    case 'hills':
      return 'biome-hills';
    case 'river':
    case 'riverbank':
    case 'swamp':
      return 'biome-river';
    default:
      return 'biome-grassfield';
  }
}

const STAGE_ORDER: GrowthStage[] = ['seedling', 'immature', 'mature', 'senile', 'dead'];
const FIRE_LEVEL_KEY = ['', 'block.fireLow', 'block.fireMedium', 'block.fireHigh'];
const INTENSITY_KEY: Record<FireIntensity, string> = {
  1: 'block.intensityLow',
  2: 'block.intensityMedium',
  3: 'block.intensityHigh',
};

function phaseLabel(phase: string, progress: number, burning: boolean, intensity: number): string {
  const pct = Math.round(progress * 100);

  if (burning) return t('block.phaseBurning', { level: t(FIRE_LEVEL_KEY[intensity] ?? ''), pct });

  switch (phase) {
    case 'wild':
      return t('block.phaseWild');
    case 'clearing':
      return t('block.phaseClearing', { pct });
    case 'cleared':
      return t('block.phaseCleared');
    case 'planted':
      return t('block.phasePlanted');
    case 'reforesting':
      return t('block.phaseReforesting');
    case 'kopdes':
      return t('block.phaseKopdes');
    default:
      return phase;
  }
}

/**
 * What the open window is worth on this block once the fertility ceiling has
 * had its say, which is less than the full fifth wherever ash is running too.
 */
function fertilizerGain(state: SimState, block: Readonly<Block>): number {
  const without = growthMultiplier(state, { ...block, fertilizedUntil: -1 });

  if (without === 0) return 0;
  return Math.round((growthMultiplier(state, block) / without - 1) * 100);
}

/** Whether any palm on the block is old enough to be carrying fruit. */
function anyBearing(state: SimState, id: BlockId, block: Readonly<Block>): boolean {
  if (block.species !== 'palm' || block.phase !== 'planted') return false;

  const palms = state.palms.get(id);

  if (!palms) return false;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! >= 0 && isBearing(slotStage(palms, slot, 'palm', state.tick))) {
      return true;
    }
  }

  return false;
}

/** Whether cover crop and forest are both holding this slope (GDD 3.6.2). */
function coverCombo(state: SimState, block: Readonly<Block>): boolean {
  return coverCropEstablished(block, state.tick) && block.phase === 'reforesting';
}

/** Forest cover around a slope and what the next wet season risks there (GDD 3.6.2). */
function slopeLine(sim: Sim, id: BlockId): string {
  const { state, world } = sim;
  const block = readBlock(state, world, id);
  const cover = Math.round(forestCoverAround(state, world, id) * 100);
  const crop = coverCropEstablished(block, state.tick)
    ? t('block.cropHolding')
    : block.coverCropUntil > state.tick
      ? t('block.cropEstablishing')
      : '';
  // Risk over a wet season at an ordinary wet streak, so the number is stable to read.
  const probe = { ...state, weather: { ...state.weather, wetStreak: 3 } };
  const daily = landslideChance(probe, world, block, true);
  const season = 1 - Math.pow(1 - daily, 150);
  const risk =
    season > 0.3
      ? t('block.riskHigh')
      : season > 0.1
        ? t('block.riskModerate')
        : t('block.riskLow');
  const now = isWetSeason(state.weather.dayOfYear) ? t('block.wetSeasonNow') : '';

  return t('block.slopeLine', { cover, risk, pct: Math.round(season * 100) }) + crop + now;
}

type LandKind = 'bearing' | 'immature' | 'forest' | 'bare';

/** Beetles worth pinning: below this the block is not worth walking to. */
const BEETLES_WORTH_A_LINE = 12;
/** Longest the attention list gets before it stops being a list. */
const ATTENTION_SHOWN = 4;

const STOCK_ICON: Record<ItemId, IconName> = {
  bibit: 'shop-bibit',
  forestSapling: 'shop-sapling',
  fertilizer: 'shop-fertilizer',
  pheromoneTrap: 'shop-trap',
  metarhizium: 'shop-metarhizium',
  trichoderma: 'shop-trichoderma',
  sanitationCrew: 'shop-sanitation',
  excavationCrew: 'shop-excavator',
};

const STOCK_SHOWN: ItemId[] = ['bibit', 'fertilizer', 'pheromoneTrap', 'forestSapling'];

/** Block ids inside the Kopdes diamond, water excluded: it serves no river. */
function blocksInRange(state: SimState, world: World, level: number): BlockId[] {
  const kopdes = state.kopdes;

  if (!kopdes) return [];

  const range = kopdesRange(level);
  const [kx, ky] = world.toXY(kopdes.blockId);
  const out: BlockId[] = [];

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;

      const bx = kx + dx;
      const by = ky + dy;

      if (!world.inBounds(bx, by)) continue;
      if (world.generated(bx, by).biome === 'river') continue;
      out.push(world.toId(bx, by));
    }
  }

  return out;
}

/** What a hectare counts as on the land bar: what is standing, not what it is zoned. */
function landKind(state: SimState, block: Readonly<Block>): LandKind {
  if (block.phase === 'reforesting') return 'forest';

  if (block.phase === 'planted' && block.species === 'palm') {
    const palms = state.palms.get(block.id);

    if (palms) {
      for (let slot = 0; slot < palms.plantedAt.length; slot++) {
        if (palms.plantedAt[slot]! < 0) continue;
        if (isBearing(slotStage(palms, slot, 'palm', state.tick))) return 'bearing';
      }
    }

    return 'immature';
  }

  if (block.phase === 'wild' && BIOMES[block.biome].forestCover) return 'forest';
  return 'bare';
}

/** What the next Kopdes level asks for, and which of the two gates is shut. */
function upgradeView(sim: Sim, level: number): BlockView['upgrade'] {
  const { state } = sim;
  const cost = kopdesUpgradeCost(level);

  if (cost === null) return null;

  const command: Command = { type: 'UpgradeKopdes' };

  return {
    matured: matureHectares(state),
    needed: kopdesMaturedNeeded(level),
    cost,
    cash: state.economy.cash,
    rejection: sim.validate(command)?.reason ?? null,
    nextLevel: level + 1,
    nextRange: kopdesRange(level + 1),
    range: kopdesRange(level),
    command,
  };
}

/** The status report the Kopdes panel is (GDD 8 panel 9d). */
function kopdesView(sim: Sim, level: number): NonNullable<BlockView['kopdes']> {
  const { state, world } = sim;
  const e = state.economy;
  // Ten days back, the same window the HUD and the shop read the trend over.
  const earlier = e.tbsPriceHistory[Math.max(0, e.tbsPriceHistory.length - 11)] ?? e.tbsPrice;
  const hectares: Record<LandKind, number> = { bearing: 0, immature: 0, forest: 0, bare: 0 };
  const attention: NonNullable<BlockView['kopdes']>['attention'] = [];
  let yours = 0;
  let onAuto = 0;
  let unpicked = 0;
  let soonest: number | null = null;

  const ids = blocksInRange(state, world, level);

  for (const id of ids) {
    const block = readBlock(state, world, id);

    if (!block.owned) continue;
    yours += 1;
    if (block.phase !== 'kopdes') hectares[landKind(state, block)] += 1;

    const palms = state.palms.get(id);

    if (block.phase === 'planted' && block.species === 'palm' && palms) {
      onAuto += 1;

      const days = daysUntilRipe(block, state.tick);

      if (days !== null && (soonest === null || days < soonest)) soonest = days;
      if (days === 0 && harvestableKg(palms, 'palm', state.tick) > 0) unpicked += 1;
    }

    const counts = palms ? ganodermaCounts(palms) : null;
    const [bx, by] = world.toXY(id);
    const at = `${bx + 1}, ${by + 1}`;

    if (counts && counts.symptomatic + counts.dead > 0) {
      attention.push({ block: id, kind: 'ganoderma', label: t('block.kopAtGano', { at }) });
    } else if (block.beetles >= BEETLES_WORTH_A_LINE) {
      attention.push({ block: id, kind: 'beetle', label: t('block.kopAtBeetles', { at }) });
    }
  }

  let ofBlocks = 0;

  for (const block of state.blocks.values())
    if (block.owned && block.phase === 'planted' && block.species === 'palm') ofBlocks += 1;

  const auto = state.kopdes?.autoHarvest ?? false;

  return {
    level,
    range: kopdesRange(level),
    atMax: level >= ECONOMY.kopdesMaxLevel,
    shopItems: Object.keys(ITEM_PRICES).length,
    price: formatRp(e.tbsPrice),
    trend: e.tbsPrice > earlier * 1.01 ? 'up' : e.tbsPrice < earlier * 0.99 ? 'down' : 'flat',
    soldKg: formatTonnes(e.soldKgYear),
    soldRp: formatRpCompact(e.soldRpYear),
    blocksInRange: ids.length,
    yours,
    land: (['bearing', 'immature', 'forest', 'bare'] as LandKind[]).map((key) => ({
      key,
      hectares: hectares[key],
    })),
    crew:
      ofBlocks > 0
        ? {
            onAuto: auto ? onAuto : 0,
            ofBlocks,
            nextRound: soonest === null ? null : t('block.kopNextRound', { n: soonest }),
            perRound: auto ? HARVEST.autoSurchargePerRound * onAuto : 0,
            unpicked,
          }
        : null,
    stock: STOCK_SHOWN.map((item) => ({
      item,
      label: t(`block.kopItem_${item}`),
      icon: STOCK_ICON[item],
      count: state.inventory[item],
    })),
    attention: attention.slice(0, ATTENTION_SHOWN),
  };
}

/** The stand card's crest: what the stand mostly looks like from outside. */
function standIcon(step: number, forest: boolean): IconName {
  if (step === 1) return 'shop-bibit';
  if (step === 2) return forest ? 'shop-sapling' : 'biome-palm-planted';
  return forest ? 'forest-cover' : 'biome-palm-planted';
}

/**
 * A latent infection is invisible to the player, so the bubble reads it as the
 * healthy palm it still looks like. Only `ganoderma === 2` shows.
 */
function slotTip(
  palms: PalmArrays,
  slot: number,
  stage: GrowthStage,
  ganoderma: number,
  species: Species,
  tick: number,
): SlotTip {
  const at = t('block.tipSlot', { at: slotLabel(slot) });

  if (stage === 'empty')
    return {
      tone: 'sand',
      icon: null,
      at,
      head: t('block.tipEmpty'),
      figure: t('block.tipReplant'),
      hot: false,
    };

  if (ganoderma === 3 || stage === 'dead')
    return {
      tone: 'grey',
      icon: 'ganoderma-mushroom',
      at,
      head: t('block.tipDead'),
      figure: t('block.tipStump'),
      hot: false,
    };

  if (ganoderma === 2) {
    const young = isYoung(stage);
    const window = young ? GANODERMA.symptomaticDays.immature : GANODERMA.symptomaticDays.mature;
    const left = Math.max(0, window - (tick - palms.ganodermaSince[slot]!));

    return {
      tone: 'purple',
      icon: 'ganoderma-mushroom',
      at,
      head: t('block.tipSick'),
      figure: t('block.tipDays', { n: left }),
      hot: true,
    };
  }

  if (isBearing(stage)) {
    const kg = palms.yieldAcc[slot]!;

    return {
      tone: 'deep',
      icon: species === 'palm' ? 'biome-palm-planted' : 'forest-cover',
      at,
      head: t('block.tipMature'),
      figure: t('block.tipRipe', { kg: kg.toFixed(1) }),
      hot: kg > 0,
    };
  }

  const bearsAt = species === 'palm' ? GROWTH.immatureDays : FOREST_GROWTH.matureDays;
  const months = Math.max(1, Math.ceil((bearsAt - palms.growth[slot]!) / 30));

  return {
    tone: 'green',
    icon: 'shop-bibit',
    at,
    head: t('block.tipYoung'),
    figure: t('block.tipMonths', { n: months }),
    hot: false,
  };
}

/** A plain, localized snapshot of everything the panel shows for one block. */
export function blockView(sim: Sim, id: BlockId, selectedSlot: number | null): BlockView {
  const { state, world } = sim;
  const block = readBlock(state, world, id);
  const [x, y] = world.toXY(id);
  const spec = BIOMES[block.biome];
  const index = state.economy.inputPriceIndex;
  const action = (
    label: string,
    command: Command,
    testId: string,
    extra: Partial<Pick<ActionView, 'cost' | 'icon' | 'badge' | 'minor' | 'urgent'>> = {},
  ): ActionView => ({
    label,
    command,
    testId,
    rejection: sim.validate(command)?.reason ?? null,
    minor: extra.minor ?? false,
    ...(extra.cost !== undefined ? { cost: extra.cost } : {}),
    ...(extra.icon !== undefined ? { icon: extra.icon } : {}),
    ...(extra.badge !== undefined ? { badge: extra.badge } : {}),
    ...(extra.urgent ? { urgent: true } : {}),
  });

  const actions: ActionView[] = [];
  let burnable = false;

  if (!block.owned) {
    actions.push(
      action(t('block.buyLand'), { type: 'BuyBlock', block: id }, 'action-BuyBlock', {
        ...(block.forSale ? { cost: landPrice(state, world, id) } : {}),
      }),
    );
  } else if (!block.burning) {
    // A slide is the block's whole story until it is dug out: nothing can be
    // planted through spoil, so the crew comes before every other offer.
    if (block.landslideAt >= 0) {
      actions.push(
        action(t('block.excavate'), { type: 'ExcavateBlock', block: id }, 'action-ExcavateBlock', {
          icon: 'shop-excavator',
        }),
      );
    }

    switch (block.phase) {
      case 'wild':
        // Open land pairs the two ways to take it (see `landView`); the rest
        // has only one, and the crew does it.
        if (!spec.openLand) {
          actions.push(
            action(t('block.chop'), { type: 'ChopBlock', block: id }, 'action-ChopBlock', {
              cost: chopCost(block.biome, state),
            }),
          );
        }

        burnable = isFuel(block, false);
        break;

      case 'cleared': {
        const needed = seedlingsNeeded(block.biome);

        actions.push(
          action(
            t('block.plantPalms', { n: needed }),
            { type: 'PlantBlock', block: id, species: 'palm' },
            'action-PlantBlock-palm',
          ),
        );

        // Buying is not blocked by a slide, but nothing can be planted through
        // spoil, so offering the seedlings would be selling into a dead end.
        if (state.kopdes && state.inventory.bibit < needed && block.landslideAt < 0) {
          const shortfall = needed - state.inventory.bibit;

          actions.push(
            action(
              t('block.buyBibit', { n: shortfall }),
              { type: 'BuyItem', item: seedlingItem('palm'), quantity: shortfall },
              'action-BuyBibit',
              { cost: itemPrice('bibit', index) * shortfall },
            ),
          );
        }

        actions.push(
          action(
            t('block.reforest'),
            { type: 'ReforestBlock', block: id },
            'action-ReforestBlock',
            {
              icon: 'shop-sapling',
              badge: t('block.saplings', { n: needed }),
            },
          ),
        );

        if (!state.kopdes) {
          actions.push(
            action(
              t('block.placeKopdes'),
              { type: 'PlaceKopdes', block: id },
              'action-PlaceKopdes',
              {
                cost: KOPDES_BUILD_COST,
              },
            ),
          );
        }

        burnable = isFuel(block, false);
        break;
      }

      case 'planted':
        if (block.species === 'palm') {
          const palms = state.palms.get(id);
          const ready = palms ? harvestableKg(palms, 'palm', state.tick) : 0;

          actions.push(
            action(t('block.harvest'), { type: 'HarvestBlock', block: id }, 'action-HarvestBlock', {
              icon: 'harvest-basket',
              ...(ready > 0 ? { badge: formatKg(ready) } : {}),
            }),
          );
        }

        actions.push(
          action(
            t('block.fertilize'),
            { type: 'FertilizeBlock', block: id },
            'action-FertilizeBlock',
          ),
        );
        break;
      case 'reforesting':
        actions.push(
          action(
            t('block.fertilize'),
            { type: 'FertilizeBlock', block: id },
            'action-FertilizeBlock',
          ),
        );
        break;

      case 'kopdes':
        break;

      case 'clearing':
        break;
    }

    if (block.phase !== 'kopdes' && block.biome !== 'river') {
      if (block.slope && (block.phase === 'planted' || block.phase === 'cleared')) {
        actions.push(
          action(
            block.coverCropUntil > state.tick ? t('block.coverCropDone') : t('block.coverCrop'),
            { type: 'CoverCropBlock', block: id },
            'action-CoverCropBlock',
            { cost: COVER_CROP.cost, icon: 'forest-cover', minor: true },
          ),
        );
      }

      if (!block.irrigated) {
        actions.push(
          action(
            t('block.irrigate'),
            { type: 'IrrigateBlock', block: id },
            'action-IrrigateBlock',
            {
              cost: IRRIGATION_COST,
              icon: 'water-irrigate',
              minor: true,
            },
          ),
        );
      }

      if (!block.drained) {
        actions.push(
          action(t('block.drain'), { type: 'DrainBlock', block: id }, 'action-DrainBlock', {
            cost: DRAINAGE_COST,
            icon: 'rain',
            minor: true,
          }),
        );
      }
    }
  }

  const tiles: TileView[] = [
    {
      label: t('block.tileTitle'),
      // Owned land carries the estate's name, when it has one: the title is
      // the one tile that says whose the hectare is.
      value: block.owned
        ? state.estateName
          ? t('block.yoursNamed', { name: state.estateName })
          : t('block.yours')
        : block.forSale
          ? t('block.forSale')
          : t('block.notForSale'),
      note: null,
    },
    {
      label: t('block.tileElevation'),
      value: block.slope
        ? t('block.elevationSlope', { n: block.elevation })
        : String(block.elevation),
      note: null,
    },
    {
      label: t('block.tileMoisture'),
      value: formatPercent(block.moisture),
      gauge: Math.round(block.moisture * 100),
      note:
        block.irrigated || block.drained
          ? [block.irrigated ? t('block.irrigated') : '', block.drained ? t('block.drained') : '']
              .filter(Boolean)
              .join(', ')
          : null,
    },
  ];

  if (block.owned && block.phase !== 'kopdes' && state.kopdes) {
    const distance = distanceToKopdes(state, world, id) ?? 0;
    const inRange = inKopdesRange(state, world, id);

    tiles.push({
      label: t('block.tileKopdes'),
      value: inRange
        ? distance === 1
          ? t('block.inRangeOne', { n: distance })
          : t('block.inRangeMany', { n: distance })
        : t('block.outOfRange', { n: distance, range: kopdesRange(state.kopdes.level) }),
      note: inRange ? null : t('block.spoilNote'),
      testId: 'block-range',
    });
  }

  if (block.phase === 'wild') {
    tiles.push({
      label: t('block.tilePlantable'),
      value: t('block.slots', { n: spec.plantableSlots }),
      note: null,
    });
  }

  if (block.debris > 0) {
    tiles.push({
      label: t('block.tileDebris'),
      value: `${Math.round(block.debris)} / 100`,
      note: null,
      testId: 'block-debris',
    });
  }

  if (block.ashUntil > state.tick) {
    tiles.push({
      label: t('block.tileAsh'),
      value: t('block.ashFertile', { n: block.ashUntil - state.tick }),
      note: null,
    });
  }

  if (block.fertilizedUntil > state.tick) {
    const gain = fertilizerGain(state, block);
    let fertilizedNote =
      gain > 0 ? t('block.fertilizedGain', { pct: gain }) : t('block.fertilizedCapped');

    // On a stand already in fruit the window is worth the growth it buys and
    // the bunches on top of it, so the note names the one the player harvests.
    if (anyBearing(state, id, block)) {
      const fruit = Math.round(((1 + gain / 100) * FERTILIZER_YIELD_BONUS - 1) * 100);

      fertilizedNote = t('block.fertilizedFruit', { pct: fruit });
    }

    tiles.push({
      label: t('block.tileFertilized'),
      value: t('block.daysLeft', { n: block.fertilizedUntil - state.tick }),
      note: fertilizedNote,
    });
  }

  if (block.slope) {
    tiles.push({
      label: t('block.tileSlope'),
      value: slopeLine(sim, id),
      note: coverCombo(state, block) ? t('block.slopeHolding') : t('block.slopeAdvice'),
      testId: 'block-slope',
    });
  }

  // Palms on the block.
  let palmsView: BlockView['palms'] = null;
  const palms = state.palms.get(id);

  if (palms) {
    const stageCounts: Partial<Record<GrowthStage, number>> = {};
    let growthSum = 0;
    let growthN = 0;

    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;

      const stage = slotStage(palms, slot, block.species, state.tick);

      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
      growthSum += palms.growth[slot]!;
      growthN += 1;
    }

    const meanGrowth = growthN > 0 ? growthSum / growthN : 0;
    const forest = block.species === 'forest';
    // Forest has its own thresholds: sapling to young tree, young to mature.
    const [firstStage, secondStage] = forest
      ? [FOREST_GROWTH.saplingDays, FOREST_GROWTH.matureDays]
      : [GROWTH.seedlingDays, GROWTH.immatureDays];
    const nextStage =
      meanGrowth < firstStage ? firstStage : meanGrowth < secondStage ? secondStage : null;
    // Trees carry no fruit: only palms have a harvest line.
    const bearing = forest ? 0 : (stageCounts.mature ?? 0) + (stageCounts.senile ?? 0);
    const kg = block.species === 'palm' ? harvestableKg(palms, 'palm', state.tick) : 0;
    // Bunches stop accruing at the cap and start rotting instead, so a full
    // block is losing fruit rather than saving it (GDD 3.3).
    const cap = block.species === 'palm' ? harvestCapKg(palms, 'palm', state.tick) : 0;
    const days = daysUntilRipe(block, state.tick);
    const step = meanGrowth < firstStage ? 1 : meanGrowth < secondStage ? 2 : 3;
    const fill =
      step === 1
        ? meanGrowth / firstStage
        : step === 2
          ? (meanGrowth - firstStage) / (secondStage - firstStage)
          : 1;
    const stageKey = step === 1 ? 'seedling' : step === 2 ? 'immature' : 'mature';
    const stage = t(forest ? `block.forestStage_${stageKey}` : `block.stage_${stageKey}`);
    const kgLine = t('block.standOnTrees', { kg: formatKg(kg) });

    palmsView = {
      heading: block.species === 'forest' ? t('block.forest') : t('block.palms'),
      count: growthN,
      icon: standIcon(step, forest),
      caption: step === 3 && days === 0 ? t('block.standReady') : stage,
      stageLine: t('block.standStage', { n: step, stage }),
      stage,
      stages: STAGE_ORDER.filter((s) => stageCounts[s] !== undefined)
        .map(
          (s) => `${stageCounts[s]} ${t(forest ? `block.forestStage_${s}` : `block.stage_${s}`)}`,
        )
        .join(', '),
      step,
      fill: clamp01(fill),
      figure:
        nextStage !== null
          ? t('block.growthDays', { mean: Math.round(meanGrowth), next: nextStage })
          : bearing > 0
            ? kgLine
            : '',
      note:
        bearing > 0
          ? t('block.standNoteBearing', { n: HARVEST_ROTATION_DAYS })
          : forest
            ? t('block.standNoteForest')
            : t('block.standNoteYoung'),
      growth:
        nextStage !== null
          ? t('block.growthDays', { mean: Math.round(meanGrowth), next: nextStage })
          : null,
      bearing:
        bearing > 0
          ? {
              kg: formatKg(kg),
              note:
                days === null
                  ? ''
                  : days === 0
                    ? t('block.ripeNow')
                    : t('block.nextRound', { n: days }),
              ripe: days === 0,
              full: cap > 0 && kg >= cap - 1e-6,
            }
          : null,
    };
  }

  // Reforested trees are not palms: beetles and Ganoderma never touch them, so
  // no slot grid and no palm treatments. A gap can still be replanted.
  const palmTrees = palms && block.species === 'palm' ? palms : undefined;

  if (palms && !palmTrees && block.owned) {
    const replant = action(
      t('block.replantGaps'),
      { type: 'ReplantBlock', block: id },
      'action-ReplantBlock',
      { minor: true },
    );

    if (replant.rejection === null) actions.push(replant);
  }

  // Beetles, Ganoderma, treatments, the slot grid and per-palm actions (GDD 3.4).
  let pests: BlockView['pests'] = null;

  if (block.owned && (palmTrees || block.debris > 0 || block.beetles > 0)) {
    const tick = state.tick;
    const capacity = beetleCapacity(block.debris);
    const pressure = pestPressure(block, palmTrees);
    const counts = palmTrees ? ganodermaCounts(palmTrees) : null;
    // A treatment the block actually needs pulses, whether or not it can be
    // afforded: a greyed button that is also the answer still has to be seen.
    const beetles = block.beetles > 0 || capacity > 0;
    const fungus = counts !== null && counts.symptomatic + counts.dead > 0;
    const gaps =
      palmTrees !== undefined && counts !== null && counts.planted < plantableSlots(block);
    // Sanitising is the one that fixes the cause rather than the symptom, so
    // it leads the treatments instead of sitting on its own below them.
    const treatments: ActionView[] = [];

    if (block.debris > 0) {
      treatments.push(
        action(t('block.sanitize'), { type: 'SanitizeBlock', block: id }, 'action-SanitizeBlock', {
          minor: true,
          urgent: capacity > 0,
        }),
      );
    }

    treatments.push(
      action(t('block.setTraps'), { type: 'SetTrap', block: id }, 'action-SetTrap', {
        minor: true,
        urgent: beetles,
      }),
      action(
        t('block.metarhizium'),
        { type: 'ApplyMetarhizium', block: id },
        'action-ApplyMetarhizium',
        {
          minor: true,
          urgent: beetles,
        },
      ),
    );

    if (palmTrees) {
      treatments.push(
        action(
          t('block.trichoderma'),
          { type: 'ApplyTrichoderma', block: id },
          'action-ApplyTrichoderma',
          {
            minor: true,
            urgent: fungus,
          },
        ),
        action(t('block.replantGaps'), { type: 'ReplantBlock', block: id }, 'action-ReplantBlock', {
          minor: true,
          urgent: gaps,
        }),
      );
    }

    const windows: string[] = [];

    if (block.trapsUntil > tick)
      windows.push(t('block.trapsWindow', { n: block.trapsUntil - tick }));

    if (block.metarhiziumUntil > tick) {
      windows.push(t('block.metaWindow', { n: block.metarhiziumUntil - tick }));
    }

    if (block.trichodermaUntil > tick) {
      windows.push(t('block.trichoWindow', { n: block.trichodermaUntil - tick }));
    }

    let grid: SlotGrid | null = null;

    if (palmTrees) {
      const cells = [];
      let ripe = 0;

      for (let slot = 0; slot < palmTrees.plantedAt.length; slot++) {
        const stage = slotStage(palmTrees, slot, block.species, state.tick);
        const g = palmTrees.ganoderma[slot]!;
        const bearing = isBearing(stage);
        const fruit = bearing && palmTrees.yieldAcc[slot]! > 0;
        let cls = 'slot-empty';

        if (stage === 'dead') cls = 'slot-dead';
        else if (g === 2) cls = 'slot-sick';
        else if (fruit) cls = 'slot-ripe';
        else if (bearing) cls = 'slot-mature';
        else if (stage === 'immature') cls = 'slot-immature';
        else if (stage === 'seedling') cls = 'slot-sapling';

        const health = palmTrees.health[slot]!;

        if (stage !== 'empty' && stage !== 'dead' && health < 128) cls += ' opacity-60';
        if (palmTrees.trenched[slot] === 1) cls += ' ring-2 ring-[#5a8bff]';
        if (selectedSlot === slot) cls += ' outline outline-2 outline-[#4a3320]';
        if (fruit) ripe += 1;
        cells.push({
          slot,
          cls,
          fruit,
          // A sick palm, and a dead one that is still infectious, both want
          // taking out: both carry the mark.
          sick: g === 2 || g === 3 || stage === 'dead',
          title: t('block.slotTitle', {
            at: slotLabel(slot),
            stage: t(`block.stage_${stage}`),
            sick: g === 2 ? t('block.sick') : '',
          }),
          tip: slotTip(palmTrees, slot, stage, g, block.species, state.tick),
        });
      }

      let detail: SlotDetail = null;

      if (selectedSlot !== null && palmTrees.plantedAt[selectedSlot]! >= 0) {
        const slot = selectedSlot;
        const stage = slotStage(palmTrees, slot, block.species, state.tick);
        const g = palmTrees.ganoderma[slot]!;
        const lines: string[] = [];

        if (g === 2) lines.push(t('block.ganoSick'));
        if (g === 3) lines.push(t('block.deadStump'));
        if (palmTrees.trenched[slot] === 1) lines.push(t('block.trenched'));
        detail = {
          kind: 'palm',
          head: t('block.slotHead', {
            at: slotLabel(slot),
            stage: t(`block.stage_${stage}`),
          }),
          health: t('block.health', { pct: Math.round((palmTrees.health[slot]! / 255) * 100) }),
          lines,
          actions: [
            action(
              t('block.removePalm'),
              { type: 'RemovePalm', block: id, slot },
              'action-RemovePalm',
              {
                cost: PEST_LABOUR.removePalm,
                minor: true,
              },
            ),
            action(
              t('block.trench'),
              { type: 'TrenchPalm', block: id, slot },
              'action-TrenchPalm',
              {
                cost: PEST_LABOUR.trenchPalm,
                minor: true,
              },
            ),
          ],
        };
      } else if (selectedSlot !== null) {
        detail = {
          kind: 'empty',
          text: t('block.slotEmpty', { at: slotLabel(selectedSlot) }),
        };
      }

      grid = { cells, ripe, detail };
    }

    pests = {
      plagued: block.plagued,
      pressure: t('block.pressure', { p: pressure.toFixed(2), max: PLAGUE.onAt }),
      beetles:
        capacity > 0
          ? t('block.beetlesRoom', { n: Math.round(block.beetles), cap: Math.round(capacity) })
          : t('block.beetles', { n: Math.round(block.beetles) }),
      ganoderma: counts
        ? t('block.ganoderma', { sick: counts.symptomatic, dead: counts.dead })
        : null,
      windows: windows.length > 0 ? windows.join(', ') : null,
      breeding: block.debris > 0 && block.beetles > 5,
      treatments,
      grid,
    };
  }

  // Burn: three intensities, the spread preview on hover, the pressure it adds.
  let burn: BlockView['burn'] = null;

  if (burnable) {
    const wildfire = isWildfire(state);
    const fuel = neighbourIds(world, id).filter((n) =>
      isFuel(readBlock(state, world, n), wildfire),
    );
    const threshold = FIRE.wildfireThreshold;
    const pressure = state.society.firePressure;
    const elNino = state.weather.regime === 'elNino' ? t('block.elNinoDoubled') : '';

    burn = {
      fuel,
      meta: t('block.burnMeta', {
        cost: formatRp(FIRE.burnCost),
        pressure: pressure.toFixed(1),
        threshold,
      }),
      options: ([1, 2, 3] as FireIntensity[]).map((intensity) => {
        const command: Command = { type: 'BurnBlock', block: id, intensity };
        const rejection = sim.validate(command)?.reason ?? null;
        const tips = pressure + FIRE.pressure[intensity] > threshold;

        return {
          intensity,
          label: t(INTENSITY_KEY[intensity]),
          sub: t('block.burnOption', {
            days: FIRE.burnDays[intensity],
            add: FIRE.pressure[intensity],
          }),
          tips,
          title: rejection ?? (tips ? t('block.tipsTitle') : ''),
          command,
          rejection,
        };
      }),
      preview:
        fuel.length === 0
          ? t('block.noSpread')
          : fuel.length === 1
            ? t('block.spreadOne', { n: fuel.length, elNino })
            : t('block.spreadMany', { n: fuel.length, elNino }),
      wildfire,
      wonNote: hasWon(state) ? t('block.burnWon') : null,
    };
  }

  // Open land's pair is lifted out of the plain list into its own section.
  const land =
    block.phase === 'wild' && block.owned && !block.burning && spec.openLand
      ? landView(sim, id, {
          label: t('block.chop'),
          command: { type: 'ChopBlock', block: id },
          testId: 'action-ChopBlock',
          rejection: sim.validate({ type: 'ChopBlock', block: id })?.reason ?? null,
          minor: false,
          cost: chopCost(block.biome, state),
          icon: 'axe-chop',
        })
      : null;

  const kopdes = state.kopdes;

  return {
    x: x + 1,
    y: y + 1,
    icon: blockIcon(block.biome, block.phase),
    title: block.phase === 'kopdes' ? t('block.kopdes') : t(`block.biome_${block.biome}`),
    // A plantation under the crew's axes reads as clearing, however it is filed.
    phase:
      block.fellingUntil > state.tick
        ? phaseLabel(
            'clearing',
            1 - (block.fellingUntil - state.tick) / CLEAR_PLANTATION.days,
            block.burning,
            block.fireIntensity,
          )
        : phaseLabel(block.phase, block.clearProgress, block.burning, block.fireIntensity),
    tiles,
    upgrade: block.phase === 'kopdes' && kopdes ? upgradeView(sim, kopdes.level) : null,
    kopdes: block.phase === 'kopdes' && kopdes ? kopdesView(sim, kopdes.level) : null,
    palms: palmsView,
    pests,
    burn,
    minor: actions.filter((a) => a.minor),
    major: actions.filter((a) => !a.minor),
    land,
    settle: settleView(state, block.phase),
    danger: block.burning ? null : dangerView(sim, id),
    busy:
      block.phase === 'clearing' ||
      block.burning ||
      block.fellingUntil > state.tick ||
      block.excavateUntil > state.tick,
    autoHarvest:
      kopdes &&
      (block.phase === 'kopdes' || (block.phase === 'planted' && block.species === 'palm'))
        ? { on: kopdes.autoHarvest, command: { type: 'SetAutoHarvest', on: !kopdes.autoHarvest } }
        : null,
  };
}

export class BlockPanel {
  readonly ui = $state<{
    block: BlockId | null;
    slot: number | null;
    /** The danger zone is unfolded, showing its button. */
    dangerOpen: boolean;
    /** The danger zone's second step is open: the player has asked once. */
    confirmClear: boolean;
    version: number;
  }>({
    block: null,
    slot: null,
    dangerOpen: false,
    confirmClear: false,
    version: 0,
  });
  sim = $state.raw<Sim | null>(null);
  private readonly target: HTMLElement;
  private readonly instance: ReturnType<Component>;

  constructor(
    parent: HTMLElement,
    readonly handlers: BlockPanelHandlers,
  ) {
    this.target = document.createElement('div');
    this.target.className = 'contents';
    parent.appendChild(this.target);
    this.instance = mount(BlockPanelView_, { target: this.target, props: { panel: this } });
  }

  get selected(): BlockId | null {
    return this.ui.block;
  }

  show(sim: Sim, block: BlockId | null): void {
    this.sim = sim;

    if (block !== this.ui.block) {
      this.ui.slot = null;
      this.ui.dangerOpen = false;
      this.ui.confirmClear = false;
    }

    this.ui.block = block;
    if (block === null) this.handlers.hoverBurn(null);
    this.ui.version++;
  }

  /** Re-render the current selection against current state. */
  refresh(): void {
    if (!this.sim || this.ui.block === null) return;
    this.ui.version++;
  }

  /** Dispatch from a button, then show the sim's new answer. */
  act(command: Command): void {
    this.handlers.dispatch(command);
    this.refresh();
  }

  toggleSlot(slot: number): void {
    this.ui.slot = this.ui.slot === slot ? null : slot;
  }

  /** Fold or unfold the danger zone. Folding it also drops a half-asked question. */
  toggleDanger(): void {
    this.ui.dangerOpen = !this.ui.dangerOpen;
    if (!this.ui.dangerOpen) this.ui.confirmClear = false;
  }

  /** Open or close the danger zone's confirm step. */
  askClear(open: boolean): void {
    this.ui.confirmClear = open;
  }

  /** The second press: the crew goes in, and the zone folds away. */
  confirmClear(command: Command): void {
    this.ui.dangerOpen = false;
    this.ui.confirmClear = false;
    this.act(command);
  }

  dispose(): void {
    unmount(this.instance);
    this.target.remove();
  }
}
