import { GROWTH } from './balance/growth.ts';
import { HAUNT, HAUNT_STREAM } from './balance/haunting.ts';
import { forkRng, chance, nextRange } from './rng.ts';
import type { Block, BlockId, SimState, Tick } from './types.ts';

/** 0 quiet; 1 the grave block itself; 2 ghosts and slow workers estate-wide; 3 fruit missing everywhere. */
export type HauntStage = 0 | 1 | 2 | 3;

/** An untouched mass grave: nothing to chop, and the only way in is to dig. */
export function isGrave(block: Readonly<Block>): boolean {
  return block.biome === 'grave' && block.phase === 'wild';
}

/** A grave that has been dug out: formerly a mass grave, whatever stands on it now. */
export function wasGrave(block: Readonly<Block>): boolean {
  return block.biome === 'grave' && block.phase !== 'wild';
}

/** Whole years since a haunted block was planted, or -1 when it is not haunted. */
export function hauntedYears(block: Readonly<Block>, tick: Tick): number {
  if (block.hauntedSince < 0) return -1;
  return Math.floor((tick - block.hauntedSince) / GROWTH.daysPerYear);
}

/** The stage one haunted block has reached by `tick`. */
export function blockHauntStage(block: Readonly<Block>, tick: Tick): HauntStage {
  const years = hauntedYears(block, tick);

  if (years < 0) return 0;
  if (years >= HAUNT.deepenAfterYears) return 3;
  if (years >= HAUNT.spreadAfterYears) return 2;
  return 1;
}

/** Every block whose planting woke the dead, in id order. */
export function hauntedBlocks(state: SimState): Block[] {
  const out: Block[] = [];

  for (const block of state.blocks.values()) if (block.hauntedSince >= 0) out.push(block);
  return out.sort((a, b) => a.id - b.id);
}

/** The estate's haunting: the furthest stage any haunted block has reached. */
export function hauntStage(state: SimState): HauntStage {
  let stage: HauntStage = 0;

  for (const block of state.blocks.values()) {
    const s = blockHauntStage(block, state.tick);

    if (s > stage) stage = s;
  }

  return stage;
}

/** What a hired hand is worth today: halved once the ghosts walk the whole estate. */
export function workerFactor(state: SimState): number {
  return hauntStage(state) >= 2 ? HAUNT.workerFactor : 1;
}

/** Whether the dead take a share of a round picked from this block today. */
export function fruitGoesMissing(state: SimState, block: Readonly<Block>): boolean {
  return block.hauntedSince >= 0 || hauntStage(state) >= 3;
}

/**
 * Kilograms that never reach the Kopdes from a round of `kilograms` picked
 * off `id` today; 0 when the dead leave it alone. Its own stream per day and block.
 */
export function missingFruit(state: SimState, id: BlockId, kilograms: number): number {
  const block = state.blocks.get(id);

  if (!block || kilograms <= 0 || !fruitGoesMissing(state, block)) return 0;

  const rng = forkRng(state.seed ^ HAUNT_STREAM, state.tick * 4099 + id);

  if (!chance(rng, HAUNT.missingChance)) return 0;
  return kilograms * nextRange(rng, HAUNT.missingShare.min, HAUNT.missingShare.max);
}
