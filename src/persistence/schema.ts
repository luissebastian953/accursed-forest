/**
 * Save file shape (§7) and the encode/decode between it and `SimState`.
 *
 * A save is a manifest plus one entry per sim chunk that contains at least one
 * diverged block. Typed arrays travel as base64; untouched land is never
 * stored because the world regenerates from the seed.
 *
 * Every field is validated with zod on load so a corrupt or hand-edited save
 * fails loudly with a `SaveError`, not weirdly three years into a run.
 * Decoding is written out field by field rather than cast, so a shape change
 * in `sim/types.ts` is a compile error here rather than a runtime surprise.
 */

import { z } from 'zod';

import { decodeFloat32, decodeInt32, decodeUint8, encodeTypedArray } from '@shared/base64';
import { SLOTS_PER_BLOCK, WORLD } from '@sim/balance/world';
import { STATE_VERSION } from '@sim/state';
import type {
  ActiveEvent,
  Block,
  BlockId,
  Command,
  CommandRecord,
  LedgerEntry,
  NewsItem,
  PalmArrays,
  RunState,
  SimState,
} from '@sim/types';

export const KEY_PREFIX = 'accursed-forest';

/**
 * Bump on any breaking change to the save shape; add a migration alongside.
 *
 * 1. M1a: blocks, palms, economy, weather, society, run, command log.
 * 2. M1b: economy gains tbsPriceHistory, tbsPending, soldKgTotal.
 *    M1c added command variants (burn, sanitize, irrigate, drain) without a
 *    bump: a v2 save's command log only ever holds commands that existed.
 * 3. M1d: palm arrays gain ganodermaSince and trenched.
 * 4. M1f: news items gain a template key; society gains lettersReceived.
 * 5. M1g: run gains profit books, stats, year summaries, the chronicle and
 *    sandbox, and loses yearSnapshots (the snapshots are storage keys);
 *    society gains operatingBanUntil; the ledger gains the `capital` kind.
 * 6. M1 balance pass: the Kopdes gains the auto-harvest toggle.
 * 7. M1 weather pass: the weather carries the day's sky.
 * 8. Mobs: the head carries the mobs on the estate and the next mob id.
 * 9. Weather spells: the weather carries how long the sky holds.
 * 10. Mob repertoire: mobs carry a behaviour timer, an anchor and a heading.
 * 11. Natural fires: the weather lists the blocks lightning lit, and the
 *     reboisasi ending.
 */
export const CURRENT_SCHEMA = 11;

export type SaveErrorCode = 'missing' | 'corrupt' | 'newerSchema' | 'quota';

export class SaveError extends Error {
  override readonly name = 'SaveError';

