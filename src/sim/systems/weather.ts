/**
 * Weather system (§3.6). Runs first each tick: everything downstream reads
 * this tick's rain, sun and block moisture.
 *
 * Seasonal baseline only in M1a. Haze and ash attenuation of `sun`, and the
 * event deck, arrive with `worldEvents` in M1e.
 */

import { clamp01, mod } from '@shared/math';

import { SEASONS, isWetSeason } from '../balance/seasons.ts';
import { nextGaussian, pickWeighted, type RngState } from '../rng.ts';
import type { SimContext } from '../state.ts';
import type { ClimateRegime } from '../types.ts';

const REGIMES: readonly ClimateRegime[] = ['normal', 'elNino', 'laNina'];

export function weather(ctx: SimContext): void {
  const { state, events } = ctx;
  const w = state.weather;

  w.dayOfYear = mod(state.tick, SEASONS.daysPerYear);

  if (w.dayOfYear === 0 && state.tick > 0) {
    w.regime = rollRegime(state.rng, w.regime);
    events.push({ type: 'YearPassed', year: state.tick / SEASONS.daysPerYear });
  }

  const season = isWetSeason(w.dayOfYear) ? SEASONS.rain.wet : SEASONS.rain.dry;
  const multiplier = SEASONS.regime.rainMultiplier[w.regime];
  w.rain = clamp01(season.mean * multiplier + nextGaussian(state.rng) * season.sd);
  w.sun = clamp01(1 - SEASONS.cloudPerRain * w.rain);

  w.dryStreak = w.rain < SEASONS.dryStreakBelow ? w.dryStreak + 1 : 0;
  w.wetStreak = w.rain > SEASONS.wetStreakAbove ? w.wetStreak + 1 : 0;

  // Only diverged blocks carry live moisture; untouched land keeps its
  // generated value, which is what makes the sparse map work.
  for (const block of state.blocks.values()) {
    if (!state.active.has(block.id)) continue;
    let m = block.moisture + (w.rain - block.moisture) * SEASONS.moistureRelax;
    if (block.irrigated) m = Math.max(m, SEASONS.irrigationFloor);
    if (block.drained) m = Math.min(m, SEASONS.drainageCeiling);
    block.moisture = clamp01(m);
  }
}

/** Weighted roll with a bonus for last year's regime, so regimes cluster. */
export function rollRegime(rng: RngState, previous: ClimateRegime): ClimateRegime {
  const weights = REGIMES.map(
    (r) => SEASONS.regime.weights[r] + (r === previous ? SEASONS.regime.persistence : 0),
  );
  return REGIMES[pickWeighted(rng, weights)] ?? 'normal';
}
