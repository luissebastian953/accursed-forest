/**
 * Fire mechanics shared by the burn command and the world-events system
 * (§3.1.1, §3.6): what counts as fuel, igniting, finishing, extinguishing,
 * and the wildfire transition.
 */

import { BIOMES } from './balance/biomes.ts';
import { FIRE } from './balance/fire.ts';
import type { EventSink } from './events.ts';
import { writeBlock, type SimContext } from './state.ts';
import type { ActiveEvent, Block, BlockId, FireIntensity, SimState } from './types.ts';

export const WILDFIRE_EVENT = 'wildfire';
export const HAZE_EVENT = 'haze';

export function activeEvent(state: SimState, id: string): ActiveEvent | undefined {
  return state.weather.activeEvents.find((e) => e.id === id);
}

export function isWildfire(state: SimState): boolean {
  return activeEvent(state, WILDFIRE_EVENT) !== undefined;
}

/**
 * Can this block catch? Wild vegetation and debris piles always; standing
 * palms only once the fire is a wildfire (§3.1.1). Water and buildings never.
 */
export function isFuel(block: Readonly<Block>, wildfire: boolean): boolean {
  if (block.burning) return false;
  switch (block.phase) {
    case 'wild':
      return block.biome !== 'river' && block.biome !== 'village';
    case 'cleared':
      return block.debris >= FIRE.debrisFuelMin;
    case 'planted':
    case 'reforesting':
      return wildfire;
    case 'clearing':
      return BIOMES[block.biome].clearable && block.debris >= FIRE.debrisFuelMin / 2;
    case 'kopdes':
      return false;
  }
}

/**
 * Fuel richness: wet ground resists, debris piles feed. Riverbanks and wet
 * forest are the natural firebreaks; dry scrub and grass carry a fire.
 */
export function fuelFactor(block: Readonly<Block>): number {
  // Soil moisture is not fuel dryness: dry-season ground at ~0.4 carries a
  // fire well, riverbanks and irrigated blocks above ~0.7 do not.
  const dryness = Math.pow(
    Math.min(1, Math.max(0, (FIRE.fuelWetAt - block.moisture) / FIRE.fuelDryRange)),
    FIRE.moistureResistance,
  );
  const debris =
    block.phase === 'cleared' || block.phase === 'clearing'
      ? 1 + (block.debris / 100) * FIRE.debrisFuel
      : 1;
  return dryness * debris;
}

/** Set a block alight. Materialises it into the sparse map. */
export function ignite(ctx: SimContext, id: BlockId, intensity: FireIntensity): Block {
  const block = writeBlock(ctx.state, ctx.world, id);
  block.burning = true;
  block.fireIntensity = intensity;
  block.clearProgress = 0;
  return block;
}

/** The fire has consumed the block: it is cleared, ashed, and any palms are gone. */
export function finishBurn(ctx: SimContext, block: Block): void {
  const { state, events } = ctx;
  const palms = state.palms.get(block.id);
  if (palms) {
    let count = 0;
    for (const t of palms.plantedAt) if (t >= 0) count += 1;
    state.palms.delete(block.id);
    block.debris = Math.min(100, block.debris + FIRE.debrisFromBurnedPalms);
    block.lastHarvest = -1;
    events.push({ type: 'PalmsBurned', block: block.id, count });
  }

  block.burning = false;
  block.fireIntensity = 0;
  block.clearProgress = 1;
  block.phase = 'cleared';
  block.debris = Math.min(100, Math.max(FIRE.debrisAfterBurn, block.debris * 0.25));
  block.ashUntil = state.tick + FIRE.ashDays;
  events.push({ type: 'BurnFinished', block: block.id });
  events.push({ type: 'BlockCleared', block: block.id });
  events.push({ type: 'BlockChanged', block: block.id });
}

/** Rain got there first. A half-burned block still counts as cleared. */
export function extinguish(ctx: SimContext, block: Block): void {
  if (block.clearProgress >= 0.5) {
    finishBurn(ctx, block);
    ctx.events.push({ type: 'FireExtinguished', block: block.id });
    return;
  }
  block.burning = false;
  block.fireIntensity = 0;
  block.clearProgress = 0;
  block.debris = Math.min(100, block.debris + FIRE.debrisFromExtinguished);
  ctx.events.push({ type: 'FireExtinguished', block: block.id });
  ctx.events.push({ type: 'BlockChanged', block: block.id });
}

/**
 * Pressure crossed the line: the fire stops being yours (§3.1.1). Every burn
 * escalates to full intensity, palms become fuel, and the smoke event begins.
 */
export function startWildfire(state: SimState, events: EventSink): void {
  if (isWildfire(state)) return;
  const tick = state.tick;
  state.weather.activeEvents.push({ id: WILDFIRE_EVENT, startedAt: tick, endsAt: tick + 1 });
  state.weather.activeEvents.push({
    id: HAZE_EVENT,
    startedAt: tick,
    endsAt: tick + FIRE.hazeTailDays,
  });
  for (const block of state.blocks.values()) {
    if (block.burning) block.fireIntensity = 3;
  }
  events.push({ type: 'WildfireStarted' });
}

export function burningBlocks(state: SimState): Block[] {
  const out: Block[] = [];
  for (const block of state.blocks.values()) if (block.burning) out.push(block);
  return out;
}
