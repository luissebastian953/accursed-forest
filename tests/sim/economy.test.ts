import { describe, expect, it } from 'vitest';

import { sampleCurve } from '@shared/math.ts';
import { autoplay } from '@sim/autoplay.ts';
import { BIOMES } from '@sim/balance/biomes.ts';
import {
  FERTILIZER_DAYS,
  GROWTH,
  HARVEST_ROTATION_DAYS,
  YIELD_CURVE,
} from '@sim/balance/growth.ts';
import { ECONOMY, HARVEST, ITEM_PRICES, KOPDES_UPGRADE_COST } from '@sim/balance/prices.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { distanceToKopdes, inKopdesRange, kopdesRange } from '@sim/kopdes.ts';
import { slotStage } from '@sim/palms.ts';
import type { BlockId } from '@sim/types.ts';

/** The owned, wild, clearable block nearest the Kopdes — inside its range. */
function firstOwnedWild(sim: Sim): BlockId {
  let best: BlockId | null = null;
  let bestDistance = Infinity;
  for (const block of sim.state.blocks.values()) {
    if (!(block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable)) continue;
    const distance = distanceToKopdes(sim.state, sim.world, block.id) ?? 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = block.id;
    }
  }
  if (best === null) throw new Error('no owned wild block');
  return best;
}

function tickUntil(sim: Sim, predicate: () => boolean, limit = 5000): number {
  let n = 0;
  while (!predicate() && n < limit) {
    sim.tick();
    n += 1;
  }
  return n;
}

/** Kopdes placed, one block chopped, stocked and planted. */
function plantedEstate(seed = 42): { sim: Sim; block: BlockId } {
  const sim = createSim(seed);
  expect(sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock })).toEqual({
    ok: true,
  });
  const block = firstOwnedWild(sim);
  expect(sim.dispatch({ type: 'ChopBlock', block })).toEqual({ ok: true });
  tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
  const needed = BIOMES[sim.state.blocks.get(block)!.biome].plantableSlots;
  expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed })).toEqual({ ok: true });
  expect(sim.dispatch({ type: 'PlantBlock', block, species: 'palm' })).toEqual({ ok: true });
  return { sim, block };
}

function growToBearing(sim: Sim, block: BlockId): void {
  tickUntil(
    sim,
    () => slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature',
    1500,
  );
  expect(slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick)).toBe('mature');
}

describe('Kopdes shop (§3.3)', () => {
  it('needs a Kopdes to buy anything', () => {
    const sim = createSim(42);
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 10 })).toMatchObject({
      ok: false,
      code: 'noKopdes',
    });
  });

  it('charges base × input price index and stocks the inventory', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const cash = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'BuyItem', item: 'fertilizer', quantity: 3 })).toEqual({
      ok: true,
    });
    expect(sim.state.inventory.fertilizer).toBe(3);
    expect(cash - sim.state.economy.cash).toBe(ITEM_PRICES.fertilizer * 3);

    sim.state.economy.inputPriceIndex = 1.5;
    const cash2 = sim.state.economy.cash;
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 10 })).toEqual({ ok: true });
    expect(cash2 - sim.state.economy.cash).toBe(Math.round(ITEM_PRICES.bibit * 1.5) * 10);
  });

  it('rejects nonsense quantities and empty pockets', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 0 })).toMatchObject({
      code: 'badQuantity',
    });
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1.5 })).toMatchObject({
      code: 'badQuantity',
    });
    sim.state.economy.cash = 1000;
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toMatchObject({
      code: 'noCash',
    });
  });
});

describe('Kopdes upgrades (§3.3)', () => {
  it('extends the range each level and stops at the max', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.state.economy.cash = 1_000_000_000;

    expect(kopdesRange(1)).toBe(ECONOMY.kopdesRange);
    for (let level = 1; level < ECONOMY.kopdesMaxLevel; level++) {
      const cash = sim.state.economy.cash;
      expect(sim.dispatch({ type: 'UpgradeKopdes' })).toEqual({ ok: true });
      expect(sim.state.kopdes!.level).toBe(level + 1);
      expect(cash - sim.state.economy.cash).toBe(KOPDES_UPGRADE_COST[level]);
      expect(kopdesRange(level + 1)).toBe(kopdesRange(level) + ECONOMY.kopdesRangePerLevel);
    }
    expect(sim.dispatch({ type: 'UpgradeKopdes' })).toMatchObject({ ok: false, code: 'maxLevel' });
  });

  it('range is Manhattan distance from the Kopdes block', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const [kx, ky] = sim.world.toXY(sim.state.worldGen.kopdesBlock);
    const r = kopdesRange(1);
    expect(inKopdesRange(sim.state, sim.world, sim.world.toId(kx + r, ky))).toBe(true);
    expect(inKopdesRange(sim.state, sim.world, sim.world.toId(kx + r + 1, ky))).toBe(false);
    expect(inKopdesRange(sim.state, sim.world, sim.world.toId(kx + 2, ky + 2))).toBe(r >= 4);
  });
});

