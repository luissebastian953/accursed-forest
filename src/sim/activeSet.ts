import type { SimState } from './types.ts';
import type { World } from './worldgen/index.ts';

export function rebuildActiveSet(state: SimState, world: World): void {
  const active = state.active;
  active.clear();

  for (const block of state.blocks.values()) {
    const busy =
      block.owned ||
      block.burning ||
      block.debris > 0 ||
      block.beetles > 0 ||
      block.phase !== 'wild';
    if (!busy) continue;

    active.add(block.id);

    if (block.owned) {
      const [x, y] = world.toXY(block.id);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (world.inBounds(nx, ny)) active.add(world.toId(nx, ny));
        }
      }
    }
  }
}
