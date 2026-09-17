import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { GROWTH, GROWTH_FACTORS } from '@sim/balance/growth.ts';
import { ECONOMY, KOPDES_BUILD_COST } from '@sim/balance/prices.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { slotStage, stageOf } from '@sim/palms.ts';
import { growthMultiplier } from '@sim/systems/growth.ts';
import type { Block, BlockId, Command } from '@sim/types.ts';

/** First owned, wild block of the given biome; the natural first target. */
function firstOwnedWild(sim: Sim, biome: Block['biome'] = 'grassfield'): BlockId {
  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && block.biome === biome) return block.id;
  }
  // Fall back to any owned wild block; some starts are all forest.
  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) return block.id;
  }
  throw new Error('no owned wild block in the starting estate');
}

/** An unowned, for-sale block adjacent to the estate. */
function firstBuyable(sim: Sim): BlockId {
  const { state, world } = sim;
  for (const block of state.blocks.values()) {
    if (!block.owned) continue;
    const [x, y] = world.toXY(block.id);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny)) continue;
      const id = world.toId(nx, ny);
      if (state.blocks.get(id)?.owned) continue;
      if (world.generated(nx, ny).forSale) return id;
    }
  }
  throw new Error('estate has no buyable neighbour');
}

function tickUntil(sim: Sim, predicate: () => boolean, limit = 5000): number {
  let n = 0;
  while (!predicate() && n < limit) {
    sim.tick();
    n += 1;
  }
  return n;
}

function chopAndPlant(sim: Sim, block: BlockId): void {
  if (!sim.state.kopdes) {
    expect(sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock })).toEqual({
      ok: true,
    });
  }
  expect(sim.dispatch({ type: 'ChopBlock', block })).toEqual({ ok: true });
  tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
  const needed = BIOMES[sim.state.blocks.get(block)!.biome].plantableSlots;
  expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed })).toEqual({ ok: true });
  expect(sim.dispatch({ type: 'PlantBlock', block, species: 'palm' })).toEqual({ ok: true });
}

describe('initial state (§4.4, §4.6)', () => {
  it('starts with the 8x8 estate owned, the Kopdes block pre-cleared, and nothing else diverged', () => {
    const sim = createSim(42);
    const { state, world } = sim;

    const owned = [...state.blocks.values()].filter((b) => b.owned);
    expect(owned.length).toBeGreaterThan(50);
    expect(owned.length).toBeLessThanOrEqual(64);
    for (const block of owned) {
      const [x, y] = world.toXY(block.id);
      expect(x).toBeGreaterThanOrEqual(world.start.x);
      expect(x).toBeLessThan(world.start.x + world.start.size);
      expect(y).toBeGreaterThanOrEqual(world.start.y);
      expect(y).toBeLessThan(world.start.y + world.start.size);
    }

    const kopdes = state.blocks.get(state.worldGen.kopdesBlock)!;
    expect(kopdes.phase).toBe('cleared');
    expect(kopdes.owned).toBe(true);

    // Sparse: the map holds the estate, not the world.
    expect(state.blocks.size).toBeLessThan((world.width * world.height) / 10);
    expect(state.economy.cash).toBe(ECONOMY.startingCash);
    expect(state.tick).toBe(0);
    expect(state.kopdes).toBeNull();
  });

  it('reading an untouched block does not materialise it', () => {
    const sim = createSim(42);
    const before = sim.state.blocks.size;
    const far = sim.world.toId(0, 0);
    expect(sim.state.blocks.has(far)).toBe(false);
    expect(sim.world.blockById(far).phase).toBe('wild');
    expect(sim.state.blocks.size).toBe(before);
  });
});

