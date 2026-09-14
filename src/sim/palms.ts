/**
 * Per-block palm storage and the stage function (§3.6.1, §4.4).
 *
 * Palms are struct-of-arrays over the block's slots. Growth is accumulated
 * growth-days; the stage is a threshold on that, except senescence, which is
 * calendar age — palms get tall whether or not they grew well.
 */

import { FOREST_GROWTH, GROWTH } from './balance/growth.ts';
import { SLOTS_PER_BLOCK } from './balance/world.ts';
import type { GrowthStage, PalmArrays, Species, Tick } from './types.ts';

export function createPalmArrays(slots: number = SLOTS_PER_BLOCK): PalmArrays {
  return {
    plantedAt: new Int32Array(slots).fill(-1),
    growth: new Float32Array(slots),
    health: new Uint8Array(slots),
    ganoderma: new Uint8Array(slots),
    yieldAcc: new Float32Array(slots),
  };
}

/** Plant the first `count` empty slots. Returns how many were planted. */
export function plantSlots(palms: PalmArrays, count: number, tick: Tick): number {
  let planted = 0;
  for (let i = 0; i < palms.plantedAt.length && planted < count; i++) {
    if (palms.plantedAt[i] !== -1) continue;
    palms.plantedAt[i] = tick;
    palms.growth[i] = 0;
    palms.health[i] = 255;
    palms.ganoderma[i] = 0;
    palms.yieldAcc[i] = 0;
    planted += 1;
  }
  return planted;
}

export function ageInYears(plantedAt: Tick, tick: Tick): number {
  return (tick - plantedAt) / GROWTH.daysPerYear;
}

/**
 * The stage a palm (or reforested tree) is in.
 *
 * `ganoderma === 3` and zero health are both "dead"; senescence is by calendar
 * age; everything else is by accumulated growth-days.
 */
export function stageOf(
  species: Species,
  growthDays: number,
  ageDays: number,
  health: number,
  ganoderma: number,
): GrowthStage {
  if (health <= 0 || ganoderma === 3) return 'dead';

  if (species === 'forest') {
    if (growthDays >= FOREST_GROWTH.matureDays) return 'mature';
    if (growthDays >= FOREST_GROWTH.saplingDays) return 'immature';
    return 'seedling';
  }

  const ageYears = ageDays / GROWTH.daysPerYear;
  if (ageYears >= GROWTH.deadYears) return 'dead';
  if (ageYears >= GROWTH.senileYears) return 'senile';
  if (growthDays >= GROWTH.immatureDays) return 'mature';
  if (growthDays >= GROWTH.seedlingDays) return 'immature';
  return 'seedling';
}

export function slotStage(
  palms: PalmArrays,
  slot: number,
  species: Species,
  tick: Tick,
): GrowthStage {
  const plantedAt = palms.plantedAt[slot]!;
  if (plantedAt < 0) return 'empty';
  return stageOf(
    species,
    palms.growth[slot]!,
    tick - plantedAt,
    palms.health[slot]!,
    palms.ganoderma[slot]!,
  );
}

/** Palms that bear fruit. */
export function isBearing(stage: GrowthStage): boolean {
  return stage === 'mature' || stage === 'senile';
}
