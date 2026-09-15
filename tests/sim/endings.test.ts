import { describe, expect, it } from 'vitest';

import { autoplay } from '@sim/autoplay.ts';
import { BIOMES } from '@sim/balance/biomes.ts';
import { BANKRUPTCY, CHRONICLE, ISPO, OPERATING_BAN } from '@sim/balance/endings.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { ECONOMY, ITEM_PRICES } from '@sim/balance/prices.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import type { SimEvent } from '@sim/events.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { distanceToKopdes, inKopdesRange } from '@sim/kopdes.ts';
import { createPalmArrays, plantSlots } from '@sim/palms.ts';
import { chronicle } from '@sim/run.ts';
import { writeBlock } from '@sim/state.ts';
import { creditLine, ispoConditions, matureHectares } from '@sim/systems/endings.ts';
import { operatingBanned } from '@sim/systems/society.ts';
import type { BlockId } from '@sim/types.ts';

const YEAR = GROWTH.daysPerYear;

function ownedWild(sim: Sim): BlockId[] {
  const out: BlockId[] = [];
  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) out.push(block.id);
  }
  return out;
}

/** Tick until an event of this type appears; returns it or null. */
function tickFor<T extends SimEvent['type']>(
  sim: Sim,
  type: T,
  limit: number,
): Extract<SimEvent, { type: T }> | null {
  for (let i = 0; i < limit; i++) {
    const hit = sim.tick().find((e) => e.type === type);
    if (hit) return hit as Extract<SimEvent, { type: T }>;
  }
  return null;
}

/** Put bearing palms on `n` open, non-forest blocks near the Kopdes, planted `ageYears` ago. */
function plantMature(sim: Sim, n: number, ageYears = 6): BlockId[] {
  const { state, world } = sim;
  const kopdes = state.worldGen.kopdesBlock;
  const candidates: BlockId[] = [];
  for (let id = 0; id < world.width * world.height; id++) {
    if (id === kopdes) continue;
    const b = world.blockById(id);
    if (b.biome === 'river' || BIOMES[b.biome].forestCover) continue;
    candidates.push(id);
  }
  candidates.sort(
    (a, b) => (distanceToKopdes(state, world, a) ?? 99) - (distanceToKopdes(state, world, b) ?? 99),
  );
  const planted = candidates.slice(0, n);
  for (const id of planted) {
    const block = writeBlock(state, world, id);
    block.owned = true;
    block.phase = 'planted';
    block.species = 'palm';
    block.clearProgress = 1;
    const palms = createPalmArrays();
    plantSlots(palms, SLOTS_PER_BLOCK, state.tick - ageYears * YEAR);
    palms.growth.fill(GROWTH.immatureDays * 3);
    state.palms.set(id, palms);
  }
  return planted;
}

/**
 * An estate one week from the end of year 10 that meets every ISPO condition:
 * Kopdes at max level, 16 bearing hectares, three profitable years and the
 * profit behind it, no burns.
 */
function certifiableEstate(seed = 42): Sim {
  const sim = createSim(seed);
  const { state } = sim;
  state.tick = 10 * YEAR - 5;
  state.weather.dayOfYear = state.tick % YEAR;
  sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock });
  state.kopdes!.level = ECONOMY.kopdesMaxLevel;
  plantMature(sim, ISPO.winHectares);
  state.economy.cash = 2e9;
  state.run.years = [7, 8, 9].map((year) => ({
    year,
    profit: 400e6,
    cash: 1e9,
    matureHectares: 16,
    forestCover: 0.5,
    conditionsMet: 4,
  }));
  state.run.profitTotal = ISPO.winProfit;
  state.run.yearProfit = 300e6;
  return sim;
}

