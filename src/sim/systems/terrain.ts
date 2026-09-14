/**
 * Terrain system (§3.1): clearing progress and debris decay.
 */

import { BIOMES } from '../balance/biomes.ts';
import { DEBRIS } from '../balance/pests.ts';
import type { SimContext } from '../state.ts';

export function terrain(ctx: SimContext): void {
  const { state, events } = ctx;

  for (const block of state.blocks.values()) {
    if (!state.active.has(block.id)) continue;

    if (block.phase === 'clearing') {
      const spec = BIOMES[block.biome];
      block.clearProgress += 1 / Math.max(1, spec.chopDays);

      if (block.clearProgress >= 1) {
        block.clearProgress = 1;
        block.phase = 'cleared';
        block.debris = Math.min(100, block.debris + spec.chopDebris);
        events.push({ type: 'BlockCleared', block: block.id });
      }
      events.push({ type: 'BlockChanged', block: block.id });
      continue;
    }

    if (block.debris > 0) {
      block.debris = Math.max(0, block.debris - DEBRIS.decayPerDay);
    }
  }
}