  constructor(
    readonly code: SaveErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

// ── Schemas ───────────────────────────────────────────────────────────────

const Tick = z.number();
const Id = z.int().nonnegative();

const BiomeSchema = z.enum([
  'grassfield',
  'forest',
  'scrub',
  'hills',
  'riverbank',
  'river',
  'protected',
  'peat',
  'rubber',
  'village',
  'swamp',
]);

const BlockSchema = z.object({
  id: Id,
  biome: BiomeSchema,
  phase: z.enum(['wild', 'clearing', 'cleared', 'planted', 'reforesting', 'kopdes']),
  clearProgress: z.number(),
  debris: z.number(),
  irrigated: z.boolean(),
  fertilizedUntil: Tick,
  beetles: z.number(),
  trapsUntil: Tick,
  metarhiziumUntil: Tick,
  trichodermaUntil: Tick,
  lastHarvest: Tick,
  plagued: z.boolean(),
  moisture: z.number(),
  drained: z.boolean(),
  burning: z.boolean(),
  fireIntensity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  ashUntil: Tick,
  bannedUntil: Tick,
  owned: z.boolean(),
  forSale: z.boolean(),
  elevation: z.number(),
  slope: z.boolean(),
  coverCropUntil: Tick,
  species: z.enum(['palm', 'forest']),
});

export type SerializedBlock = z.infer<typeof BlockSchema>;

/**
 * Compile-time check that the block schema and `Block` describe the same
 * shape in both directions. If either drifts this stops typechecking.
 */
export type AssertBlockSchemaMatches = [Block] extends [SerializedBlock]
  ? [SerializedBlock] extends [Block]
    ? true
    : never
  : never;

const Base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, 'not base64');

const PalmArraysSchema = z.object({
  plantedAt: Base64,
  growth: Base64,
  health: Base64,
  ganoderma: Base64,
  yieldAcc: Base64,
  ganodermaSince: Base64,
  trenched: Base64,
});

export type SerializedPalmArrays = z.infer<typeof PalmArraysSchema>;

const RngSchema = z.object({ a: z.number(), b: z.number(), c: z.number(), d: z.number() });

const ActiveEventSchema = z.object({
  id: z.string(),
  startedAt: Tick,
  endsAt: Tick,
  blocks: z.array(Id).optional(),
});

const WeatherSchema = z.object({
  dayOfYear: z.number(),
  regime: z.enum(['normal', 'elNino', 'laNina']),
  rain: z.number(),
  sun: z.number(),
  sky: z.enum(['clear', 'cloudy', 'rain', 'storm']),
  skyUntil: Tick,
  naturalFires: z.array(Id),
  dryStreak: z.number(),
  wetStreak: z.number(),
  activeEvents: z.array(ActiveEventSchema),
});

const NewsItemSchema = z.object({
  tick: Tick,
  key: z.string(),
  lane: z.enum(['natural', 'economic', 'government']),
  severity: z.enum(['info', 'notice', 'warning', 'critical']),
  title: z.string(),
  body: z.string(),
  effects: z.array(z.string()),
  blocks: z.array(Id).optional(),
});

const SocietySchema = z.object({
  integrity: z.number(),
  firePressure: z.number(),
  attention: z.number(),
  warningLevel: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  investigationUntil: Tick,
  operatingBanUntil: Tick,
  lettersReceived: z.int().nonnegative(),
  news: z.array(NewsItemSchema),
  unreadSince: Tick,
});

const ItemIdSchema = z.enum([
  'bibit',
  'fertilizer',
  'pheromoneTrap',
  'metarhizium',
  'trichoderma',
  'sanitationCrew',
  'forestSapling',
]);

const LedgerEntrySchema = z.object({
  tick: Tick,
  kind: z.enum(['sale', 'upkeep', 'purchase', 'wages', 'fine', 'capital']),
  amount: z.number(),
  note: z.string().optional(),
});

const EconomySchema = z.object({
  cash: z.number(),
  tbsPrice: z.number(),
  inputPriceIndex: z.number(),
  ledger: z.array(LedgerEntrySchema),
  tbsPriceHistory: z.array(z.number()),
  tbsPending: z.number(),
  soldKgTotal: z.number(),
});

const RunStatsSchema = z.object({
  burns: z.number(),
  blocksBurned: z.number(),
  neighbourBlocksBurned: z.number(),
  palmsLost: z.number(),
  disasters: z.number(),
  forestChopped: z.number(),
  forestPlanted: z.number(),
  settled: z.number(),
  lowestCash: z.number(),
});

const YearSummarySchema = z.object({
  year: z.int().positive(),
  profit: z.number(),
  cash: z.number(),
  matureHectares: z.number(),
  forestCover: z.number(),
  conditionsMet: z.int().nonnegative(),
});

const ChronicleEntrySchema = z.object({
  tick: Tick,
  lane: z.enum(['natural', 'economic', 'government', 'estate']),
  severity: z.enum(['info', 'notice', 'warning', 'critical']),
  title: z.string(),
});

const RunSchema = z.object({
  startedAt: Tick,
  insolventFor: z.number(),
  yearProfit: z.number(),
  profitTotal: z.number(),
  lastBurnAt: Tick,
  stats: RunStatsSchema,
  years: z.array(YearSummarySchema),
  chronicle: z.array(ChronicleEntrySchema),
  sandbox: z.boolean(),
  endedAt: Tick.optional(),
  ending: z
    .enum(['clean', 'dirty', 'reboisasi', 'fade', 'bankrupt', 'banned', 'arrested'])
    .optional(),
});

const CommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PlantBlock'), block: Id, species: z.enum(['palm', 'forest']) }),
  z.object({ type: z.literal('BuyBlock'), block: Id }),
  z.object({ type: z.literal('ChopBlock'), block: Id }),
  z.object({
    type: z.literal('BurnBlock'),
    block: Id,
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  z.object({ type: z.literal('SanitizeBlock'), block: Id }),
  z.object({ type: z.literal('IrrigateBlock'), block: Id }),
  z.object({ type: z.literal('DrainBlock'), block: Id }),
  z.object({ type: z.literal('HarvestBlock'), block: Id }),
  z.object({ type: z.literal('FertilizeBlock'), block: Id }),
  z.object({ type: z.literal('PlaceKopdes'), block: Id }),
  z.object({ type: z.literal('UpgradeKopdes') }),
  z.object({ type: z.literal('BuyItem'), item: ItemIdSchema, quantity: z.int().positive() }),
  z.object({ type: z.literal('SetTrap'), block: Id }),
  z.object({ type: z.literal('ApplyMetarhizium'), block: Id }),
  z.object({ type: z.literal('ApplyTrichoderma'), block: Id }),
  z.object({ type: z.literal('RemovePalm'), block: Id, slot: z.int().nonnegative() }),
  z.object({ type: z.literal('TrenchPalm'), block: Id, slot: z.int().nonnegative() }),
  z.object({ type: z.literal('ReplantBlock'), block: Id }),
  z.object({ type: z.literal('CoverCropBlock'), block: Id }),
  z.object({ type: z.literal('SettleInvestigation') }),
  z.object({ type: z.literal('SetAutoHarvest'), on: z.boolean() }),
  z.object({
    type: z.literal('HireWorker'),
    kind: z.enum(['sanitizer', 'plantDoctor', 'security']),
  }),
  z.object({
    type: z.literal('DismissWorker'),
    kind: z.enum(['sanitizer', 'plantDoctor', 'security']),
  }),
  z.object({ type: z.literal('KeepPlaying') }),
]);

export type AssertCommandSchemaMatches = [Command] extends [z.infer<typeof CommandSchema>]
  ? [z.infer<typeof CommandSchema>] extends [Command]
    ? true
    : never
  : never;

const WorldGenSchema = z.object({
  seed: z.number(),
  width: z.int().positive(),
  height: z.int().positive(),
  startX: z.int().nonnegative(),
  startY: z.int().nonnegative(),
  startSize: z.int().positive(),
  kopdesBlock: Id,
  riverCount: z.int().nonnegative(),
});

const MobSchema = z.object({
  id: z.int().positive(),
  species: z.enum([
    'wildBoar',
    'pig',
    'mouse',
    'cow',
    'monkey',
    'orangutan',
    'capybara',
    'thief',
    'babiNgepet',
    'ghost',
    'sanitizer',
    'plantDoctor',
    'security',
    'crew',
  ]),
  x: z.number(),
  z: z.number(),
  tx: z.number(),
  tz: z.number(),
  intent: z.enum([
    'idle',
    'pace',
    'wander',
    'circle',
    'sleep',
    'travel',
    'hide',
    'raid',
    'work',
    'flee',
    'leave',
  ]),
  target: Id.nullable(),
  born: Tick,
  /** `Infinity` does not survive JSON; a hired worker's `until` is stored as null. */
  until: z.number().nullable(),
  phase: z.number(),
  standing: z.boolean(),
  hired: z.boolean(),
  intentUntil: Tick,
  ax: z.number(),
  az: z.number(),
  heading: z.number(),
});

const HeadSchema = z.object({
  tick: Tick,
  rng: RngSchema,
  economy: EconomySchema,
  weather: WeatherSchema,
  society: SocietySchema,
  run: RunSchema,
  kopdes: z.object({ blockId: Id, level: z.int().positive(), autoHarvest: z.boolean() }).nullable(),
  inventory: z.record(ItemIdSchema, z.number()),
  mobs: z.array(MobSchema),
  nextMobId: z.int().positive(),
  commandLog: z.array(z.object({ tick: Tick, command: CommandSchema })),
});

export const ManifestSchema = z.object({
  schema: z.int().positive(),
  app: z.string(),
  savedAt: z.string(),
  seed: z.number(),
  worldGen: WorldGenSchema,
  head: HeadSchema,
  /** Chunk keys (`cx:cy`) present for this slot. */
  chunks: z.array(z.string()),
});

export const ChunkSchema = z.object({
  cx: z.int().nonnegative(),
  cy: z.int().nonnegative(),
  blocks: z.array(BlockSchema),
  palms: z.array(z.tuple([Id, PalmArraysSchema])),
});

export type SaveManifest = z.infer<typeof ManifestSchema>;
export type SaveChunk = z.infer<typeof ChunkSchema>;

// ── Chunk addressing ──────────────────────────────────────────────────────

/** `cx:cy` of the sim chunk a block falls in (§7: same 4x4 partition as rendering). */
export function chunkKeyOf(width: number, block: BlockId): string {
  const x = block % width;
  const y = (block - x) / width;
  return `${Math.floor(x / WORLD.chunkSide)}:${Math.floor(y / WORLD.chunkSide)}`;
}

export function parseChunkKey(key: string): { cx: number; cy: number } {
  const [cx, cy] = key.split(':').map(Number);
  if (cx === undefined || cy === undefined || !Number.isInteger(cx) || !Number.isInteger(cy)) {
    throw new SaveError('corrupt', `bad chunk key "${key}"`);
  }
  return { cx, cy };
}

// ── Encode ────────────────────────────────────────────────────────────────

export function encodePalms(palms: PalmArrays): SerializedPalmArrays {
  return {
    plantedAt: encodeTypedArray(palms.plantedAt),
    growth: encodeTypedArray(palms.growth),
    health: encodeTypedArray(palms.health),
    ganoderma: encodeTypedArray(palms.ganoderma),
    yieldAcc: encodeTypedArray(palms.yieldAcc),
    ganodermaSince: encodeTypedArray(palms.ganodermaSince),
    trenched: encodeTypedArray(palms.trenched),
  };
}

export interface SerializedState {
  manifest: SaveManifest;
  /** Keyed by `cx:cy`. */
  chunks: Map<string, SaveChunk>;
}

export function serializeState(
  state: SimState,
  appVersion: string,
  savedAt: string,
): SerializedState {
  const chunks = new Map<string, SaveChunk>();

  const chunkFor = (block: BlockId): SaveChunk => {
    const key = chunkKeyOf(state.width, block);
    let chunk = chunks.get(key);
    if (!chunk) {
      const { cx, cy } = parseChunkKey(key);
      chunk = { cx, cy, blocks: [], palms: [] };
      chunks.set(key, chunk);
    }
    return chunk;
  };

  for (const block of state.blocks.values()) chunkFor(block.id).blocks.push({ ...block });
  for (const [id, palms] of state.palms) chunkFor(id).palms.push([id, encodePalms(palms)]);

  const manifest: SaveManifest = {
    schema: CURRENT_SCHEMA,
    app: appVersion,
    savedAt,
    seed: state.seed,
    worldGen: { ...state.worldGen },
    head: {
      tick: state.tick,
      rng: { ...state.rng },
      economy: {
        cash: state.economy.cash,
        tbsPrice: state.economy.tbsPrice,
        inputPriceIndex: state.economy.inputPriceIndex,
        ledger: state.economy.ledger.map((e) => ({ ...e })),
        tbsPriceHistory: [...state.economy.tbsPriceHistory],
        tbsPending: state.economy.tbsPending,
        soldKgTotal: state.economy.soldKgTotal,
      },
      weather: {
        ...state.weather,
        activeEvents: state.weather.activeEvents.map((e) => ({ ...e })),
      },
      society: {
        ...state.society,
        news: state.society.news.map((n) => ({ ...n })),
      },
      run: {
        ...state.run,
        stats: { ...state.run.stats },
        years: state.run.years.map((y) => ({ ...y })),
        chronicle: state.run.chronicle.map((c) => ({ ...c })),
      },
      kopdes: state.kopdes ? { ...state.kopdes } : null,
      inventory: { ...state.inventory },
      mobs: state.mobs.map((m) => ({ ...m, until: Number.isFinite(m.until) ? m.until : null })),
      nextMobId: state.nextMobId,
      commandLog: state.commandLog.map((r) => ({ tick: r.tick, command: { ...r.command } })),
    },
    chunks: [...chunks.keys()],
  };

  return { manifest, chunks };
}

// ── Decode ────────────────────────────────────────────────────────────────

function decodePalms(block: BlockId, data: SerializedPalmArrays): PalmArrays {
  const palms: PalmArrays = {
    plantedAt: decodeInt32(data.plantedAt),
    growth: decodeFloat32(data.growth),
    health: decodeUint8(data.health),
    ganoderma: decodeUint8(data.ganoderma),
    yieldAcc: decodeFloat32(data.yieldAcc),
    ganodermaSince: decodeInt32(data.ganodermaSince),
    trenched: decodeUint8(data.trenched),
  };
  for (const [name, array] of Object.entries(palms)) {
    if (array.length !== SLOTS_PER_BLOCK) {
      throw new SaveError(
        'corrupt',
        `block ${block}: ${name} has ${array.length} slots, expected ${SLOTS_PER_BLOCK}`,
      );
    }
  }
  return palms;
}

function decodeActiveEvent(e: z.infer<typeof ActiveEventSchema>): ActiveEvent {
  const out: ActiveEvent = { id: e.id, startedAt: e.startedAt, endsAt: e.endsAt };
  if (e.blocks !== undefined) out.blocks = e.blocks;
  return out;
}

function decodeNews(n: z.infer<typeof NewsItemSchema>): NewsItem {
  const out: NewsItem = {
    tick: n.tick,
    key: n.key,
    lane: n.lane,
    severity: n.severity,
    title: n.title,
    body: n.body,
    effects: n.effects,
  };
  if (n.blocks !== undefined) out.blocks = n.blocks;
  return out;
}

function decodeLedger(e: z.infer<typeof LedgerEntrySchema>): LedgerEntry {
  const out: LedgerEntry = { tick: e.tick, kind: e.kind, amount: e.amount };
  if (e.note !== undefined) out.note = e.note;
  return out;
}

function decodeRun(r: z.infer<typeof RunSchema>): RunState {
  const out: RunState = {
    startedAt: r.startedAt,
    insolventFor: r.insolventFor,
    yearProfit: r.yearProfit,
    profitTotal: r.profitTotal,
    lastBurnAt: r.lastBurnAt,
    stats: { ...r.stats },
    years: r.years.map((y) => ({ ...y })),
    chronicle: r.chronicle.map((c) => ({ ...c })),
    sandbox: r.sandbox,
  };
  if (r.endedAt !== undefined) out.endedAt = r.endedAt;
  if (r.ending !== undefined) out.ending = r.ending;
  return out;
}

function decodeCommandLog(log: z.infer<typeof HeadSchema>['commandLog']): CommandRecord[] {
  return log.map((r) => ({ tick: r.tick, command: r.command }));
}

/** Validate raw parsed JSON and rebuild a `SimState`. Throws `SaveError`. */
export function deserializeState(manifestJson: unknown, chunkJsons: Iterable<unknown>): SimState {
  const manifest = ManifestSchema.safeParse(manifestJson);
  if (!manifest.success) {
    throw new SaveError('corrupt', `manifest: ${manifest.error.issues[0]?.message ?? 'invalid'}`, {
      cause: manifest.error,
    });
  }
  const m = manifest.data;
  if (m.schema !== CURRENT_SCHEMA) {
    throw new SaveError(
      m.schema > CURRENT_SCHEMA ? 'newerSchema' : 'corrupt',
      `manifest schema ${m.schema} reached the decoder; expected ${CURRENT_SCHEMA}`,
    );
  }

  const blocks = new Map<BlockId, Block>();
  const palms = new Map<BlockId, PalmArrays>();

  for (const raw of chunkJsons) {
    const parsed = ChunkSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SaveError('corrupt', `chunk: ${parsed.error.issues[0]?.message ?? 'invalid'}`, {
        cause: parsed.error,
      });
    }
    for (const block of parsed.data.blocks) blocks.set(block.id, { ...block });
    for (const [id, data] of parsed.data.palms) palms.set(id, decodePalms(id, data));
  }

