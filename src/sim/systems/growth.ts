/**
 * Growth system (§3.6.1).
 *
 * Each tick a palm gains `G` growth-days, where
 *
 *     G = light × moistureCurve(moisture) × fertility × stress
 *
 * The first three factors are per block; stress is per palm (health, and in
 * M1d the pest stages). Stage thresholds live in `palms.ts`; yield accumulates
 * on bearing palms at the same rate, so a hazy round is visibly lighter.
 */

import { clamp, sampleCurve } from '@shared/math';

import { BIOMES } from '../balance/biomes.ts';
import {
  GROWTH_FACTORS,
  HARVEST_ROTATION_DAYS,
  MOISTURE_CURVE,
  YIELD_CURVE,
} from '../balance/growth.ts';
import { ageInYears, isBearing, stageOf } from '../palms.ts';
import type { SimContext } from '../state.ts';
import type { Block, SimState } from '../types.ts';

/** Fertility multiplier while a fertilizer or ash window is open. */
const FERTILIZER_BONUS = 1.2;
const ASH_BONUS = 1.2;

/** The per-block part of `G`: light × moisture × fertility, each clamped (§3.6.1). */
export function growthMultiplier(state: SimState, block: Readonly<Block>): number {
  const { light, moisture, fertility } = GROWTH_FACTORS;

  const lightFactor = clamp(state.weather.sun, light.min, light.max);
  const moistureFactor = clamp(
    sampleCurve(MOISTURE_CURVE, block.moisture),
    moisture.min,
    moisture.max,
  );

  const spec = BIOMES[block.biome];
  // Irrigation lifts the dry-scrub penalty (§3.1).
  let fertilityFactor = block.irrigated && block.biome === 'scrub' ? 1 : spec.fertility;
  if (block.fertilizedUntil > state.tick) fertilityFactor *= FERTILIZER_BONUS;
  if (block.ashUntil > state.tick) fertilityFactor *= ASH_BONUS;
  fertilityFactor = clamp(fertilityFactor, fertility.min, fertility.max);

  return lightFactor * moistureFactor * fertilityFactor;
}

export function growth(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;

  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);
    if (!block || (block.phase !== 'planted' && block.phase !== 'reforesting')) continue;
    // A burning block grows nothing; its palms are about to be debris.
    if (block.burning) continue;

    const blockG = growthMultiplier(state, block);
    const species = block.species;

    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      const plantedAt = palms.plantedAt[slot]!;
      if (plantedAt < 0) continue;

      const health = palms.health[slot]!;
      const ganoderma = palms.ganoderma[slot]!;
      const ageDays = tick - plantedAt;

      const before = stageOf(species, palms.growth[slot]!, ageDays, health, ganoderma);
      if (before === 'dead') continue;

      const stress = clamp(health / 255, GROWTH_FACTORS.stress.min, GROWTH_FACTORS.stress.max);
      const g = blockG * stress;
      palms.growth[slot] = palms.growth[slot]! + g;

      const after = stageOf(species, palms.growth[slot]!, ageDays, health, ganoderma);
      if (after !== before) {
        events.push({ type: 'PalmStageChanged', block: id, slot, from: before, to: after });
      }

      if (species === 'palm' && isBearing(after)) {
        const perRound = sampleCurve(YIELD_CURVE, ageInYears(plantedAt, tick));
        palms.yieldAcc[slot] = palms.yieldAcc[slot]! + (perRound / HARVEST_ROTATION_DAYS) * g;
      }
    }
  }
}
