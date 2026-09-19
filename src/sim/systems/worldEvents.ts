import { BIOMES } from '../balance/biomes.ts';
import {
  ASH,
  DECK,
  DECK_EVENTS,
  DROUGHT,
  FLOOD,
  HAZE,
  type DeckEventId,
} from '../balance/events.ts';
import { FIRE } from '../balance/fire.ts';
import { LIGHTNING, isWetSeason } from '../balance/seasons.ts';
import { MACRO_PREFIX } from '../balance/society.ts';
import {
  ASH_EVENT,
  DROUGHT_EVENT,
  FLOOD_EVENT,
  HAZE_EVENT,
  WILDFIRE_EVENT,
  activeEvent,
  burningBlocks,
  extinguish,
  fuelFactor,
  ignite,
  isFuel,
  isNaturalFire,
  isWildfire,
} from '../fire.ts';
import { landslideChance, slide } from '../landscape.ts';
import { isYoung, slotStage } from '../palms.ts';
import { chance, nextFloat, nextInt, pickWeighted } from '../rng.ts';
import { neighbourIds, readBlock, writeBlock, type SimContext } from '../state.ts';
import type { ActiveEvent, BlockId } from '../types.ts';

/** Per-neighbour daily ignition chance is never a certainty. */
const SPREAD_CAP = 0.9;

const DECK_IDS: readonly DeckEventId[] = ['haze', 'ash', 'flood'];

export function worldEvents(ctx: SimContext): void {
  const { state } = ctx;
  const tick = state.tick;
  const weather = state.weather;

  drawFromDeck(ctx);
  updateDrought(ctx);

  if (activeEvent(state, FLOOD_EVENT)) applyFlood(ctx);
  if (activeEvent(state, ASH_EVENT)) applyAsh(ctx);
  if (activeEvent(state, DROUGHT_EVENT) && weather.regime === 'elNino') maybeSpark(ctx);

  rollLandslides(ctx);
  if (weather.sky === 'storm') strikeLightning(ctx);
  fire(ctx);

  // ── Expire what has run its course, with its after-effects ─────────────
  // Macro-economic events share the list; the society system expires and announces those.
  const ending = weather.activeEvents.filter(
    (e) =>
      e.id !== WILDFIRE_EVENT &&
      e.id !== DROUGHT_EVENT &&
      !e.id.startsWith(MACRO_PREFIX) &&
      e.endsAt <= tick,
  );
  for (const event of ending) endEvent(ctx, event);
  weather.activeEvents = weather.activeEvents.filter(
    (e) =>
      e.id === WILDFIRE_EVENT ||
      e.id === DROUGHT_EVENT ||
      e.id.startsWith(MACRO_PREFIX) ||
      e.endsAt > tick,
  );
}

// ── The deck ──────────────────────────────────────────────────────────────

function drawFromDeck(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;
  if (tick === 0 || tick % DECK.drawEveryDays !== 0) return;
  if (!chance(state.rng, DECK.drawChance)) return;

  const wet = isWetSeason(state.weather.dayOfYear);
  const weights = DECK_IDS.map((id) => {
    const spec = DECK_EVENTS[id];
    if (activeEvent(state, id)) return 0;
    if (spec.season === 'wet' && !wet) return 0;
    if (spec.season === 'dry' && wet) return 0;
    let w = spec.weight * spec.regimeWeight[state.weather.regime];
    if (id === 'haze') w *= 1 + state.society.firePressure * HAZE.weightPerFirePressure;
    return w;
  });

  const claimed = weights.reduce((a, b) => a + b, 0);
  const index = pickWeighted(state.rng, [...weights, Math.max(0, DECK.referenceWeight - claimed)]);
  const id = DECK_IDS[index];
  if (id === undefined) return;

  const spec = DECK_EVENTS[id];
  const days = spec.days.min + nextInt(state.rng, spec.days.max - spec.days.min + 1);
  const event: ActiveEvent = { id, startedAt: tick, endsAt: tick + days };
  if (id === 'flood') event.blocks = floodedBlocks(ctx);
  state.weather.activeEvents.push(event);
  events.push({ type: 'WeatherEventStarted', id, days });
}

function endEvent(ctx: SimContext, event: ActiveEvent): void {
  const { state, events } = ctx;
  if (event.id === ASH_EVENT) {
    // Ash is a real fertilizer once it stops falling (§3.6).
    let settled = 0;
    for (const block of state.blocks.values()) {
      if (!block.owned) continue;
      block.ashUntil = Math.max(block.ashUntil, state.tick + ASH.fertileDays);
      settled += 1;
    }
    events.push({ type: 'AshSettled', blocks: settled });
  }
  events.push({ type: 'WeatherEventEnded', id: event.id });
}

// ── Drought ───────────────────────────────────────────────────────────────

