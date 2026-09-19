import { clamp01, mod } from '@shared/math';

import { ASH, HAZE } from '../balance/events.ts';
import { FIRE } from '../balance/fire.ts';
import { SEASONS, SKY, isWetSeason } from '../balance/seasons.ts';
import { ASH_EVENT, HAZE_EVENT, activeEvent, isWildfire } from '../fire.ts';
import { chance, forkRng, nextGaussian, nextInt, pickWeighted, type RngState } from '../rng.ts';
import type { SimContext } from '../state.ts';
import type { ClimateRegime, SkyCondition } from '../types.ts';

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

  let sun = 1 - SEASONS.cloudPerRain * w.rain;

  if (activeEvent(state, HAZE_EVENT)) sun *= isWildfire(state) ? FIRE.hazeLight : HAZE.light;
  if (activeEvent(state, ASH_EVENT)) sun *= ASH.light;
  w.sun = clamp01(sun);

  // A dry spell can still end in thunder, and those are the storms that burn.
  const dryStorm =
    w.dryStreak >= SKY.dryStormStreak &&
    w.rain >= SKY.dryStormRain &&
    w.rain < SKY.stormAbove &&
    chance(state.rng, SKY.dryStormChance);
  // The sky changes in spells of a few days, not every morning; thunder is the exception.
  const today = dryStorm ? 'storm' : skyFor(w.rain);

  if (today === 'storm' || state.tick >= w.skyUntil || w.sky === 'storm') {
    w.sky = today;

    // Drawn from a side stream: how long the clouds hang about must not
    // reshuffle the rain, the prices or where the lightning lands.
    const spellRng = forkRng(state.seed ^ SKY.stream, state.tick);
    const spell = SKY.spellDays.min + nextInt(spellRng, SKY.spellDays.max - SKY.spellDays.min + 1);

    w.skyUntil = state.tick + spell;
  }

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

/** The day's sky from its rain: clear, cloudy, raining, or a thunderstorm. */
export function skyFor(rain: number): SkyCondition {
  if (rain >= SKY.stormAbove) return 'storm';
  if (rain >= SKY.rainAbove) return 'rain';
  if (rain >= SKY.cloudyAbove) return 'cloudy';
  return 'clear';
}

/** Weighted roll with a bonus for last year's regime, so regimes cluster. */
export function rollRegime(rng: RngState, previous: ClimateRegime): ClimateRegime {
  const weights = REGIMES.map(
    (r) => SEASONS.regime.weights[r] + (r === previous ? SEASONS.regime.persistence : 0),
  );

  return REGIMES[pickWeighted(rng, weights)] ?? 'normal';
}