describe('the books (§3.8)', () => {
  it('counts operating profit, not land and buildings', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    expect(sim.state.run.yearProfit).toBe(0);
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 10 });
    expect(sim.state.run.yearProfit).toBe(-10 * ITEM_PRICES.bibit);
    expect(sim.state.economy.ledger.at(0)!.kind).toBe('capital');
  });

  it('closes each year with a summary and rolls the profit into the total', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 100 });
    const closed = tickFor(sim, 'YearClosed', YEAR + 1);
    expect(closed?.summary.year).toBe(1);
    expect(closed?.summary.profit).toBe(-100 * ITEM_PRICES.bibit);
    expect(sim.state.run.years).toHaveLength(1);
    expect(sim.state.run.yearProfit).toBe(0);
    expect(sim.state.run.profitTotal).toBe(-100 * ITEM_PRICES.bibit);
    expect(sim.state.run.chronicle.some((c) => /^Year 1 closed: loss/.test(c.title))).toBe(true);
  });

  it('keeps burns and fire spread in the chronicle and the stats', () => {
    const sim = createSim(42);
    while (sim.state.weather.dayOfYear < 130) sim.tick();
    const block = ownedWild(sim)[0]!;
    sim.dispatch({ type: 'BurnBlock', block, intensity: 1 });
    sim.tick();
    expect(sim.state.run.stats.burns).toBe(1);
    expect(sim.state.run.lastBurnAt).toBe(sim.state.tick - 1);
    expect(sim.state.run.chronicle.some((c) => /burned to clear$/.test(c.title))).toBe(true);
  });

  it('keeps the turning points when the chronicle is full', () => {
    const sim = createSim(42);
    chronicle(sim.state, { lane: 'government', severity: 'critical', title: 'the big one' });
    for (let i = 0; i < CHRONICLE.cap + 20; i++)
      chronicle(sim.state, { lane: 'estate', severity: 'notice', title: `line ${i}` });
    expect(sim.state.run.chronicle).toHaveLength(CHRONICLE.cap);
    expect(sim.state.run.chronicle[0]!.title).toBe('the big one');
    expect(sim.state.run.chronicle.at(-1)!.title).toBe(`line ${CHRONICLE.cap + 19}`);
  });
});

describe('ISPO certification (§3.8)', () => {
  it('a clean estate is certified at the close of the year, and the feed means it', () => {
    const sim = certifiableEstate();
    expect(matureHectares(sim.state)).toBe(ISPO.winHectares);
    expect(ispoConditions(sim.state, sim.world).every((c) => c.met)).toBe(true);

    const certified = tickFor(sim, 'Certified', 10);
    expect(certified).toEqual({ type: 'Certified', clean: true, waived: [] });
    expect(sim.state.run.ending).toBe('clean');
    expect(sim.state.run.endedAt).toBe(10 * YEAR);
    expect(sim.state.society.news.at(-1)?.key).toBe('ispo.clean');
    expect(sim.state.run.chronicle.at(-1)?.title).toMatch(/model estate/);
  });

  it('with low integrity the burn and forest conditions are waived: a dirty win, told plainly', () => {
    const sim = certifiableEstate();
    sim.state.run.lastBurnAt = sim.state.tick - YEAR;
    sim.state.society.integrity = 0.2;

    const certified = tickFor(sim, 'Certified', 10);
    expect(certified).toEqual({ type: 'Certified', clean: false, waived: ['noBurn'] });
    expect(sim.state.run.ending).toBe('dirty');
    const keys = sim.state.society.news.map((n) => n.key);
    expect(keys).toContain('ispo.dirty');
    expect(keys).toContain('ispo.dirtyHaze');
  });

  it('an honest ministry does not waive anything', () => {
    const sim = certifiableEstate();
    sim.state.run.lastBurnAt = sim.state.tick - YEAR;
    sim.state.society.integrity = 0.9;

    const closed = tickFor(sim, 'YearClosed', 10);
    expect(closed?.summary.conditionsMet).toBe(4);
    expect(sim.state.run.ending).toBeUndefined();
  });

  it('three profitable years are required, not just the total', () => {
    const sim = certifiableEstate();
    sim.state.run.years[1]!.profit = -1;
    tickFor(sim, 'YearClosed', 10);
    expect(sim.state.run.ending).toBeUndefined();
  });

  it('after the certificate the world stops until the player keeps playing', () => {
    const sim = certifiableEstate();
    tickFor(sim, 'Certified', 10);
    const tick = sim.state.tick;
    expect(sim.tick()).toEqual([]);
    expect(sim.state.tick).toBe(tick);
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toMatchObject({
      code: 'gameOver',
    });

    expect(sim.dispatch({ type: 'KeepPlaying' })).toEqual({ ok: true });
    expect(sim.state.run.sandbox).toBe(true);
    expect(sim.state.run.ending).toBe('clean');
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toEqual({ ok: true });
    expect(sim.dispatch({ type: 'KeepPlaying' })).toMatchObject({ code: 'wrongPhase' });

    // Sandbox: time runs, and nothing ends the run again — not even bankruptcy.
    sim.state.economy.cash = -1e12;
    for (let i = 0; i < BANKRUPTCY.daysInRed + 10; i++) sim.tick();
    expect(sim.state.tick).toBe(tick + BANKRUPTCY.daysInRed + 10);
    expect(sim.state.run.ending).toBe('clean');
  });

  it('a steady expanding player certifies well inside the horizon', () => {
    const run = autoplay({
      seed: 42,
      years: ISPO.horizonYears,
      blocks: 3,
      managePests: true,
      expand: { reserve: 40_000_000, maxBlocks: 24 },
    });
    expect(run.ending === 'clean' || run.ending === 'dirty').toBe(true);
    expect(run.endedYear).toBeGreaterThanOrEqual(8);
    expect(run.endedYear).toBeLessThanOrEqual(20);
  });
});