describe('commands (§4.2)', () => {
  it('rejects planting on wild land with a fix-it reason', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    const result = sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });
    expect(result).toMatchObject({ ok: false, code: 'wrongPhase' });
    expect((result as { reason: string }).reason).toMatch(/clear/i);
  });

  it('rejects acting on land you do not own', () => {
    const sim = createSim(42);
    const block = sim.world.toId(0, 0);
    expect(sim.dispatch({ type: 'ChopBlock', block })).toMatchObject({
      ok: false,
      code: 'notOwned',
    });
    expect(sim.dispatch({ type: 'PlantBlock', block, species: 'palm' })).toMatchObject({
      ok: false,
      code: 'notOwned',
    });
  });

  it('rejects buying land that is not adjacent to the estate', () => {
    const sim = createSim(42);
    const block = sim.world.toId(0, 0);
    expect(sim.dispatch({ type: 'BuyBlock', block })).toMatchObject({
      ok: false,
      code: 'notAdjacent',
    });
  });

  it('rejects buying protected forest or water outright', () => {
    for (const seed of [1, 42, 1234]) {
      const sim = createSim(seed);
      const { world, state } = sim;
      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          const g = world.generated(x, y);
          if (g.forSale) continue;
          const id = world.toId(x, y);
          if (state.blocks.get(id)?.owned) continue;
          const result = sim.dispatch({ type: 'BuyBlock', block: id });
          expect(result.ok).toBe(false);
          expect(['notForSale', 'notAdjacent']).toContain((result as { code: string }).code);
        }
      }
    }
  });

  it('buys an adjacent block, charges for it, and each purchase raises the next price', () => {
    const sim = createSim(42);
    const first = firstBuyable(sim);
    const cashBefore = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'BuyBlock', block: first })).toEqual({ ok: true });
    expect(sim.state.blocks.get(first)!.owned).toBe(true);
    const firstPrice = cashBefore - sim.state.economy.cash;
    expect(firstPrice).toBeGreaterThan(0);
    // The free starting estate must not inflate the first purchase.
    expect(firstPrice).toBeLessThan(BIOMES[sim.state.blocks.get(first)!.biome].price * 2.5);

    const second = firstBuyable(sim);
    const cashMid = sim.state.economy.cash;
    expect(sim.dispatch({ type: 'BuyBlock', block: second })).toEqual({ ok: true });
    const secondPrice = cashMid - sim.state.economy.cash;
    const secondBase = BIOMES[sim.state.blocks.get(second)!.biome].price;
    const firstBase = BIOMES[sim.state.blocks.get(first)!.biome].price;
    // Normalise by biome base so a forest-vs-grassfield pair still compares.
    expect(secondPrice / secondBase).toBeGreaterThan((firstPrice / firstBase) * 0.95);
  });

  it('rejects when there is not enough cash, and says how much it costs', () => {
    const sim = createSim(42);
    sim.state.economy.cash = 1000;
    const block = firstOwnedWild(sim);
    const result = sim.dispatch({ type: 'ChopBlock', block });
    expect(result).toMatchObject({ ok: false, code: 'noCash' });
    expect((result as { reason: string }).reason).toMatch(/Rp/);
  });

  it('chops, then clears after the biome’s chop time, leaving its debris', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    const spec = BIOMES[sim.state.blocks.get(block)!.biome];

    expect(sim.dispatch({ type: 'ChopBlock', block })).toEqual({ ok: true });
    expect(sim.state.blocks.get(block)!.phase).toBe('clearing');

    const days = tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
    expect(days).toBeGreaterThanOrEqual(spec.chopDays);
    expect(days).toBeLessThanOrEqual(spec.chopDays + 1);
    expect(sim.state.blocks.get(block)!.debris).toBeCloseTo(spec.chopDebris, 5);
  });

  it('places exactly one Kopdes on a cleared block', () => {
    const sim = createSim(42);
    const block = sim.state.worldGen.kopdesBlock;
    const cash = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'PlaceKopdes', block })).toEqual({ ok: true });
    expect(sim.state.kopdes).toEqual({ blockId: block, level: 1, autoHarvest: false });
    expect(sim.state.blocks.get(block)!.phase).toBe('kopdes');
    expect(sim.state.economy.cash).toBe(cash - KOPDES_BUILD_COST);

    expect(sim.dispatch({ type: 'PlaceKopdes', block })).toMatchObject({
      ok: false,
      code: 'occupied',
    });
  });

  it('plants every plantable slot and emits one BlockPlanted with the count', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    // Drain pending events so the planting event is isolated on the next tick.
    chopAndPlant(sim, block);

    const palms = sim.state.palms.get(block)!;
    const spec = BIOMES[sim.state.blocks.get(block)!.biome];
    let planted = 0;
    for (const t of palms.plantedAt) if (t >= 0) planted += 1;
    expect(planted).toBe(spec.plantableSlots);
    expect(palms.plantedAt.length).toBe(SLOTS_PER_BLOCK);
    expect(sim.state.blocks.get(block)!.phase).toBe('planted');
    expect(sim.state.inventory.bibit).toBe(0);

    // The events came out of dispatch's tick context; they surface on the next tick.
    const events = sim.tick();
    expect(
      events.some((e) => e.type === 'BlockPlanted' && e.block === block && e.count === planted),
    ).toBe(true);
  });

  it('planting needs seedlings in stock, and says where to get them', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    expect(sim.dispatch({ type: 'ChopBlock', block })).toEqual({ ok: true });
    tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
    const result = sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });
    expect(result).toMatchObject({ ok: false, code: 'noInventory' });
    expect((result as { reason: string }).reason).toMatch(/Kopdes/);
  });

  it('every command in the union has a handler', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    const all: Command[] = [
      { type: 'PlantBlock', block, species: 'palm' },
      { type: 'BuyBlock', block },
      { type: 'ChopBlock', block },
      { type: 'BurnBlock', block, intensity: 1 },
      { type: 'SanitizeBlock', block },
      { type: 'IrrigateBlock', block },
      { type: 'DrainBlock', block },
      { type: 'HarvestBlock', block },
      { type: 'FertilizeBlock', block },
      { type: 'PlaceKopdes', block },
      { type: 'UpgradeKopdes' },
      { type: 'BuyItem', item: 'bibit', quantity: 1 },
      { type: 'SetTrap', block },
      { type: 'ApplyMetarhizium', block },
      { type: 'ApplyTrichoderma', block },
      { type: 'RemovePalm', block, slot: 0 },
      { type: 'TrenchPalm', block, slot: 0 },
      { type: 'ReplantBlock', block },
      { type: 'CoverCropBlock', block },
    ];
    for (const command of all) {
      const result = sim.validate(command);
      expect(result?.code).not.toBe('notImplemented');
    }
  });

  it('logs accepted commands with their tick, and never rejected ones', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    sim.dispatch({ type: 'PlantBlock', block, species: 'palm' }); // rejected
    sim.tick();
    sim.tick();
    sim.dispatch({ type: 'ChopBlock', block }); // accepted at tick 2
    expect(sim.state.commandLog).toEqual([{ tick: 2, command: { type: 'ChopBlock', block } }]);
  });
});

