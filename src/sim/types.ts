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
 * machinery and the `PalmArrays` storage, with different curves (GDD 3.10).
 */
export type Species = 'palm' | 'forest';

export interface Block {
  id: BlockId;
  biome: Biome;
  phase: BlockPhase;
  /** 0..1 while `phase === 'clearing'`. */
  clearProgress: number;
  /** 0..100. Feeds both pest systems (GDD 3.4). */
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
  /** 0 none, 1 low, 2 medium, 3 high / wildfire (GDD 3.1.1). */
  fireIntensity: 0 | 1 | 2 | 3;
  /** Fertility bonus window after ash fall. */
  ashUntil: Tick;
  /** Enforcement ban: no clearing or planting until this tick (GDD 3.9). */
  bannedUntil: Tick;
  /** Unowned blocks are visible but inert (GDD 3.1.1). */
  owned: boolean;
  /** False for protected forest, village land and river water. */
  forSale: boolean;
  /** 0..3, fixed at world generation. */
  elevation: number;
  /** Derived from neighbours at world generation (GDD 3.6.2). */
  slope: boolean;
  coverCropUntil: Tick;
  /** When the slope last gave way (GDD 3.6.2), or -1. Cleared by excavating. */
  landslideAt: Tick;
  /** Palms buried by that slide, for the marker to name. */
  landslidePalms: number;
  /** While an excavation crew is digging the slide out, the tick it finishes. */
  excavateUntil: Tick;
  /** A crew is felling the plantation until this tick, or -1; pays nothing for what comes down. */
  fellingUntil: Tick;
  /**
   * What is planted here. Meaningless unless `phase` is `planted` or
   * `reforesting`. (GDD 4.4 omits this; GDD 3.10 requires it.)
   */
  species: Species;
}

/** Palms for one block, struct-of-arrays over 144 slots; fertility is computed, not stored here. */
export interface PalmArrays {
  /** Calendar tick planted; -1 means the slot is empty. Drives senescence. */
  plantedAt: Int32Array;
  /** Accumulated growth-days. Drives stage; immature ends at 900 (GDD 3.6.1). */
  growth: Float32Array;
  /** 0..255. */
  health: Uint8Array;
  /** 0 none, 1 latent, 2 symptomatic, 3 dead/stump. */
  ganoderma: Uint8Array;
  /** Kilograms accumulated since the last harvest. */
  yieldAcc: Float32Array;
  /** Tick the slot was infected; -1 when clean. Drives latent → symptomatic → dead. */
  ganodermaSince: Int32Array;
  /** 1 when an isolation trench cuts this slot's root links (GDD 3.4). */
  trenched: Uint8Array;
}

export type GrowthStage = 'empty' | 'seedling' | 'immature' | 'mature' | 'senile' | 'dead';

export interface ActiveEvent {
  id: string;
  startedAt: Tick;
  endsAt: Tick;
  blocks?: BlockId[];
}

export type ClimateRegime = 'normal' | 'elNino' | 'laNina';

/** What the day looks like overhead (GDD 3.6). Derived from the rain draw. */
export type SkyCondition = 'clear' | 'cloudy' | 'rain' | 'storm';

export interface Weather {
  /** 0..359 in a 360-day year. */
  dayOfYear: number;
  regime: ClimateRegime;
  /** This tick, 0..1. */
  rain: number;
  /** This tick, 0..1, after haze and ash attenuation. */
  sun: number;
  /** Today's sky: sunshine, cloud, rain, or a thunderstorm. */
  sky: SkyCondition;
  /** The sky holds until this tick, storms excepted (GDD 3.6 spells). */
  skyUntil: Tick;
  /** Blocks lit by lightning or a drought spark: they burn out where they are and never spread. */
  naturalFires: BlockId[];
  dryStreak: number;
  wetStreak: number;
  activeEvents: ActiveEvent[];
}

export type NewsLane = 'natural' | 'economic' | 'government';
export type NewsSeverity = 'info' | 'notice' | 'warning' | 'critical';

export interface NewsItem {
  /** Template key: cooldowns and tests look headlines up by it. */
  key: string;
  tick: Tick;
  lane: NewsLane;
  severity: NewsSeverity;
  title: string;
  body: string;
  effects: string[];
  blocks?: BlockId[];
}

export interface Society {
  /** 0..1, hidden. Drives enforcement and relief (GDD 3.7). */
  integrity: number;
  /** Rises per burn, decays per tick; wildfire above the threshold (GDD 3.1.1). */
  firePressure: number;
  /** 0..100 authority attention; warnings at 40 and 70, arrest at 100 (GDD 3.9). */
  attention: number;
  warningLevel: 0 | 1 | 2;
  investigationUntil: Tick;
  /** Estate-wide operating ban from an enforcement roll: no clearing, planting or harvest (GDD 3.8). */
  operatingBanUntil: Tick;
  /** Letters and notices from the authorities so far; the attention gauge appears after the first (GDD 3.9). */
  lettersReceived: number;
  /**
   * Headlines that have already happened this run, for the ones that may
   * only land once and the ones that wait on another (GDD 3.7).
   */
  macroSeen: string[];
  /** Capped ring buffer, newest last. */
  news: NewsItem[];
  unreadSince: Tick;
}

