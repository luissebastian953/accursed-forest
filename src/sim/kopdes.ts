import { manhattan } from '@shared/math';

import { ECONOMY } from './balance/prices.ts';
import type { BlockId, SimState } from './types.ts';
import type { World } from './worldgen/index.ts';

export function kopdesRange(level: number): number {
  return ECONOMY.kopdesRange + (level - 1) * ECONOMY.kopdesRangePerLevel;
}

/** Blocks from the Kopdes, or null if there is none. */
export function distanceToKopdes(state: SimState, world: World, block: BlockId): number | null {
  if (!state.kopdes) return null;

  const [ax, ay] = world.toXY(state.kopdes.blockId);
  const [bx, by] = world.toXY(block);

  return manhattan(ax, ay, bx, by);
}

export function inKopdesRange(state: SimState, world: World, block: BlockId): boolean {
  const distance = distanceToKopdes(state, world, block);

  if (distance === null || !state.kopdes) return false;
  return distance <= kopdesRange(state.kopdes.level);
}
