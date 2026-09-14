/**
 * Core simulation types (design doc §4.4).
 *
 * Everything here is plain data: no classes with behaviour, no references to
 * anything outside `sim/`. If it cannot be JSON-ish serialised (typed arrays
 * excepted, see `persistence/`), it does not belong in `SimState`.
 */

import type { RngState } from './rng.ts';

/** One tick is one simulated day. */
export type Tick = number;

/** `y * width + x`. Valid only against the world bound that produced it. */
export type BlockId = number;

export type Biome =
  | 'grassfield'
  | 'forest'
  | 'scrub'
  | 'hills'
  | 'riverbank'
  | 'river'
  | 'protected'
  | 'peat'
  | 'rubber'
  | 'village'
  | 'swamp';

export type BlockPhase = 'wild' | 'clearing' | 'cleared' | 'planted' | 'reforesting' | 'kopdes';

/**
 * What is growing on a block. Palms and reforestation share the growth-days
 * machinery and the `PalmArrays` storage, with different curves (§3.10).
 */
export type Species = 'palm' | 'forest';

export interface Block {
  id: BlockId;
  biome: Biome;
  phase: BlockPhase;
  /** 0..1 while `phase === 'clearing'`. */
  clearProgress: number;
  /** 0..100. Feeds both pest systems (§3.4). */
  debris: number;
  irrigated: boolean;
  fertilizedUntil: Tick;
  /** Beetle population, a float because it grows logistically. */
  beetles: number;
  trapsUntil: Tick;
  metarhiziumUntil: Tick;
  trichodermaUntil: Tick;
  lastHarvest: Tick;
  plagued: boolean;
  /** 0..1, from rain and irrigation. */
  moisture: number;
  /** Flood-proofed by a drainage upgrade. */
  drained: boolean;
  burning: boolean;
  /** 0 none, 1 low, 2 medium, 3 high / wildfire (§3.1.1). */
  fireIntensity: 0 | 1 | 2 | 3;
  /** Fertility bonus window after ash fall. */
  ashUntil: Tick;
  /** Enforcement ban: no clearing or planting until this tick (§3.9). */
  bannedUntil: Tick;
  /** Unowned blocks are visible but inert (§3.1.1). */
  owned: boolean;
  /** False for protected forest, village land and river water. */
  forSale: boolean;
  /** 0..3, fixed at world generation. */
  elevation: number;
  /** Derived from neighbours at world generation (§3.6.2). */
  slope: boolean;
  coverCropUntil: Tick;
  /**
   * What is planted here. Meaningless unless `phase` is `planted` or
   * `reforesting`. (§4.4 omits this; §3.10 requires it.)
   */
  species: Species;
}

/**
 * Palms for one block, struct-of-arrays over the block's 144 slots.
 *
 * `fertility` is deliberately absent from `Block` and from here: §3.6.1 makes it
 * a function of the fertilizer window, the ash window, the biome and the
 * clearing history, so it is computed per tick rather than stored.
 */
export interface PalmArrays {
  /** Calendar tick planted; -1 means the slot is empty. Drives senescence. */
  plantedAt: Int32Array;
  /** Accumulated growth-days. Drives stage; immature ends at 900 (§3.6.1). */
  growth: Float32Array;
  /** 0..255. */
  health: Uint8Array;
  /** 0 none, 1 latent, 2 symptomatic, 3 dead/stump. */
  ganoderma: Uint8Array;
  /** Kilograms accumulated since the last harvest. */
  yieldAcc: Float32Array;
}

export type GrowthStage = 'empty' | 'seedling' | 'immature' | 'mature' | 'senile' | 'dead';

export interface ActiveEvent {
  id: string;
  startedAt: Tick;
  endsAt: Tick;
  blocks?: BlockId[];
}

export type ClimateRegime = 'normal' | 'elNino' | 'laNina';

export interface Weather {
  /** 0..359 in a 360-day year. */
  dayOfYear: number;
  regime: ClimateRegime;
  /** This tick, 0..1. */
  rain: number;
  /** This tick, 0..1, after haze and ash attenuation. */
  sun: number;
  dryStreak: number;
  wetStreak: number;
  activeEvents: ActiveEvent[];
}

export type NewsLane = 'natural' | 'economic' | 'government';
export type NewsSeverity = 'info' | 'notice' | 'warning' | 'critical';

export interface NewsItem {
  tick: Tick;
  lane: NewsLane;
  severity: NewsSeverity;
  title: string;
  body: string;
  effects: string[];
  blocks?: BlockId[];
}

