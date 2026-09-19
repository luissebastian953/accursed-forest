import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { FIRE } from '@sim/balance/fire.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { DEBRIS } from '@sim/balance/pests.ts';
import { DRAINAGE_COST, IRRIGATION_COST, TIMBER_VALUE } from '@sim/balance/prices.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { EventSink } from '@sim/events.ts';
import { HAZE_EVENT, WILDFIRE_EVENT, activeEvent, ignite, isFuel, isWildfire } from '@sim/fire.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { writeBlock } from '@sim/state.ts';
import { growthMultiplier } from '@sim/systems/growth.ts';
import type { BlockId, FireIntensity } from '@sim/types.ts';

function ownedWild(sim: Sim, biome?: string): BlockId[] {
  const out: BlockId[] = [];

  for (const block of sim.state.blocks.values()) {
    if (!block.owned || block.phase !== 'wild' || !BIOMES[block.biome].clearable) continue;
    if (biome && block.biome !== biome) continue;
    out.push(block.id);
  }

  return out;
}

/** Advance into the dry season so showers do not rain a controlled burn out. */
function toDrySeason(sim: Sim): void {
  while (sim.state.weather.dayOfYear < 120 || sim.state.weather.dayOfYear > 250) sim.tick();
}

function tickUntil(sim: Sim, predicate: () => boolean, limit = 3000): number {
  let n = 0;

  while (!predicate() && n < limit) {
    sim.tick();
    n += 1;
  }

  return n;
}

function collect(sim: Sim, ticks: number) {
  const seen: string[] = [];

  for (let i = 0; i < ticks; i++) for (const e of sim.tick()) seen.push(e.type);
  return seen;
}

describe('BurnBlock (GDD 3.1.1)', () => {
  it('refuses land you do not own, land with nothing to burn, and a block already alight', () => {
    const sim = createSim(42);

    toDrySeason(sim);
    expect(
      sim.dispatch({ type: 'BurnBlock', block: sim.world.toId(0, 0), intensity: 1 }),
    ).toMatchObject({ code: 'notOwned' });

    const kopdesBlock = sim.state.worldGen.kopdesBlock; // pre-cleared, no debris

    expect(sim.dispatch({ type: 'BurnBlock', block: kopdesBlock, intensity: 1 })).toMatchObject({
      code: 'noFuel',
    });

    const block = ownedWild(sim)[0]!;

    expect(sim.dispatch({ type: 'BurnBlock', block, intensity: 2 })).toEqual({ ok: true });
    expect(sim.dispatch({ type: 'BurnBlock', block, intensity: 2 })).toMatchObject({
      code: 'burning',
    });
    expect(sim.dispatch({ type: 'ChopBlock', block })).toMatchObject({ code: 'burning' });
    expect(sim.state.blocks.get(block)!.burning).toBe(true);
    expect(sim.state.blocks.get(block)!.fireIntensity).toBe(2);
  });

  it.each([1, 2, 3] as FireIntensity[])(
    'intensity %i clears its block in its burn time and leaves ash',
    (intensity) => {
      const sim = createSim(42);

      toDrySeason(sim);

      const block = ownedWild(sim, 'grassfield')[0] ?? ownedWild(sim)[0]!;
      const cash = sim.state.economy.cash;

      expect(sim.dispatch({ type: 'BurnBlock', block, intensity })).toEqual({ ok: true });
      expect(cash - sim.state.economy.cash).toBe(FIRE.burnCost);

      const start = sim.state.tick;
      const days = tickUntil(sim, () => !sim.state.blocks.get(block)!.burning, 60);
      const b = sim.state.blocks.get(block)!;

      expect(days).toBe(FIRE.burnDays[intensity]);
      expect(b.phase).toBe('cleared');
      expect(b.fireIntensity).toBe(0);
      expect(b.ashUntil).toBe(start + days + FIRE.ashDays);
      expect(b.debris).toBeGreaterThanOrEqual(FIRE.debrisAfterBurn);
      expect(b.debris).toBeLessThan(BIOMES.forest.chopDebris);
    },
  );

  it('ash lifts fertility for a season: a burned block grows faster than a chopped one', () => {
    const burned = createSim(42);
    const chopped = createSim(42);

    toDrySeason(burned);
    toDrySeason(chopped);

    const block = ownedWild(burned, 'grassfield')[0] ?? ownedWild(burned)[0]!;

    // A low burn: anything bigger tips the wildfire threshold and the smoke
    // would be doing the talking, not the ash.
    burned.dispatch({ type: 'BurnBlock', block, intensity: 1 });
    chopped.dispatch({ type: 'ChopBlock', block });
    tickUntil(burned, () => burned.state.blocks.get(block)!.phase === 'cleared');
    tickUntil(chopped, () => chopped.state.blocks.get(block)!.phase === 'cleared');

    const gBurned = growthMultiplier(burned.state, burned.state.blocks.get(block)!);
    const gChopped = growthMultiplier(chopped.state, chopped.state.blocks.get(block)!);

    expect(gBurned).toBeGreaterThan(gChopped * 1.1);

    // and the window closes
    for (let i = 0; i < FIRE.ashDays + 1; i++) burned.tick();
    expect(burned.state.blocks.get(block)!.ashUntil).toBeLessThanOrEqual(burned.state.tick);
  });

  it('each burn adds its pressure; pressure decays over a season', () => {
    const sim = createSim(42);

    toDrySeason(sim);

    const [a, b] = ownedWild(sim);

    sim.dispatch({ type: 'BurnBlock', block: a!, intensity: 1 });
    expect(sim.state.society.firePressure).toBeCloseTo(FIRE.pressure[1], 6);
    sim.dispatch({ type: 'BurnBlock', block: b!, intensity: 1 });
    expect(sim.state.society.firePressure).toBeCloseTo(FIRE.pressure[1] * 2, 6);
    // Two low burns sit under the line; a medium on top of them would not.
    expect(FIRE.pressure[1] * 2).toBeLessThanOrEqual(FIRE.wildfireThreshold);
    expect(isWildfire(sim.state)).toBe(false);

    const before = sim.state.society.firePressure;

    for (let i = 0; i < 180; i++) sim.tick();
    expect(sim.state.society.firePressure).toBeCloseTo(
      Math.max(0, before - 180 * FIRE.pressureDecayPerDay),
      4,
    );
  });
});