export interface LedgerEntry {
  tick: Tick;
  /** `capital` is land and buildings: it is not counted against operating profit (GDD 3.8). */
  kind: 'sale' | 'upkeep' | 'purchase' | 'wages' | 'fine' | 'capital';
  amount: number;
  note?: string;
}

export interface Economy {
  cash: number;
  /** Rupiah per kg. */
  tbsPrice: number;
  /** 1.0 baseline; shop prices are `base * index` (GDD 3.7). */
  inputPriceIndex: number;
  ledger: LedgerEntry[];
  /** Recent daily prices, newest last; the HUD trend and sparkline. */
  tbsPriceHistory: number[];
  /**
   * Kilograms harvested this tick, awaiting sale. The economy system sells
   * them at the day's price the same tick; TBS never survives a night (GDD 2).
   */
  tbsPending: number;
  /** Lifetime kilograms sold. */
  soldKgTotal: number;
  /** Kilograms and rupiah sold since the year turned; the Kopdes panel reads them. */
  soldKgYear: number;
  soldRpYear: number;
}

export type ItemId =
  | 'bibit'
  | 'fertilizer'
  | 'pheromoneTrap'
  | 'metarhizium'
  | 'trichoderma'
  | 'sanitationCrew'
  | 'forestSapling'
  | 'excavationCrew';

export type Ending =
  'clean' | 'dirty' | 'reboisasi' | 'redemption' | 'fade' | 'bankrupt' | 'banned' | 'arrested';

// ── Mobs ──────────────────────────────────────────────────────────────────

export type MobSpecies =
  | 'wildBoar'
  | 'pig'
  | 'mouse'
  | 'cow'
  | 'monkey'
  | 'orangutan'
  | 'pangolin'
  | 'capybara'
  | 'thief'
  | 'babiNgepet'
  | 'ghost'
  | 'sanitizer'
  | 'plantDoctor'
  | 'security'
  | 'crew';

/** What a mob is up to. */
export type MobIntent =
  | 'idle'
  | 'sit'
  | 'climb'
  | 'climbJump'
  | 'pace'
  | 'wander'
  | 'circle'
  | 'sleep'
  | 'travel'
  | 'hide'
  | 'raid'
  | 'work'
  | 'flee'
  | 'leave';

/**
 * Someone or something walking the estate (GDD POC → M2). Positions are in block
 * units with a fraction inside the block, so the renderer scales them.
 */
export interface Mob {
  id: number;
  species: MobSpecies;
  x: number;
  z: number;
  /** Where it is heading. */
  tx: number;
  tz: number;
  intent: MobIntent;
  /** The block it is working on or heading for, if any. */
  target: BlockId | null;
  /** Tick it appeared. */
  born: Tick;
  /** Tick it goes away on its own. */
  until: Tick;
  /** Animation seed, 0..1. */
  phase: number;
  /** Reared up on two legs (the babi ngepet's tell). */
  standing: boolean;
  /** How far up a tree it is, 0 on the ground to 1 in the canopy. */
  climb: number;
  /** The golden capybara: rare, and worth something to whoever spots it. */
  shiny: boolean;
  /** Hired workers stay until dismissed and are paid daily. */
  hired: boolean;
  /** Tick the current behaviour runs out and a new one is picked. */
  intentUntil: Tick;
  /** Anchor of a pace, or centre of a circle, in block units. */
  ax: number;
  az: number;
  /** Angle around the circle's centre, radians; the sign of `phase - 0.5` picks the direction. */
  heading: number;
}

/** What the epilogue counts (GDD 3.8). Accumulated by the endings system from events. */
export interface RunStats {
  /** Burns the player lit. */
  burns: number;
  /** Blocks that burned, the player's own fires and their spread. */
  blocksBurned: number;
  /** Blocks a fire reached that were not yours. */
  neighbourBlocksBurned: number;
  palmsLost: number;
  /** Weather and world events weathered: haze, ash, floods, droughts, wildfires, landslides. */
  disasters: number;
  forestChopped: number;
  forestPlanted: number;
  /** Rupiah paid to make investigations go away. */
  settled: number;
  lowestCash: number;
}

/** One closed year, for the year-end card and the certificate's profit history. */
export interface YearSummary {
  /** 1-based: the year that just ended. */
  year: number;
  /** Operating profit: everything in the ledger but land and buildings. */
  profit: number;
  cash: number;
  matureHectares: number;
  forestCover: number;
  /** Certificate conditions met at the close of the year, 0..5. */
  conditionsMet: number;
}

/** A line in the epilogue timeline. */
export interface ChronicleEntry {
  tick: Tick;
  lane: NewsLane | 'estate';
  severity: NewsSeverity;
  title: string;
}