function updateDrought(ctx: SimContext): void {
  const { state, events } = ctx;
  const weather = state.weather;
  const drought = activeEvent(state, DROUGHT_EVENT);

  if (!drought && weather.dryStreak >= DROUGHT.onAtDryStreak) {
    weather.activeEvents.push({ id: DROUGHT_EVENT, startedAt: state.tick, endsAt: state.tick + 1 });
    events.push({ type: 'WeatherEventStarted', id: DROUGHT_EVENT, days: 0 });
  } else if (drought && weather.rain >= DROUGHT.breaksAtRain) {
    weather.activeEvents = weather.activeEvents.filter((e) => e.id !== DROUGHT_EVENT);
    events.push({ type: 'WeatherEventEnded', id: DROUGHT_EVENT });
    return;
  }

  if (!activeEvent(state, DROUGHT_EVENT)) return;
  activeEvent(state, DROUGHT_EVENT)!.endsAt = state.tick + 1;
  for (const block of state.blocks.values()) {
    if (!state.active.has(block.id) || block.irrigated) continue;
    block.moisture = Math.max(0, block.moisture - DROUGHT.moistureLossPerDay);
  }
}

function maybeSpark(ctx: SimContext): void {
  const { state, events } = ctx;
  if (!chance(state.rng, DROUGHT.sparkPerDay)) return;

  const piles: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (state.active.has(block.id) && isFuel(block, false) && block.debris >= FIRE.debrisFuelMin)
      piles.push(block.id);
  }
  if (piles.length === 0) return;
  // Sorted for the same reason as the lightning targets: a restored save
  // iterates the sparse map in a different order.
  piles.sort((a, b) => a - b);
  const target = piles[nextInt(state.rng, piles.length)]!;
  ignite(ctx, target, 1, true);
  events.push({ type: 'SparkCaught', block: target });
  events.push({ type: 'BlockChanged', block: target });
}

// ── Flood ─────────────────────────────────────────────────────────────────

/** Low ground by the river, not drained. Riverbank floods first (§3.1). */
function floodedBlocks(ctx: SimContext): BlockId[] {
  const { state, world } = ctx;
  const out: BlockId[] = [];
  for (const id of state.active) {
    const block = readBlock(state, world, id);
    if (block.drained || block.biome === 'river' || block.phase === 'kopdes') continue;
    if (block.elevation > FLOOD.maxElevation) continue;
    const distance = world.rivers.distance[id] ?? Infinity;
    if (distance <= FLOOD.riverDistance) out.push(id);
  }
  return out;
}

function applyFlood(ctx: SimContext): void {
  const { state, world, events } = ctx;
  const flood = activeEvent(state, FLOOD_EVENT)!;
  const first = flood.startedAt === state.tick;

  for (const id of flood.blocks ?? []) {
    const block = writeBlock(state, world, id);
    if (block.drained) continue;
    if (first) events.push({ type: 'BlockFlooded', block: id });
    block.moisture = 1;
    block.fertilizedUntil = Math.min(block.fertilizedUntil, state.tick); // washed out
    block.debris = Math.min(100, block.debris + FLOOD.debrisPerDay);

    const palms = state.palms.get(id);
    if (!palms || block.species !== 'palm') continue;
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;
      const stage = slotStage(palms, slot, 'palm', state.tick);
      if (!isYoung(stage)) continue;
      const health = Math.max(0, palms.health[slot]! - FLOOD.immatureDamagePerDay);
      palms.health[slot] = health;
      if (health === 0) events.push({ type: 'PalmDied', block: id, slot, cause: 'flood' });
    }
  }
}

// ── Ash ───────────────────────────────────────────────────────────────────

function applyAsh(ctx: SimContext): void {
  const { state, events } = ctx;
  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);
    if (!block || block.species !== 'palm') continue;
    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;
      if (!isYoung(slotStage(palms, slot, 'palm', state.tick))) continue;
      const health = Math.max(0, palms.health[slot]! - ASH.immatureDamagePerDay);
      palms.health[slot] = health;
      if (health === 0) events.push({ type: 'PalmDied', block: id, slot, cause: 'ash' });
    }
  }
}

// ── Lightning (§3.6) ──────────────────────────────────────────────────────

/**
 * A thunderstorm throws bolts at the estate and the land around it. Most hit
 * wet ground and do nothing but light up the sky; one in four finds something
 * that will burn, and unless it is pouring, that is a fire nobody lit; no
 * pressure on the meter, and nothing for the authorities to read into it.
 */