describe('the fade (§3.8)', () => {
  it('twenty-five years without a certificate is the fade; the player may keep playing', () => {
    const sim = createSim(42);
    sim.state.tick = ISPO.horizonYears * YEAR - 1;
    const ended = tickFor(sim, 'RunEnded', 2);
    expect(ended?.ending).toBe('fade');
    expect(sim.state.society.news.at(-1)?.key).toBe('ending.fade');
    expect(sim.dispatch({ type: 'KeepPlaying' })).toEqual({ ok: true });
    expect(sim.tick().some((e) => e.type === 'RunEnded')).toBe(false);
  });

  it('losses have no sandbox', () => {
    const sim = createSim(42);
    sim.state.economy.cash = -1;
    tickFor(sim, 'RunEnded', BANKRUPTCY.daysInRed + 1);
    expect(sim.state.run.ending).toBe('bankrupt');
    expect(sim.dispatch({ type: 'KeepPlaying' })).toMatchObject({ code: 'gameOver' });
  });
});

describe('bankruptcy (§3.8)', () => {
  it('ninety days in the red with no collateral calls the loans', () => {
    const sim = createSim(42);
    sim.state.economy.cash = -1;
    for (let i = 0; i < BANKRUPTCY.daysInRed - 1; i++) {
      expect(sim.tick().some((e) => e.type === 'RunEnded')).toBe(false);
    }
    const events = sim.tick();
    expect(events).toContainEqual({ type: 'RunEnded', ending: 'bankrupt' });
    const headline = sim.state.society.news.at(-1)!;
    expect(headline.key).toBe('ending.bankrupt');
    expect(headline.body).toContain(`${BANKRUPTCY.daysInRed} days`);
  });

  it('a day back in the black resets the count', () => {
    const sim = createSim(42);
    sim.state.economy.cash = -1;
    for (let i = 0; i < BANKRUPTCY.daysInRed - 1; i++) sim.tick();
    sim.state.economy.cash = 1;
    sim.tick();
    expect(sim.state.run.insolventFor).toBe(0);
  });

  it('palms in Kopdes range are collateral: the bank lends against them, up to a line', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.state.tick = 3 * YEAR;
    const [block] = plantMature(sim, 1);
    expect(inKopdesRange(sim.state, sim.world, block!)).toBe(true);
    expect(creditLine(sim.state, sim.world)).toBe(BANKRUPTCY.creditPerHectare);

    sim.state.economy.cash = -BANKRUPTCY.creditPerHectare / 2;
    for (let i = 0; i < BANKRUPTCY.daysInRed + 30; i++) sim.tick();
    expect(sim.state.run.ending).toBeUndefined();

    sim.state.economy.cash = -BANKRUPTCY.creditPerHectare - 1;
    expect(tickFor(sim, 'RunEnded', BANKRUPTCY.daysInRed + 1)?.ending).toBe('bankrupt');
  });
});