describe('harvest (§2, §3.3)', () => {
  it('is refused while the palms are immature', () => {
    const { sim, block } = plantedEstate();
    for (let i = 0; i < 100; i++) sim.tick();
    expect(sim.dispatch({ type: 'HarvestBlock', block })).toMatchObject({
      ok: false,
      code: 'nothingToHarvest',
    });
  });

  it('becomes ripe on a 10-day rotation once the first palm bears, and announces it', () => {
    const { sim, block } = plantedEstate();
    growToBearing(sim, block);

    let ripeAt: number | null = null;
    for (let i = 0; i < 40 && ripeAt === null; i++) {
      for (const e of sim.tick())
        if (e.type === 'BlockRipe' && e.block === block) ripeAt = sim.state.tick;
    }
    expect(ripeAt).not.toBeNull();

    const b = sim.state.blocks.get(block)!;
    expect(sim.state.tick - b.lastHarvest).toBeGreaterThanOrEqual(HARVEST_ROTATION_DAYS);
    expect(sim.dispatch({ type: 'HarvestBlock', block })).toEqual({ ok: true });
    expect(b.lastHarvest).toBe(sim.state.tick);

    const early = sim.dispatch({ type: 'HarvestBlock', block });
    expect(early).toMatchObject({ ok: false, code: 'notRipe' });
    expect((early as { reason: string }).reason).toMatch(/Next round in 10 days/);
  });

  it("a round yields a plausible mass and is sold at the day's price next tick", () => {
    const { sim, block } = plantedEstate();
    growToBearing(sim, block);
    tickUntil(sim, () => sim.validate({ type: 'HarvestBlock', block }) === null, 40);

    const cashBefore = sim.state.economy.cash;
    const price = sim.state.economy.tbsPrice;
    let harvested = 0;
    expect(sim.dispatch({ type: 'HarvestBlock', block })).toEqual({ ok: true });

    const events = sim.tick();
    for (const e of events) {
      if (e.type === 'Harvested') harvested = e.kilograms;
    }
    const sold = events.find((e) => e.type === 'TbsSold');
    if (!sold || sold.type !== 'TbsSold') throw new Error('no TbsSold event');
    expect(sold.kilograms).toBeCloseTo(harvested, 6);
    expect(sold.price).toBe(price);

    // Year ~2.5 palms: the yield curve says roughly 0.4 kg/palm/round across 144 palms.
    expect(harvested).toBeGreaterThan(20);
    expect(harvested).toBeLessThan(400);

    const expectedRevenue = Math.round(harvested * price);
    const upkeep = ECONOMY.upkeepPerPlantedBlock;
    expect(sim.state.economy.cash).toBe(
      cashBefore - HARVEST.crewWagePerRound + expectedRevenue - upkeep,
    );
    expect(sim.state.economy.tbsPending).toBe(0);
    expect(sim.state.economy.soldKgTotal).toBeCloseTo(harvested, 6);
    expect(sim.state.economy.ledger.at(-2)).toMatchObject({
      kind: 'sale',
      amount: expectedRevenue,
    });
  });

  it('fruit left on the tree rots: yield is capped, not banked', () => {
    const { sim, block } = plantedEstate();
    growToBearing(sim, block);
    for (let i = 0; i < 200; i++) sim.tick();
    const palms = sim.state.palms.get(block)!;
    const ageYears = (sim.state.tick - palms.plantedAt[0]!) / GROWTH.daysPerYear;
    const cap = sampleCurve(YIELD_CURVE, ageYears) * HARVEST.overripeCapRounds;
    expect(palms.yieldAcc[0]).toBeLessThanOrEqual(cap + 1e-6);
    // 200 days of accumulation is far more than 1.5 rounds: the cap is binding.
    expect(palms.yieldAcc[0]).toBeGreaterThan(cap * 0.9);
  });

  it('refuses a block outside Kopdes range because the fruit would spoil', () => {
    const { sim, block } = plantedEstate();
    growToBearing(sim, block);
    tickUntil(sim, () => sim.validate({ type: 'HarvestBlock', block }) === null, 40);

    // Move the Kopdes far away for the check.
    const [bx, by] = sim.world.toXY(block);
    sim.state.kopdes!.blockId = sim.world.toId(Math.max(0, bx - 20), by);
    const result = sim.dispatch({ type: 'HarvestBlock', block });
    expect(result).toMatchObject({ ok: false, code: 'outOfRange' });
    expect((result as { reason: string }).reason).toMatch(/spoil/);
  });

  it('needs a Kopdes to harvest at all', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const block = firstOwnedWild(sim);
    sim.dispatch({ type: 'ChopBlock', block });
    tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: SLOTS_PER_BLOCK });
    sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });
    sim.state.kopdes = null;
    expect(sim.dispatch({ type: 'HarvestBlock', block })).toMatchObject({
      ok: false,
      code: 'noKopdes',
    });
  });
});