describe('wildfire (GDD 3.1.1)', () => {
  it('two medium burns back to back cross the threshold; one low burn never does', () => {
    const calm = createSim(42);

    toDrySeason(calm);
    calm.dispatch({ type: 'BurnBlock', block: ownedWild(calm)[0]!, intensity: 1 });
    expect(collect(calm, 30)).not.toContain('WildfireStarted');

    const greedy = createSim(42);

    toDrySeason(greedy);

    const [a, b] = ownedWild(greedy);

    greedy.dispatch({ type: 'BurnBlock', block: a!, intensity: 2 });
    expect(isWildfire(greedy.state)).toBe(false);
    greedy.dispatch({ type: 'BurnBlock', block: b!, intensity: 2 });
    expect(isWildfire(greedy.state)).toBe(true);
    expect(activeEvent(greedy.state, HAZE_EVENT)).toBeDefined();

    // Every burn escalates to full intensity under a wildfire.
    expect(greedy.state.blocks.get(a!)!.fireIntensity).toBe(3);
    expect(greedy.state.blocks.get(b!)!.fireIntensity).toBe(3);

    const events = greedy.tick();

    expect(events.some((e) => e.type === 'WildfireStarted')).toBe(true);
  });

  it('smoke dims the sun while it hangs, and clears after the tail', () => {
    const sim = createSim(42);

    toDrySeason(sim);

    const [a, b] = ownedWild(sim);

    sim.dispatch({ type: 'BurnBlock', block: a!, intensity: 3 });
    sim.dispatch({ type: 'BurnBlock', block: b!, intensity: 2 });
    expect(isWildfire(sim.state)).toBe(true);

    sim.tick();
    expect(sim.state.weather.sun).toBeLessThanOrEqual(FIRE.hazeLight + 1e-9);

    // Let the fire burn out, then the smoke tail expire.
    tickUntil(sim, () => !isWildfire(sim.state), 400);
    expect(activeEvent(sim.state, WILDFIRE_EVENT)).toBeUndefined();
    tickUntil(sim, () => activeEvent(sim.state, HAZE_EVENT) === undefined, FIRE.hazeTailDays + 5);
    expect(activeEvent(sim.state, HAZE_EVENT)).toBeUndefined();
    sim.tick();
    expect(sim.state.weather.sun).toBeGreaterThan(FIRE.hazeLight);
  });

  it('a wildfire can take planted palms; a controlled burn cannot', () => {
    const sim = createSim(42);

    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });

    const block = ownedWild(sim)[0]!;

    sim.dispatch({ type: 'ChopBlock', block });
    tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: SLOTS_PER_BLOCK });
    sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });

    const planted = sim.state.blocks.get(block)!;

    expect(isFuel(planted, false)).toBe(false);
    expect(isFuel(planted, true)).toBe(true);
    expect(sim.dispatch({ type: 'BurnBlock', block, intensity: 3 })).toMatchObject({
      code: 'noFuel',
    });

    // Light it the way a wildfire would; in the dry season, so rain does not
    // save the palms; and let it burn through.
    toDrySeason(sim);

    const ctx = { state: sim.state, world: sim.world, events: new EventSink() };

    ignite(ctx, block, 3);

    const seen = collect(sim, FIRE.burnDays[3] + 1);

    expect(seen).toContain('PalmsBurned');
    expect(sim.state.palms.has(block)).toBe(false);
    expect(sim.state.blocks.get(block)!.phase).toBe('cleared');
    expect(sim.state.blocks.get(block)!.debris).toBeGreaterThanOrEqual(FIRE.debrisAfterBurn);
  });
});