function strikeLightning(ctx: SimContext): void {
  const { state, world, events } = ctx;
  if (!chance(state.rng, LIGHTNING.strikeChance)) return;

  const strikes = 1 + nextInt(state.rng, LIGHTNING.maxStrikes);
  for (let i = 0; i < strikes; i++) {
    const id = strikeTarget(ctx);
    if (id === null) continue;
    const block = readBlock(state, world, id);
    const ignited =
      state.weather.rain < LIGHTNING.soakedAbove &&
      block.moisture < LIGHTNING.soakedGround &&
      !block.burning &&
      isFuel(block, isWildfire(state)) &&
      chance(state.rng, LIGHTNING.igniteChance);
    if (ignited) {
      ignite(ctx, id, 1, true);
      events.push({ type: 'BlockChanged', block: id });
    }
    events.push({ type: 'LightningStruck', block: id, ignited });
  }
}

/**
 * Where a bolt lands: anywhere over the estate's box, widened by the storm's
 * reach. Drawing from the box rather than a list of blocks keeps this O(1) on
 * a storm day, and independent of the order the sparse map happens to be in;
 * a restored save must throw its bolts at the same places.
 */
function strikeTarget(ctx: SimContext): BlockId | null {
  const { state, world } = ctx;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const block of state.blocks.values()) {
    if (!block.owned) continue;
    const [x, y] = world.toXY(block.id);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (minX === Infinity) return null;

  const r = LIGHTNING.reach;
  const x0 = Math.max(0, minX - r);
  const x1 = Math.min(world.width - 1, maxX + r);
  const y0 = Math.max(0, minY - r);
  const y1 = Math.min(world.height - 1, maxY + r);

  for (let attempt = 0; attempt < 6; attempt++) {
    const x = x0 + nextInt(state.rng, x1 - x0 + 1);
    const y = y0 + nextInt(state.rng, y1 - y0 + 1);
    const id = world.toId(x, y);
    if (readBlock(state, world, id).biome !== 'river') return id;
  }
  return null;
}

// ── Landslides ────────────────────────────────────────────────────────────

function rollLandslides(ctx: SimContext): void {
  const { state, world, events } = ctx;
  const wet = isWetSeason(state.weather.dayOfYear);
  if (!wet) return;

  const candidates: BlockId[] = [];
  for (const id of state.active) {
    const block = readBlock(state, world, id);
    if (!block.slope) continue;
    // Only land someone has touched can slide in play; untouched hills are forest.
    if (!state.blocks.has(id)) continue;
    candidates.push(id);
  }
  for (const id of candidates) {
    const block = readBlock(state, world, id);
    if (nextFloat(state.rng) < landslideChance(state, world, block, wet))
      slide(state, world, events, id);
  }
}

// ── Fire: rain, spread, pressure, the wildfire's lifetime ────────────────

function fire(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;
  const weather = state.weather;

  state.society.firePressure = Math.max(0, state.society.firePressure - FIRE.pressureDecayPerDay);

  const burning = burningBlocks(state);
  const wildfire = isWildfire(state);
  const sustainedRain = weather.wetStreak >= FIRE.extinguishWetStreak;

  for (const block of burning) {
    if (sustainedRain && chance(state.rng, FIRE.extinguishPerDay)) {
      extinguish(ctx, block);
      continue;
    }

    // An act of God burns its own block and stops; only a lit match travels.
    if (isNaturalFire(state, block.id)) continue;
    const spread = wildfire
      ? FIRE.wildfireSpreadPerDay * FIRE.wildfireRegimeMultiplier[weather.regime]
      : (FIRE.spreadPerDay[block.fireIntensity as 1 | 2 | 3] ?? 0) *
        FIRE.regimeSpreadMultiplier[weather.regime];
    if (spread <= 0) continue;

    for (const neighbourId of neighbourIds(ctx.world, block.id)) {
      const neighbour = readBlock(state, ctx.world, neighbourId);
      if (!isFuel(neighbour, wildfire)) continue;
      // A controlled burn reaches into standing forest far more readily than
      // across grass: that is what the crews are for, and what the letters are about.
      const forest = !wildfire && BIOMES[neighbour.biome].forestCover ? FIRE.forestSpreadFactor : 1;
      if (!chance(state.rng, Math.min(SPREAD_CAP, spread * forest * fuelFactor(neighbour))))
        continue;
      const intensity = wildfire ? 3 : block.fireIntensity === 0 ? 1 : block.fireIntensity;
      ignite(ctx, neighbourId, intensity);
      events.push({ type: 'FireSpread', from: block.id, to: neighbourId });
      events.push({ type: 'BlockChanged', block: neighbourId });
    }
  }

  const blaze = activeEvent(state, WILDFIRE_EVENT);
  if (blaze) {
    if (burningBlocks(state).length > 0) {
      blaze.endsAt = tick + 1;
      const haze = activeEvent(state, HAZE_EVENT);
      if (haze) haze.endsAt = Math.max(haze.endsAt, tick + FIRE.hazeTailDays);
    } else {
      weather.activeEvents = weather.activeEvents.filter((e) => e.id !== WILDFIRE_EVENT);
      events.push({ type: 'WildfireEnded' });
    }
  }
}