describe('fertilizer (§3.5)', () => {
  it('opens a 90-day window from stock, and speeds growth while it is open', () => {
    const { sim, block } = plantedEstate();
    expect(sim.dispatch({ type: 'FertilizeBlock', block })).toMatchObject({
      ok: false,
      code: 'noInventory',
    });
    expect(sim.dispatch({ type: 'BuyItem', item: 'fertilizer', quantity: 1 })).toEqual({
      ok: true,
    });
    expect(sim.dispatch({ type: 'FertilizeBlock', block })).toEqual({ ok: true });
    expect(sim.state.blocks.get(block)!.fertilizedUntil).toBe(sim.state.tick + FERTILIZER_DAYS);
    expect(sim.state.inventory.fertilizer).toBe(0);
    expect(sim.dispatch({ type: 'FertilizeBlock', block })).toMatchObject({
      ok: false,
      code: 'occupied',
    });

    // Twin estate without fertilizer, same seed: identical weather, slower growth.
    const twin = plantedEstate();
    for (let i = 0; i < FERTILIZER_DAYS; i++) {
      sim.tick();
      twin.sim.tick();
    }
    const fed = sim.state.palms.get(block)!.growth[0]!;
    const unfed = twin.sim.state.palms.get(twin.block)!.growth[0]!;
    expect(fed).toBeGreaterThan(unfed * 1.1);
  });
});

describe('price walk (§3.3)', () => {
  it('stays inside its bounds and near its mean over 20 years', () => {
    const sim = createSim(7);
    let sum = 0;
    const n = 20 * GROWTH.daysPerYear;
    for (let i = 0; i < n; i++) {
      sim.tick();
      const p = sim.state.economy.tbsPrice;
      expect(p).toBeGreaterThanOrEqual(ECONOMY.tbsPriceMin);
      expect(p).toBeLessThanOrEqual(ECONOMY.tbsPriceMax);
      sum += p;
    }
    const mean = sum / n;
    expect(Math.abs(mean - ECONOMY.tbsPriceMean) / ECONOMY.tbsPriceMean).toBeLessThan(0.1);
    expect(sim.state.economy.tbsPriceHistory.length).toBe(ECONOMY.priceHistoryCap);
  });

  it('actually moves', () => {
    const sim = createSim(7);
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      sim.tick();
      seen.add(sim.state.economy.tbsPrice);
    }
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('the loop closes (§3.5, M1b done-criterion)', () => {
  it('one block, played plainly, is cash-positive once bearing — but the immature years bite', () => {
    const { rows, lowestCash } = autoplay({ seed: 42, years: 8, blocks: 1 });
    const byYear = new Map(rows.map((r) => [r.year, r]));

    // Losing money while immature.
    expect(byYear.get(1)!.net).toBeLessThan(0);
    expect(byYear.get(2)!.net).toBeLessThan(0);
    // Earning once the palms bear and the curve ramps.
    expect(byYear.get(5)!.net).toBeGreaterThan(0);
    expect(byYear.get(7)!.net).toBeGreaterThan(byYear.get(5)!.net);
    expect(byYear.get(8)!.soldKg).toBeGreaterThan(5000);
    // Tight, not fatal: the reserve never went negative on one block.
    expect(lowestCash).toBeGreaterThan(0);
  });

  it('two blocks on the starting cash is possible but tight', () => {
    const { rows, lowestCash } = autoplay({ seed: 42, years: 6, blocks: 2 });
    expect(rows.at(-1)!.planted).toBe(2);
    expect(lowestCash).toBeGreaterThan(-5_000_000);
    expect(rows.at(-1)!.net).toBeGreaterThan(0);
  });
});
