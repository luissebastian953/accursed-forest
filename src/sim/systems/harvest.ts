/**
 * Harvest system (§2, §3.3): ripeness and rot.
 *
 * A block's harvest clock starts the day its first palm bears fruit; the block
 * is ripe every `HARVEST_ROTATION_DAYS` after the last round. Fruit left on
 * the tree past ~1.5 rounds' worth rots — the cap keeps a neglected block from
 * banking a year of yield. Harvesting itself is a command (`HarvestBlock`):
 * manual per block, as §2 says, until auto-harvest arrives as an upgrade.
 */

import { sampleCurve } from '@shared/math';

import { HARVEST_ROTATION_DAYS, YIELD_CURVE } from '../balance/growth.ts';
import { HARVEST } from '../balance/prices.ts';
import { ageInYears, isBearing, slotStage } from '../palms.ts';
import type { SimContext } from '../state.ts';
import type { Block, PalmArrays, Species, Tick } from '../types.ts';

export function isRipe(block: Readonly<Block>, tick: Tick): boolean {
  return block.lastHarvest >= 0 && tick - block.lastHarvest >= HARVEST_ROTATION_DAYS;
}

/** Days until the next round, 0 if ripe now, null if the clock has not started. */
export function daysUntilRipe(block: Readonly<Block>, tick: Tick): number | null {
  if (block.lastHarvest < 0) return null;
  return Math.max(0, HARVEST_ROTATION_DAYS - (tick - block.lastHarvest));
}

/** Palms on the block that are old enough to bear fruit. */
export function bearingCount(palms: PalmArrays, species: Species, tick: Tick): number {
  let n = 0;
  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    if (isBearing(slotStage(palms, slot, species, tick))) n += 1;
  }
  return n;
}

/** Kilograms waiting on the bearing palms of a block. */
export function harvestableKg(palms: PalmArrays, species: Species, tick: Tick): number {
  let kg = 0;
  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    if (isBearing(slotStage(palms, slot, species, tick))) kg += palms.yieldAcc[slot]!;
  }
  return kg;
}

export function harvest(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;

  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);
    if (!block || block.phase !== 'planted' || block.species !== 'palm') continue;

    let bearing = false;
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      const plantedAt = palms.plantedAt[slot]!;
      if (plantedAt < 0) continue;
      if (!isBearing(slotStage(palms, slot, 'palm', tick))) continue;
      bearing = true;

      // Rot: fruit does not wait on the tree forever.
      const cap = sampleCurve(YIELD_CURVE, ageInYears(plantedAt, tick)) * HARVEST.overripeCapRounds;
      if (palms.yieldAcc[slot]! > cap) palms.yieldAcc[slot] = cap;
    }

    if (!bearing) continue;

    if (block.lastHarvest < 0) {
      block.lastHarvest = tick;
      continue;
    }
    if (tick - block.lastHarvest === HARVEST_ROTATION_DAYS) {
      events.push({ type: 'BlockRipe', block: id });
    }
  }
}