describe('growth (§3.6.1)', () => {
  it('a planted grassfield block reaches maturity in about `immatureDays` calendar days', () => {
    // Seeds differ in the regimes they roll; El Niño years legitimately push
    // this out by a quarter or so. The window is the tunable, give or take.
    for (const seed of [42, 1234, 99_999]) {
      const sim = createSim(seed);
      const block = firstOwnedWild(sim);
      chopAndPlant(sim, block);
      const plantedAt = sim.state.tick;

      const days = tickUntil(
        sim,
        () => slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature',
        1500,
      );
      const calendarDays = sim.state.tick - plantedAt;
      expect(days).toBeLessThan(1500);
      expect(calendarDays).toBeGreaterThan(GROWTH.immatureDays * 0.8);
      expect(calendarDays).toBeLessThan(GROWTH.immatureDays * 1.3);
    }
  });

  it('passes through seedling → immature → mature, emitting a stage event per slot', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    chopAndPlant(sim, block);

    // Tick by hand so no tick's events are dropped on the floor.
    const seen = new Map<string, number>();
    for (let i = 0; i < 1500; i++) {
      for (const e of sim.tick()) {
        if (e.type === 'PalmStageChanged' && e.block === block) {
          const key = `${e.from}→${e.to}`;
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }
      }
      if (slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature') break;
    }

    const slots = BIOMES[sim.state.blocks.get(block)!.biome].plantableSlots;
    expect(seen.get('seedling→immature')).toBe(slots);
    expect(seen.get('immature→mature')).toBe(slots);
  });

  it('bearing palms accumulate yield; immature ones do not', () => {
    const sim = createSim(42);
    const block = firstOwnedWild(sim);
    chopAndPlant(sim, block);

    tickUntil(sim, () => sim.state.tick > 200);
    expect(sim.state.palms.get(block)!.yieldAcc[0]).toBe(0);

    tickUntil(
      sim,
      () => slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature',
      1500,
    );
    for (let i = 0; i < 30; i++) sim.tick();
    expect(sim.state.palms.get(block)!.yieldAcc[0]).toBeGreaterThan(0);
  });

  it('property: the block growth multiplier stays inside its documented bounds for any weather', () => {
    const sim = createSim(42);
    const block = sim.state.blocks.get(firstOwnedWild(sim))!;
    const upper =
      GROWTH_FACTORS.light.max * GROWTH_FACTORS.moisture.max * GROWTH_FACTORS.fertility.max;
    const lower =
      GROWTH_FACTORS.light.min * GROWTH_FACTORS.moisture.min * GROWTH_FACTORS.fertility.min;

    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (sun, moisture) => {
          sim.state.weather.sun = sun;
          block.moisture = moisture;
          const g = growthMultiplier(sim.state, block);
          expect(g).toBeGreaterThanOrEqual(lower - 1e-9);
          expect(g).toBeLessThanOrEqual(upper + 1e-9);
          expect(g).toBeLessThanOrEqual(GROWTH.maxMultiplier);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('senescence is calendar age, not growth-days', () => {
    const senileAge = GROWTH.senileYears * GROWTH.daysPerYear;
    // Barely grown, but old: senile.
    expect(stageOf('palm', 10, senileAge, 255, 0)).toBe('senile');
    // Fully grown, but young: mature.
    expect(stageOf('palm', 5000, 1000, 255, 0)).toBe('mature');
    expect(stageOf('palm', 0, 0, 255, 0)).toBe('seedling');
    expect(stageOf('palm', GROWTH.immatureDays, 900, 255, 0)).toBe('mature');
    expect(stageOf('palm', 100, 100, 0, 0)).toBe('dead');
    expect(stageOf('palm', 100, 100, 255, 3)).toBe('dead');
  });
});

describe('determinism (§4.3)', () => {
  const commandArb = (blocks: BlockId[]): fc.Arbitrary<Command> =>
    fc.oneof(
      fc.record({ type: fc.constant('ChopBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({
        type: fc.constant('PlantBlock' as const),
        block: fc.constantFrom(...blocks),
        species: fc.constantFrom('palm' as const, 'forest' as const),
      }),
      fc.record({ type: fc.constant('BuyBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({ type: fc.constant('PlaceKopdes' as const), block: fc.constantFrom(...blocks) }),
      fc.record({ type: fc.constant('HarvestBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({
        type: fc.constant('FertilizeBlock' as const),
        block: fc.constantFrom(...blocks),
      }),
      fc.record({ type: fc.constant('UpgradeKopdes' as const) }),
      fc.record({
        type: fc.constant('BuyItem' as const),
        item: fc.constantFrom(
          'bibit' as const,
          'fertilizer' as const,
          'forestSapling' as const,
          'sanitationCrew' as const,
          'pheromoneTrap' as const,
          'metarhizium' as const,
          'trichoderma' as const,
        ),
        quantity: fc.integer({ min: 1, max: 300 }),
      }),
      fc.record({
        type: fc.constant('BurnBlock' as const),
        block: fc.constantFrom(...blocks),
        intensity: fc.constantFrom(1 as const, 2 as const, 3 as const),
      }),
      fc.record({ type: fc.constant('SanitizeBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({ type: fc.constant('IrrigateBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({ type: fc.constant('DrainBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({ type: fc.constant('SetTrap' as const), block: fc.constantFrom(...blocks) }),
      fc.record({
        type: fc.constant('ApplyMetarhizium' as const),
        block: fc.constantFrom(...blocks),
      }),
      fc.record({
        type: fc.constant('ApplyTrichoderma' as const),
        block: fc.constantFrom(...blocks),
      }),
      fc.record({
        type: fc.constant('RemovePalm' as const),
        block: fc.constantFrom(...blocks),
        slot: fc.integer({ min: 0, max: 150 }),
      }),
      fc.record({
        type: fc.constant('TrenchPalm' as const),
        block: fc.constantFrom(...blocks),
        slot: fc.integer({ min: 0, max: 150 }),
      }),
      fc.record({ type: fc.constant('ReplantBlock' as const), block: fc.constantFrom(...blocks) }),
      fc.record({
        type: fc.constant('CoverCropBlock' as const),
        block: fc.constantFrom(...blocks),
      }),
    );

  function fingerprint(sim: Sim): string {
    const { state } = sim;
    const blocks = [...state.blocks.entries()].sort(([a], [b]) => a - b);
    const palms = [...state.palms.entries()]
      .sort(([a], [b]) => a - b)
      .map(([id, p]) => [
        id,
        Array.from(p.growth),
        Array.from(p.plantedAt),
        Array.from(p.yieldAcc),
      ]);
    return JSON.stringify({
      tick: state.tick,
      rng: state.rng,
      cash: state.economy.cash,
      weather: state.weather,
      blocks,
      palms,
    });
  }

  it('property: any command log replayed against the same seed yields identical state', () => {
    const probe = createSim(42);
    const owned = [...probe.state.blocks.values()].filter((b) => b.owned).map((b) => b.id);
    const nearby = owned.flatMap((id) => {
      const [x, y] = probe.world.toXY(id);
      return probe.world.inBounds(x + 1, y) ? [probe.world.toId(x + 1, y)] : [];
    });
    const blocks = [...new Set([...owned, ...nearby])];

    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 0, max: 40 }), commandArb(blocks)), {
          minLength: 1,
          maxLength: 12,
        }),
        (script) => {
          const run = (): string => {
            const sim = createSim(42);
            for (const [gap, command] of script) {
              for (let i = 0; i < gap; i++) sim.tick();
              sim.dispatch(command);
            }
            for (let i = 0; i < 60; i++) sim.tick();
            return fingerprint(sim);
          };
          expect(run()).toBe(run());
        },
      ),
      { numRuns: 40 },
    );
  });

  it('the command log alone is enough to rebuild a run', () => {
    const a = createSim(1234);
    const block = firstOwnedWild(a);
    chopAndPlant(a, block);
    for (let i = 0; i < 400; i++) a.tick();
    a.dispatch({ type: 'BuyBlock', block: firstBuyable(a) });
    for (let i = 0; i < 200; i++) a.tick();

    const b = createSim(1234);
    for (const record of a.state.commandLog) {
      while (b.state.tick < record.tick) b.tick();
      expect(b.dispatch(record.command)).toEqual({ ok: true });
    }
    while (b.state.tick < a.state.tick) b.tick();

    expect(fingerprint(b)).toBe(fingerprint(a));
  });

  it('two seeds diverge', () => {
    const a = createSim(1);
    const b = createSim(2);
    for (let i = 0; i < 30; i++) {
      a.tick();
      b.tick();
    }
    expect(a.state.weather.rain).not.toBe(b.state.weather.rain);
  });
});

describe('performance guardrails (§10.3)', () => {
  it('ticks a planted estate well under the 2 ms budget', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 6 * SLOTS_PER_BLOCK });
    // Plant several blocks so growth has real work to do.
    let planted = 0;
    for (const block of [...sim.state.blocks.values()]) {
      if (planted >= 6) break;
      if (!block.owned || block.phase !== 'wild' || !BIOMES[block.biome].clearable) continue;
      if (sim.dispatch({ type: 'ChopBlock', block: block.id }).ok) planted += 1;
    }
    for (let i = 0; i < 50; i++) sim.tick();
    for (const block of [...sim.state.blocks.values()]) {
      if (block.phase === 'cleared')
        sim.dispatch({ type: 'PlantBlock', block: block.id, species: 'palm' });
    }
    expect(sim.state.palms.size).toBeGreaterThanOrEqual(3);

    // Warm up, then measure.
    for (let i = 0; i < 100; i++) sim.tick();
    const t0 = performance.now();
    const n = 1000;
    for (let i = 0; i < n; i++) sim.tick();
    const perTick = (performance.now() - t0) / n;
    expect(perTick).toBeLessThan(2);
  });

  it('the active set covers the estate and its ring, not the world', () => {
    const sim = createSim(42);
    sim.tick();
    const { active, blocks } = sim.state;
    for (const block of blocks.values()) if (block.owned) expect(active.has(block.id)).toBe(true);
    expect(active.size).toBeLessThan(200);
    expect(active.size).toBeGreaterThan(60);
  });
});