describe('the operating ban (§3.8)', () => {
  /** Burn one wild block on an estate whose ministry has just been cleaned out. */
  function burnUnderHonestOffice(seed: number): Sim {
    const sim = createSim(seed);
    while (sim.state.weather.dayOfYear < 130) sim.tick();
    sim.state.society.integrity = 0.9;
    sim.dispatch({ type: 'BurnBlock', block: ownedWild(sim)[0]!, intensity: 1 });
    sim.tick();
    return sim;
  }

  it('rolls only while integrity is high, and lands some of the time', () => {
    const results = Array.from({ length: 16 }, (_, i) =>
      operatingBanned(burnUnderHonestOffice(i + 1).state),
    );
    expect(results.some(Boolean)).toBe(true);
    expect(results.some((r) => !r)).toBe(true);

    for (let seed = 1; seed <= 16; seed++) {
      const sim = createSim(seed);
      while (sim.state.weather.dayOfYear < 130) sim.tick();
      sim.state.society.integrity = OPERATING_BAN.minIntegrity - 0.2;
      sim.dispatch({ type: 'BurnBlock', block: ownedWild(sim)[0]!, intensity: 1 });
      sim.tick();
      expect(operatingBanned(sim.state)).toBe(false);
    }
  });

  it('shuts clearing and palm planting — not reforestation — and the bank lends nothing', () => {
    let sim: Sim | null = null;
    for (let seed = 1; seed <= 32 && !sim; seed++) {
      const candidate = burnUnderHonestOffice(seed);
      if (operatingBanned(candidate.state)) sim = candidate;
    }
    expect(sim).not.toBeNull();
    const { state } = sim!;
    expect(state.society.news.some((n) => n.key === 'authority.operatingBan')).toBe(true);

    const block = ownedWild(sim!).find((id) => !state.blocks.get(id)!.burning)!;
    expect(sim!.validate({ type: 'ChopBlock', block })).toMatchObject({ code: 'banned' });
    const cleared = writeBlock(state, sim!.world, block);
    cleared.phase = 'cleared';
    state.inventory.bibit = 1000;
    state.inventory.forestSapling = 1000;
    expect(sim!.validate({ type: 'PlantBlock', block, species: 'palm' })).toMatchObject({
      code: 'banned',
    });
    expect(sim!.validate({ type: 'PlantBlock', block, species: 'forest' })).toBeNull();

    // No collateral while the licence is suspended: the red is fatal, and the ban takes the blame.
    state.economy.cash = -1;
    expect(tickFor(sim!, 'RunEnded', BANKRUPTCY.daysInRed + 1)?.ending).toBe('banned');
    expect(state.society.news.at(-1)?.key).toBe('ending.banned');
  });

  it('lifts after two years with a headline', () => {
    let sim: Sim | null = null;
    for (let seed = 1; seed <= 32 && !sim; seed++) {
      const candidate = burnUnderHonestOffice(seed);
      if (operatingBanned(candidate.state)) sim = candidate;
    }
    sim!.state.economy.cash = 1e12;
    sim!.state.society.attention = 0;
    sim!.state.society.investigationUntil = -1;
    const lifted = tickFor(sim!, 'OperatingBanLifted', OPERATING_BAN.days + 1);
    expect(lifted).not.toBeNull();
    expect(operatingBanned(sim!.state)).toBe(false);
  });
});
