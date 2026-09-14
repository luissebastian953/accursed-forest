/**
 * World events system (§3.6): fire spread, extinguishing, fire pressure and
 * the wildfire's lifetime. The event deck itself (haze, ash, flood, drought,
 * landslide draws) arrives in M1e; the wildfire and its smoke are here
 * because burning is M1c's decision and its consequences must bite now.
 */

import { FIRE } from '../balance/fire.ts';
import {
  HAZE_EVENT,
  WILDFIRE_EVENT,
  activeEvent,
  burningBlocks,
  extinguish,
  fuelFactor,
  ignite,
  isFuel,
  isWildfire,
} from '../fire.ts';
import { chance } from '../rng.ts';
import { neighbourIds, readBlock, type SimContext } from '../state.ts';

/** Per-neighbour daily ignition chance is never a certainty. */
const SPREAD_CAP = 0.9;

export function worldEvents(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;
  const weather = state.weather;

  // ── Pressure decays; a quiet season forgets a medium burn ──────────────
  state.society.firePressure = Math.max(0, state.society.firePressure - FIRE.pressureDecayPerDay);

  // ── Fires: rain, then spread ────────────────────────────────────────────
  const burning = burningBlocks(state);
  const wildfire = isWildfire(state);
  const sustainedRain = weather.wetStreak >= FIRE.extinguishWetStreak;

  for (const block of burning) {
    if (sustainedRain && chance(state.rng, FIRE.extinguishPerDay)) {
      extinguish(ctx, block);
      continue;
    }

    const spread = wildfire
      ? FIRE.wildfireSpreadPerDay * FIRE.wildfireRegimeMultiplier[weather.regime]
      : (FIRE.spreadPerDay[block.fireIntensity as 1 | 2 | 3] ?? 0) *
        FIRE.regimeSpreadMultiplier[weather.regime];
    if (spread <= 0) continue;

    for (const neighbourId of neighbourIds(ctx.world, block.id)) {
      const neighbour = readBlock(state, ctx.world, neighbourId);
      if (!isFuel(neighbour, wildfire)) continue;
      if (!chance(state.rng, Math.min(SPREAD_CAP, spread * fuelFactor(neighbour)))) continue;
      const intensity = wildfire ? 3 : block.fireIntensity === 0 ? 1 : block.fireIntensity;
      ignite(ctx, neighbourId, intensity);
      events.push({ type: 'FireSpread', from: block.id, to: neighbourId });
      events.push({ type: 'BlockChanged', block: neighbourId });
    }
  }

  // ── Wildfire lifetime: lives while anything burns; smoke lingers after ──
  const fire = activeEvent(state, WILDFIRE_EVENT);
  if (fire) {
    if (burningBlocks(state).length > 0) {
      fire.endsAt = tick + 1;
      const haze = activeEvent(state, HAZE_EVENT);
      if (haze) haze.endsAt = tick + FIRE.hazeTailDays;
    } else {
      weather.activeEvents = weather.activeEvents.filter((e) => e.id !== WILDFIRE_EVENT);
      events.push({ type: 'WildfireEnded' });
    }
  }

  // ── Expire everything else that has run its course ──────────────────────
  weather.activeEvents = weather.activeEvents.filter(
    (e) => e.id === WILDFIRE_EVENT || e.endsAt > tick,
  );
}