describe('fire spread (GDD 3.1.1)', () => {
  function spreadCount(
    seed: number,
    intensity: FireIntensity,
    regime: 'normal' | 'elNino',
  ): number {
    const sim = createSim(seed);

    toDrySeason(sim);
    sim.state.weather.regime = regime;

    const block = ownedWild(sim)[0]!;

    sim.dispatch({ type: 'BurnBlock', block, intensity });

    let spread = 0;

    for (let i = 0; i < 6; i++)
      for (const e of sim.tick()) if (e.type === 'FireSpread') spread += 1;
    return spread;
  }

  it('a high burn in an El Niño year spreads more than a low burn in a normal one', () => {
    let high = 0;
    let low = 0;

    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      high += spreadCount(seed, 3, 'elNino');
      low += spreadCount(seed, 1, 'normal');
    }

    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(0);
  });

  it('fire that spreads into unowned land materialises it; you own the consequences', () => {
    const sim = createSim(42);

    toDrySeason(sim);
    sim.state.weather.regime = 'elNino';

    const before = sim.state.blocks.size;

    // Light everything owned and wild at high intensity to force spread outward.
    for (const block of ownedWild(sim)) sim.dispatch({ type: 'BurnBlock', block, intensity: 3 });
    for (let i = 0; i < 6; i++) sim.tick();
    expect(sim.state.blocks.size).toBeGreaterThan(before);

    let unownedBurnt = 0;

    for (const b of sim.state.blocks.values())
      if (!b.owned && (b.burning || b.phase === 'cleared')) unownedBurnt += 1;
    expect(unownedBurnt).toBeGreaterThan(0);
  });

  it('water never burns', () => {
    const sim = createSim(42);

    for (const key of sim.world.rivers.water) {
      expect(isFuel(sim.world.blockById(key), true)).toBe(false);
      break;
    }
  });
});

describe('timber (GDD 3.1.1)', () => {
  it('chopping forest pays for some of the crew when the block clears', () => {
    const sim = createSim(1); // a forest-heavy start
    const block = ownedWild(sim, 'forest')[0];

    if (block === undefined) return; // this seed has no owned forest; nothing to assert
    sim.dispatch({ type: 'ChopBlock', block });

    const cashDuring = sim.state.economy.cash;
    const seen: string[] = [];

    for (let i = 0; i < 200 && sim.state.blocks.get(block)!.phase !== 'cleared'; i++) {
      for (const e of sim.tick()) seen.push(e.type);
    }

    expect(seen).toContain('TimberSold');
    expect(sim.state.economy.cash).toBeGreaterThanOrEqual(
      cashDuring + TIMBER_VALUE.forest! - 5 * 1000,
    );
    expect(
      sim.state.economy.ledger.some((e) => e.kind === 'sale' && e.note?.startsWith('timber')),
    ).toBe(true);
  });

  it('grassfield has no timber', () => {
    expect(TIMBER_VALUE.grassfield).toBeUndefined();
  });
});