export interface Society {
  /** 0..1, hidden. Drives enforcement and relief (§3.7). */
  integrity: number;
  /** Rises per burn, decays per tick; wildfire above the threshold (§3.1.1). */
  firePressure: number;
  /** 0..100 authority attention; warnings at 40 and 70, arrest at 100 (§3.9). */
  attention: number;
  warningLevel: 0 | 1 | 2;
  investigationUntil: Tick;
  /** Capped ring buffer, newest last. */
  news: NewsItem[];
  unreadSince: Tick;
}

export interface LedgerEntry {
  tick: Tick;
  kind: 'sale' | 'upkeep' | 'purchase' | 'wages' | 'fine';
  amount: number;
  note?: string;
}

export interface Economy {
  cash: number;
  /** Rupiah per kg. */
  tbsPrice: number;
  /** 1.0 baseline; shop prices are `base * index` (§3.7). */
  inputPriceIndex: number;
  ledger: LedgerEntry[];
  /** Recent daily prices, newest last — the HUD trend and sparkline. */
  tbsPriceHistory: number[];
  /**
   * Kilograms harvested this tick, awaiting sale. The economy system sells
   * them at the day's price the same tick; TBS never survives a night (§2).
   */
  tbsPending: number;
  /** Lifetime kilograms sold. */
  soldKgTotal: number;
}

export type ItemId =
  | 'bibit'
  | 'fertilizer'
  | 'pheromoneTrap'
  | 'metarhizium'
  | 'trichoderma'
  | 'sanitationCrew'
  | 'forestSapling';

export type Ending = 'clean' | 'dirty' | 'fade' | 'bankrupt' | 'banned' | 'arrested';

export interface RunState {
  startedAt: Tick;
  endedAt?: Tick;
  ending?: Ending;
  /** Ticks at which a year snapshot was written, for rewind (§3.8). */
  yearSnapshots: number[];
  /** Consecutive ticks with negative cash, for the bankruptcy check. */
  insolventFor: number;
}

/** Seed-derived world generation inputs. Saved so a world regenerates exactly. */
export interface WorldGenParams {
  seed: number;
  width: number;
  height: number;
  /** Where the player's starting region was placed. */
  startX: number;
  startY: number;
  /** Side length of the initially owned square (§3.1: 8x8). */
  startSize: number;
  /** Block chosen for the Kopdes, pre-cleared at generation. */
  kopdesBlock: BlockId;
  riverCount: number;
}

export interface Kopdes {
  blockId: BlockId;
  level: number;
}

export interface SimState {
  version: number;
  seed: number;
  rng: RngState;
  tick: Tick;
  width: number;
  height: number;
  worldGen: WorldGenParams;
  /** Sparse: only blocks that diverged from generation (§4.6). */
  blocks: Map<BlockId, Block>;
  /** Blocks the systems tick this turn (§4.6). */
  active: Set<BlockId>;
  palms: Map<BlockId, PalmArrays>;
  kopdes: Kopdes | null;
  economy: Economy;
  inventory: Record<ItemId, number>;
  weather: Weather;
  society: Society;
  run: RunState;
  commandLog: CommandRecord[];
}

// ── Commands ──────────────────────────────────────────────────────────────

export type FireIntensity = 1 | 2 | 3;

/**
 * Everything the player can do. Reforestation is `PlantBlock` with
 * `species: 'forest'` (§3.10): one planting path, two things to plant.
 */
export type Command =
  | { type: 'PlantBlock'; block: BlockId; species: Species }
  | { type: 'BuyBlock'; block: BlockId }
  | { type: 'ChopBlock'; block: BlockId }
  | { type: 'BurnBlock'; block: BlockId; intensity: FireIntensity }
  | { type: 'SanitizeBlock'; block: BlockId }
  | { type: 'IrrigateBlock'; block: BlockId }
  | { type: 'DrainBlock'; block: BlockId }
  | { type: 'HarvestBlock'; block: BlockId }
  | { type: 'FertilizeBlock'; block: BlockId }
  | { type: 'PlaceKopdes'; block: BlockId }
  | { type: 'UpgradeKopdes' }
  | { type: 'BuyItem'; item: ItemId; quantity: number };

export type CommandType = Command['type'];

export interface CommandRecord {
  tick: Tick;
  command: Command;
}

/** Why a command was refused. The UI shows `reason` verbatim (§8 copy rules). */
export interface Rejection {
  ok: false;
  code:
    | 'notOwned'
    | 'notAdjacent'
    | 'notForSale'
    | 'wrongPhase'
    | 'noCash'
    | 'banned'
    | 'noKopdes'
    | 'outOfRange'
    | 'occupied'
    | 'nothingToHarvest'
    | 'notRipe'
    | 'noInventory'
    | 'maxLevel'
    | 'badQuantity'
    | 'burning'
    | 'noFuel'
    | 'unknownBlock'
    | 'notImplemented';
  reason: string;
}

export interface Accepted {
  ok: true;
}

export type DispatchResult = Accepted | Rejection;
