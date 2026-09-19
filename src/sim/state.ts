/**
 * Initial state, the sparse block map, and the ledger (§4.4, §4.6).
 *
 * `SimState.blocks` holds only blocks that diverged from world generation.
 * Everything reads through `readBlock` and writes through `writeBlock`, which
 * materialises the block into the map on first touch. That is the whole trick
 * that lets a 64x64 world cost the size of the estate.
 */

import { ECONOMY } from './balance/prices.ts';
import type { EventSink } from './events.ts';
import { createRng } from './rng.ts';
import type { Block, BlockId, LedgerEntry, SimState } from './types.ts';
import type { World } from './worldgen/index.ts';

/** Bumped on any breaking change to the shape of `SimState`. */
export const STATE_VERSION = 1;

/** What every system and command receives. */
export interface SimContext {
  state: SimState;
  world: World;
  events: EventSink;
}

export function createInitialState(world: World, name = ''): SimState {
  const { params } = world;

  const state: SimState = {
    version: STATE_VERSION,
    seed: params.seed,
    estateName: name,
    rng: createRng(params.seed),
    tick: 0,
    width: params.width,
    height: params.height,
    worldGen: params,
    blocks: new Map(),
    active: new Set(),
    palms: new Map(),
    kopdes: null,
    economy: {
      cash: ECONOMY.startingCash,
      tbsPrice: ECONOMY.startingTbsPrice,
      inputPriceIndex: 1,
      ledger: [],
      tbsPriceHistory: [ECONOMY.startingTbsPrice],
      tbsPending: 0,
      soldKgTotal: 0,
    },
    inventory: {
      bibit: 0,
      fertilizer: 0,
      pheromoneTrap: 0,
      metarhizium: 0,
      trichoderma: 0,
      sanitationCrew: 0,
      forestSapling: 0,
      excavationCrew: 0,
    },
    weather: {
      dayOfYear: 0,
      regime: 'normal',
      rain: 0,
      sun: 1,
      sky: 'clear',
      skyUntil: 0,
      naturalFires: [],
      dryStreak: 0,
      wetStreak: 0,
      activeEvents: [],
    },
    society: {
      integrity: 0.25,
      firePressure: 0,
      attention: 0,
      warningLevel: 0,
      investigationUntil: -1,
      operatingBanUntil: -1,
      lettersReceived: 0,
      news: [],
      unreadSince: 0,
    },
    run: {
      startedAt: 0,
      insolventFor: 0,
      yearProfit: 0,
      profitTotal: 0,
      lastBurnAt: -1,
      stats: {
        burns: 0,
        blocksBurned: 0,
        neighbourBlocksBurned: 0,
        palmsLost: 0,
        disasters: 0,
        forestChopped: 0,
        forestPlanted: 0,
        settled: 0,
        lowestCash: ECONOMY.startingCash,
      },
      years: [],
      chronicle: [],
      sandbox: false,
    },
    mobs: [],
    nextMobId: 1,
    commandLog: [],
  };

  // The starting estate: an owned square around the start site, with the
  // Kopdes block pre-cleared (§4.6). Water and protected forest inside the
  // square stay unowned; you cannot hold title to a river.
  for (let y = params.startY; y < params.startY + params.startSize; y++) {
    for (let x = params.startX; x < params.startX + params.startSize; x++) {
      const generated = world.generated(x, y);
      if (!generated.forSale) continue;
      const block = writeBlock(state, world, world.toId(x, y));
      block.owned = true;
    }
  }

  const kopdesBlock = writeBlock(state, world, params.kopdesBlock);
  kopdesBlock.owned = true;
  kopdesBlock.phase = 'cleared';
  kopdesBlock.clearProgress = 1;

  return state;
}

/**
 * Read a block. Untouched blocks come back freshly generated and must be
 * treated as read-only; mutate through `writeBlock` instead.
 */
export function readBlock(state: SimState, world: World, id: BlockId): Readonly<Block> {
  return state.blocks.get(id) ?? world.blockById(id);
}

/** Get a block for mutation, materialising it into the sparse map if needed. */
export function writeBlock(state: SimState, world: World, id: BlockId): Block {
  let block = state.blocks.get(id);
  if (!block) {
    block = world.blockById(id);
    state.blocks.set(id, block);
  }
  return block;
}

export function neighbourIds(world: World, id: BlockId): BlockId[] {
  const [x, y] = world.toXY(id);
  const out: BlockId[] = [];
  if (x > 0) out.push(world.toId(x - 1, y));
  if (x < world.width - 1) out.push(world.toId(x + 1, y));
  if (y > 0) out.push(world.toId(x, y - 1));
  if (y < world.height - 1) out.push(world.toId(x, y + 1));
  return out;
}

export function hasOwnedNeighbour(state: SimState, world: World, id: BlockId): boolean {
  for (const n of neighbourIds(world, id)) {
    if (state.blocks.get(n)?.owned) return true;
  }
  return false;
}

export function countOwned(state: SimState): number {
  let n = 0;
  for (const block of state.blocks.values()) if (block.owned) n += 1;
  return n;
}

// ── Ledger ────────────────────────────────────────────────────────────────

function record(state: SimState, entry: LedgerEntry): void {
  if (entry.kind !== 'capital') state.run.yearProfit += entry.amount;
  state.economy.ledger.push(entry);
  if (state.economy.ledger.length > ECONOMY.ledgerCap) {
    state.economy.ledger.splice(0, state.economy.ledger.length - ECONOMY.ledgerCap);
  }
}

export function spend(
  state: SimState,
  amount: number,
  kind: LedgerEntry['kind'],
  note?: string,
): void {
  state.economy.cash -= amount;
  record(
    state,
    note === undefined
      ? { tick: state.tick, kind, amount: -amount }
      : { tick: state.tick, kind, amount: -amount, note },
  );
}

export function earn(
  state: SimState,
  amount: number,
  kind: LedgerEntry['kind'],
  note?: string,
): void {
  state.economy.cash += amount;
  record(
    state,
    note === undefined
      ? { tick: state.tick, kind, amount }
      : { tick: state.tick, kind, amount, note },
  );
}