  const h = m.head;
  return {
    version: STATE_VERSION,
    seed: m.seed,
    rng: { ...h.rng },
    tick: h.tick,
    width: m.worldGen.width,
    height: m.worldGen.height,
    worldGen: { ...m.worldGen },
    blocks,
    active: new Set(),
    palms,
    kopdes: h.kopdes ? { ...h.kopdes } : null,
    economy: {
      cash: h.economy.cash,
      tbsPrice: h.economy.tbsPrice,
      inputPriceIndex: h.economy.inputPriceIndex,
      ledger: h.economy.ledger.map(decodeLedger),
      tbsPriceHistory: [...h.economy.tbsPriceHistory],
      tbsPending: h.economy.tbsPending,
      soldKgTotal: h.economy.soldKgTotal,
    },
    inventory: { ...h.inventory },
    weather: { ...h.weather, activeEvents: h.weather.activeEvents.map(decodeActiveEvent) },
    society: {
      integrity: h.society.integrity,
      firePressure: h.society.firePressure,
      attention: h.society.attention,
      warningLevel: h.society.warningLevel,
      investigationUntil: h.society.investigationUntil,
      operatingBanUntil: h.society.operatingBanUntil,
      lettersReceived: h.society.lettersReceived,
      news: h.society.news.map(decodeNews),
      unreadSince: h.society.unreadSince,
    },
    run: decodeRun(h.run),
    mobs: h.mobs.map((m) => ({ ...m, until: m.until ?? Infinity })),
    nextMobId: h.nextMobId,
    commandLog: decodeCommandLog(h.commandLog),
  };
}
