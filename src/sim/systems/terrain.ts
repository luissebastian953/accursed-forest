import { BIOMES } from '../balance/biomes.ts';
import { FIRE } from '../balance/fire.ts';
import { DEBRIS } from '../balance/pests.ts';
import { TIMBER_VALUE } from '../balance/prices.ts';
import { finishBurn } from '../fire.ts';
import { earn, type SimContext } from '../state.ts';

export function terrain(ctx: SimContext): void {
  const { state, events } = ctx;

  for (const block of state.blocks.values()) {
    if (!state.active.has(block.id)) continue;

    if (block.burning) {
      const days = FIRE.burnDays[block.fireIntensity as 1 | 2 | 3] ?? FIRE.burnDays[1];
      block.clearProgress += 1 / days;
      // 1/7 added seven times lands at 0.9999…: compare with slack.
      if (block.clearProgress >= 1 - 1e-9) finishBurn(ctx, block);
      else events.push({ type: 'BlockChanged', block: block.id });
      continue;
    }

    if (block.phase === 'clearing') {
      const spec = BIOMES[block.biome];
      block.clearProgress += 1 / Math.max(1, spec.chopDays);

      if (block.clearProgress >= 1 - 1e-9) {
        block.clearProgress = 1;
        block.phase = 'cleared';
        block.debris = Math.min(100, block.debris + spec.chopDebris);
        events.push({ type: 'BlockCleared', block: block.id });
        if (spec.forestCover) events.push({ type: 'ForestChopped', block: block.id });

        // The timber partly offsets the crew's wages (GDD 3.1.1).
        const revenue = TIMBER_VALUE[block.biome];
        if (revenue !== undefined && revenue > 0) {
          earn(state, revenue, 'sale', `timber: block ${block.id}`);
          events.push({ type: 'TimberSold', block: block.id, revenue });
          events.push({ type: 'CashChanged', cash: state.economy.cash });
        }
      }
      events.push({ type: 'BlockChanged', block: block.id });
      continue;
    }

    // The crew digging a slide out: when they are done the spoil goes, the
    // debris with it, and the scar comes off the map.
    if (block.excavateUntil >= 0) {
      if (state.tick >= block.excavateUntil) {
        block.excavateUntil = -1;
        block.landslideAt = -1;
        block.landslidePalms = 0;
        block.debris = 0;
        events.push({ type: 'BlockExcavated', block: block.id });
        events.push({ type: 'BlockChanged', block: block.id });
      }
      continue;
    }

    if (block.debris > 0) {
      block.debris = Math.max(0, block.debris - DEBRIS.decayPerDay);
    }
  }
}
