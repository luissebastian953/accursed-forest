import { slotCol, slotRow } from './palms.ts';
import type { BlockId } from './types.ts';
import type { World } from './worldgen/index.ts';

/** "45, 24" for the block at (44, 23). */
export function blockLabel(world: World, id: BlockId): string {
  const [x, y] = world.toXY(id);

  return `${x + 1}, ${y + 1}`;
}

/** "6, 1" for slot 60. */
export function slotLabel(slot: number): string {
  return `${slotRow(slot) + 1}, ${slotCol(slot) + 1}`;
}