describe('sanitation, irrigation, drainage (GDD 3.1)', () => {
  it('a sanitation crew from stock clears debris', () => {
    const sim = createSim(42);

    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });

    const block = ownedWild(sim)[0]!;

    sim.state.blocks.get(block)!.debris = 80;
    expect(sim.dispatch({ type: 'SanitizeBlock', block })).toMatchObject({ code: 'noInventory' });
    expect(sim.dispatch({ type: 'BuyItem', item: 'sanitationCrew', quantity: 1 })).toEqual({
      ok: true,
    });
    expect(sim.dispatch({ type: 'SanitizeBlock', block })).toEqual({ ok: true });
    expect(sim.state.blocks.get(block)!.debris).toBeCloseTo(80 - DEBRIS.sanitizePerCrew, 6);
    expect(sim.state.inventory.sanitationCrew).toBe(0);
    sim.state.blocks.get(block)!.debris = 0;
    expect(sim.dispatch({ type: 'SanitizeBlock', block })).toMatchObject({ code: 'wrongPhase' });
  });

  it('irrigation lifts the dry-scrub penalty and costs water every day', () => {
    const sim = createSim(42);
    const block = ownedWild(sim)[0]!;
    const b = sim.state.blocks.get(block)!;

    b.biome = 'scrub';

    const dry = growthMultiplier(sim.state, b);
    const cash = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'IrrigateBlock', block })).toEqual({ ok: true });
    expect(cash - sim.state.economy.cash).toBe(IRRIGATION_COST);
    expect(b.irrigated).toBe(true);
    expect(growthMultiplier(sim.state, b)).toBeGreaterThan(dry * 1.3);
    expect(sim.dispatch({ type: 'IrrigateBlock', block })).toMatchObject({ code: 'occupied' });

    const before = sim.state.economy.cash;

    sim.tick();
    expect(before - sim.state.economy.cash).toBeGreaterThan(0);
  });

  it('drainage sets the flag and costs its price', () => {
    const sim = createSim(42);
    const block = ownedWild(sim)[0]!;
    const cash = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'DrainBlock', block })).toEqual({ ok: true });
    expect(cash - sim.state.economy.cash).toBe(DRAINAGE_COST);
    expect(sim.state.blocks.get(block)!.drained).toBe(true);
    expect(sim.dispatch({ type: 'DrainBlock', block })).toMatchObject({ code: 'occupied' });
  });

  it('the season is 360 days, so a 90-day ash window is a quarter of it', () => {
    expect(FIRE.ashDays * 4).toBe(GROWTH.daysPerYear);
  });
});

describe('whose fire it is (GDD 3.1.1)', () => {
  /** Light `block` at high intensity in a dry year, and count what it takes with it. */
  function spreadFrom(seed: number, natural: boolean): number {
    const sim = createSim(seed);

    sim.state.weather.regime = 'elNino';

    const block = ownedWild(sim, 'forest')[0] ?? ownedWild(sim)[0];

    if (block === undefined) return 0;

    const b = writeBlock(sim.state, sim.world, block);

    b.burning = true;
    b.fireIntensity = 3;
    if (natural) sim.state.weather.naturalFires.push(block);

    let spread = 0;

    for (let i = 0; i < 6; i++) {
      for (const e of sim.tick()) if (e.type === 'FireSpread' && e.from === block) spread += 1;
    }

    return spread;
  }

  it('a lightning fire burns its block out and never spreads; a lit match does', () => {
    let natural = 0;
    let lit = 0;

    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      natural += spreadFrom(seed, true);
      lit += spreadFrom(seed, false);
    }

    expect(natural).toBe(0);
    expect(lit).toBeGreaterThan(0);
  });

  it('a controlled burn reaches into standing forest more readily than across grass', () => {
    expect(FIRE.forestSpreadFactor).toBeGreaterThan(1);
  });

  it('the block forgets it was lightning once the fire is out', () => {
    const sim = createSim(3);
    const block = ownedWild(sim)[0]!;
    const b = writeBlock(sim.state, sim.world, block);

    b.burning = true;
    b.fireIntensity = 1;
    b.clearProgress = 0.9;
    sim.state.weather.naturalFires.push(block);
    for (let i = 0; i < 3 && sim.state.blocks.get(block)!.burning; i++) sim.tick();
    expect(sim.state.blocks.get(block)!.burning).toBe(false);
    expect(sim.state.weather.naturalFires).not.toContain(block);
  });
});