export interface RunState {
  startedAt: Tick;
  /** Consecutive ticks below the bank's credit line, for the bankruptcy check (GDD 3.8). */
  insolventFor: number;
  /** Operating profit so far this year. */
  yearProfit: number;
  /** Operating profit over every closed year. */
  profitTotal: number;
  /** The last burn-to-clear, or -1 (GDD 3.8: no burn in five years). */
  lastBurnAt: Tick;
  stats: RunStats;
  years: YearSummary[];
  chronicle: ChronicleEntry[];
  /** "Keep playing" after a win or the fade: no further end checks. */
  sandbox: boolean;
  endedAt?: Tick;
  ending?: Ending;
}

/** Seed-derived world generation inputs. Saved so a world regenerates exactly. */
export interface WorldGenParams {
  seed: number;
  width: number;
  height: number;
  /** Where the player's starting region was placed. */
  startX: number;
  startY: number;
  /** Side length of the initially owned square (GDD 3.1: 8x8). */
  startSize: number;
  /** Block chosen for the Kopdes, pre-cleared at generation. */
  kopdesBlock: BlockId;
  riverCount: number;
}

export interface Kopdes {
  blockId: BlockId;
  level: number;
  /**
   * The Kopdes crew picks every ripe block in range on its own, for a small
   * surcharge on top of the wages (GDD 3.3). Manual harvest is off while it is on.
   */
  autoHarvest: boolean;
}

export interface SimState {
  version: number;
  seed: number;
  /**
   * What the player called this estate, or '' when they did not name it. The
   * seed is the world; the name is only what it is called (GDD 4.6).
   */
  estateName: string;
  rng: RngState;
  tick: Tick;
  width: number;
  height: number;
  worldGen: WorldGenParams;
  /** Sparse: only blocks that diverged from generation (GDD 4.6). */
  blocks: Map<BlockId, Block>;
  /** Blocks the systems tick this turn (GDD 4.6). */
  active: Set<BlockId>;
  palms: Map<BlockId, PalmArrays>;
  kopdes: Kopdes | null;
  economy: Economy;
  inventory: Record<ItemId, number>;
  weather: Weather;
  society: Society;
  run: RunState;
  mobs: Mob[];
  /** The next mob id; ids never repeat within a run. */
  nextMobId: number;
  commandLog: CommandRecord[];
}

// ── Commands ──────────────────────────────────────────────────────────────

export type FireIntensity = 1 | 2 | 3;

/**
 * Everything the player can do. Reforestation is `PlantBlock` with
 * `species: 'forest'` (GDD 3.10): one planting path, two things to plant.
 */
export type Command =
  | { type: 'PlantBlock'; block: BlockId; species: Species }
  /** Buy what the block is short of and plant forest on it, in one step. */
  | { type: 'ReforestBlock'; block: BlockId }
  /** Fell every palm on a planted block, at a price, and hand it back bare. */
  | { type: 'ClearPlantation'; block: BlockId }
  | { type: 'BuyBlock'; block: BlockId }
  | { type: 'ChopBlock'; block: BlockId }
  | { type: 'BurnBlock'; block: BlockId; intensity: FireIntensity }
  | { type: 'SanitizeBlock'; block: BlockId }
  | { type: 'ExcavateBlock'; block: BlockId }
  | { type: 'IrrigateBlock'; block: BlockId }
  | { type: 'DrainBlock'; block: BlockId }
  | { type: 'HarvestBlock'; block: BlockId }
  | { type: 'FertilizeBlock'; block: BlockId }
  | { type: 'PlaceKopdes'; block: BlockId }
  | { type: 'UpgradeKopdes' }
  | { type: 'BuyItem'; item: ItemId; quantity: number }
  | { type: 'SetTrap'; block: BlockId }
  | { type: 'ApplyMetarhizium'; block: BlockId }
  | { type: 'ApplyTrichoderma'; block: BlockId }
  | { type: 'RemovePalm'; block: BlockId; slot: number }
  | { type: 'TrenchPalm'; block: BlockId; slot: number }
  | { type: 'ReplantBlock'; block: BlockId }
  | { type: 'CoverCropBlock'; block: BlockId }
  | { type: 'SettleInvestigation' }
  | { type: 'SetAutoHarvest'; on: boolean }
  | { type: 'HireWorker'; kind: 'sanitizer' | 'plantDoctor' | 'security' }
  | { type: 'DismissWorker'; kind: 'sanitizer' | 'plantDoctor' | 'security' }
  | { type: 'TapMob'; mob: number }
  | { type: 'KeepPlaying' };

export type CommandType = Command['type'];

export interface CommandRecord {
  tick: Tick;
  command: Command;
}

/** Why a command was refused. The UI shows `reason` verbatim (GDD 8 copy rules). */
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
    | 'badSlot'
    | 'halted'
    | 'gameOver'
    | 'unknownBlock'
    | 'notImplemented';
  reason: string;
}

export interface Accepted {
  ok: true;
}

export type DispatchResult = Accepted | Rejection;
