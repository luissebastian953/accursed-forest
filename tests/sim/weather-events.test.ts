import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import {
  ASH,
  COVER_CROP,
  DROUGHT,
  EXCAVATION,
  FLOOD,
  HAZE,
  LANDSLIDE,
} from '@sim/balance/events.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { SKY } from '@sim/balance/seasons.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { EventSink } from '@sim/events.ts';
import { ASH_EVENT, DROUGHT_EVENT, FLOOD_EVENT, HAZE_EVENT, activeEvent } from '@sim/fire.ts';
import { createSim, type Sim } from '@sim/index.ts';
import {
  coverCropEstablished,
  estateForestCover,
  forestCoverAround,
  landslideChance,
  slide,
} from '@sim/landscape.ts';
import { slotStage } from '@sim/palms.ts';
import { writeBlock } from '@sim/state.ts';
import { workedBlocks } from '@sim/systems/mobs.ts';
import { skyFor } from '@sim/systems/weather.ts';
import type { BlockId } from '@sim/types.ts';

function ownedWild(sim: Sim): BlockId[] {
  const out: BlockId[] = [];
  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) out.push(block.id);
  }
  return out;
}

/** The owned, wild, clearable block nearest the Kopdes block; inside its range. */
function nearWild(sim: Sim): BlockId {
  const [kx, ky] = sim.world.toXY(sim.state.worldGen.kopdesBlock);
  let best = -1;
  let bestD = Infinity;
  for (const id of ownedWild(sim)) {
    const [x, y] = sim.world.toXY(id);
    const d = Math.abs(x - kx) + Math.abs(y - ky);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
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

function plant(sim: Sim, block: BlockId): void {
  if (!sim.state.kopdes)
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
  const b = writeBlock(sim.state, sim.world, block);
  b.phase = 'cleared';
  b.debris = 0;
  sim.state.economy.cash = 1_000_000_000;
  expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: SLOTS_PER_BLOCK })).toEqual({
    ok: true,
  });
  expect(sim.dispatch({ type: 'PlantBlock', block, species: 'palm' })).toEqual({ ok: true });
}

function startEvent(sim: Sim, id: string, days: number, blocks?: BlockId[]): void {
  const event = { id, startedAt: sim.state.tick + 1, endsAt: sim.state.tick + 1 + days };
  sim.state.weather.activeEvents.push(blocks ? { ...event, blocks } : event);
}

describe('event deck (§3.6)', () => {
  it('deals about one event a year, and ash is rare', () => {
    const counts: Record<string, number> = {};
    const years = 3 * 25;
    for (const seed of [11, 12, 13]) {
      const sim = createSim(seed);
      for (let i = 0; i < 25 * GROWTH.daysPerYear; i++) {
        for (const e of sim.tick()) {
          if (e.type === 'WeatherEventStarted') counts[e.id] = (counts[e.id] ?? 0) + 1;
        }
      }
    }
    const perYear = (id: string): number => (counts[id] ?? 0) / years;
    const dealt = perYear('haze') + perYear('flood') + perYear('ash');
    expect(dealt).toBeGreaterThan(0.6);
    expect(dealt).toBeLessThan(2.2);
    expect(perYear('ash')).toBeLessThan(0.25);
  });

  it('an event that cannot be drawn does not hand its share to the rare ones', () => {
    // With a flood held open all year, wet-season draws must not become ash falls.
    let ash = 0;
    const years = 40;
    for (let seed = 1; seed <= years; seed++) {
      const sim = createSim(seed);
      for (let i = 0; i < GROWTH.daysPerYear; i++) {
        const s = sim.state;
        if (!activeEvent(s, FLOOD_EVENT)) {
          s.weather.activeEvents.push({
            id: FLOOD_EVENT,
            startedAt: s.tick,
            endsAt: s.tick + 1000,
            blocks: [],
          });
        }
        for (const e of sim.tick())
          if (e.type === 'WeatherEventStarted' && e.id === ASH_EVENT) ash += 1;
      }
    }
    expect(ash / years).toBeLessThan(0.3);
  });

  it('is deterministic per seed', () => {
    const run = (): string[] => {
      const sim = createSim(5);
      const seen: string[] = [];
      for (let i = 0; i < 6 * GROWTH.daysPerYear; i++) {
        for (const e of sim.tick()) {
          if (e.type === 'WeatherEventStarted') seen.push(`${sim.state.tick}:${e.id}:${e.days}`);
        }
      }
      return seen;
    };
    expect(run()).toEqual(run());
  });

  it('events end on schedule and announce it', () => {
    const sim = createSim(42);
    startEvent(sim, HAZE_EVENT, 5);
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      for (const e of sim.tick()) if (e.type === 'WeatherEventEnded') seen.push(e.id);
    }
    expect(seen).toContain(HAZE_EVENT);
    expect(activeEvent(sim.state, HAZE_EVENT)).toBeUndefined();
  });
});

describe('haze and ash (§3.6)', () => {
  it('regional haze dims the sun to 0.7 and pulls the TBS price down', () => {
    // Twin runs share every random draw; only the haze differs.
    const hazed = createSim(42);
    const clear = createSim(42);
    startEvent(hazed, HAZE_EVENT, 400);
    let sunMax = 0;
    for (let i = 0; i < 360; i++) {
      hazed.tick();
      clear.tick();
      sunMax = Math.max(sunMax, hazed.state.weather.sun);
    }
    expect(sunMax).toBeLessThanOrEqual(HAZE.light + 1e-9);
    const gap = clear.state.economy.tbsPrice - hazed.state.economy.tbsPrice;
    expect(gap).toBeGreaterThan(2650 * HAZE.priceDip * 0.8);
  });

  it('ash dims the sun, scorches young fronds, then leaves the estate fertile', () => {
    const sim = createSim(42);
    const young = ownedWild(sim)[0]!;
    plant(sim, young);
    const palms = sim.state.palms.get(young)!;

    startEvent(sim, ASH_EVENT, 6);
    sim.tick();
    expect(sim.state.weather.sun).toBeLessThanOrEqual(ASH.light + 1e-9);
    const before = palms.health[0]!;
    for (let i = 0; i < 3; i++) sim.tick();
    expect(palms.health[0]).toBeLessThan(before);

    const seen: string[] = [];
    for (let i = 0; i < 5; i++) for (const e of sim.tick()) seen.push(e.type);
    expect(seen).toContain('AshSettled');
    expect(sim.state.blocks.get(young)!.ashUntil).toBeGreaterThan(
      sim.state.tick + ASH.fertileDays - 10,
    );
  });

  it('the harvest refusal during ash says why', () => {
    const sim = createSim(42);
    const block = nearWild(sim);
    plant(sim, block);
    tickUntil(
      sim,
      () => slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature',
      1600,
    );
    tickUntil(sim, () => sim.validate({ type: 'HarvestBlock', block }) === null, 40);
    expect(sim.validate({ type: 'HarvestBlock', block })).toBeNull();
    startEvent(sim, ASH_EVENT, 5);
    sim.tick();
    expect(sim.validate({ type: 'HarvestBlock', block })).toMatchObject({ code: 'halted' });
  });
});

describe('flood (§3.6)', () => {
  it('drowns young palms on low river ground, washes fertilizer out, spares drained blocks', () => {
    const sim = createSim(42);
    const [wet, dry] = ownedWild(sim);
    plant(sim, wet!);
    plant(sim, dry!);
    sim.dispatch({ type: 'DrainBlock', block: dry! });
    sim.dispatch({ type: 'BuyItem', item: 'fertilizer', quantity: 1 });
    sim.dispatch({ type: 'FertilizeBlock', block: wet! });

    startEvent(sim, FLOOD_EVENT, 10, [wet!, dry!]);
    let died = 0;
    for (let i = 0; i < 10; i++) {
      for (const e of sim.tick()) if (e.type === 'PalmDied' && e.cause === 'flood') died += 1;
    }

    expect(died).toBe(SLOTS_PER_BLOCK);
    expect(sim.state.blocks.get(wet!)!.fertilizedUntil).toBeLessThanOrEqual(sim.state.tick);
    expect(sim.state.blocks.get(wet!)!.debris).toBeGreaterThan(FLOOD.debrisPerDay * 5);
    const dryPalms = sim.state.palms.get(dry!)!;
    expect(dryPalms.health.every((h, i) => dryPalms.plantedAt[i]! < 0 || h === 255)).toBe(true);
  });
});

describe('drought (§3.6)', () => {
  it('an El Niño dry season brings drought, dries unirrigated land, and real rain breaks it', () => {
    const sim = createSim(42);
    const [bare, watered] = ownedWild(sim);
    sim.state.economy.cash = 1_000_000_000;
    sim.dispatch({ type: 'IrrigateBlock', block: watered! });

    let started = false;
    for (let i = 0; i < 6 * GROWTH.daysPerYear && !started; i++) {
      sim.state.weather.regime = 'elNino';
      started = sim.tick().some((e) => e.type === 'WeatherEventStarted' && e.id === DROUGHT_EVENT);
    }
    expect(started).toBe(true);
    for (let i = 0; i < 5; i++) {
      sim.state.weather.regime = 'elNino';
      sim.tick();
    }
    if (activeEvent(sim.state, DROUGHT_EVENT)) {
      expect(sim.state.blocks.get(bare!)!.moisture).toBeLessThan(
        sim.state.blocks.get(watered!)!.moisture,
      );
    }

    // El Niño keeps the rain under the breaking point for years on end, which
    // is the point of it; a wet regime is what ends a drought. A short one may
    // already have broken during the five ticks above.
    let ended = !activeEvent(sim.state, DROUGHT_EVENT);
    for (let i = 0; i < 2 * GROWTH.daysPerYear && !ended; i++) {
      sim.state.weather.regime = 'laNina';
      if (sim.tick().some((e) => e.type === 'WeatherEventEnded' && e.id === DROUGHT_EVENT)) {
        ended = true;
        expect(sim.state.weather.rain).toBeGreaterThanOrEqual(DROUGHT.breaksAtRain);
      }
    }
    expect(ended).toBe(true);
    expect(activeEvent(sim.state, DROUGHT_EVENT)).toBeUndefined();
  });

  it('a dry year visibly delays first harvest (M1e done-criterion)', () => {
    const days = (regime: 'normal' | 'elNino'): number => {
      const sim = createSim(42);
      const block = ownedWild(sim)[0]!;
      plant(sim, block);
      const plantedAt = sim.state.tick;
      tickUntil(
        sim,
        () => {
          sim.state.weather.regime = regime;
          return slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature';
        },
        2000,
      );
      return sim.state.tick - plantedAt;
    };
    expect(days('elNino') - days('normal')).toBeGreaterThan(60);
  });
});

describe('forest cover (§3.6.2)', () => {
  it('is a share in 0..1 and falls when forest is cleared', () => {
    const sim = createSim(1); // a forest-heavy start
    const forest = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.biome === 'forest' && b.phase === 'wild',
    );
    expect(forest).toBeDefined();
    const before = forestCoverAround(sim.state, sim.world, forest!.id);
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThanOrEqual(1);

    writeBlock(sim.state, sim.world, forest!.id).phase = 'cleared';
    expect(forestCoverAround(sim.state, sim.world, forest!.id)).toBeLessThan(before);
    const estate = estateForestCover(sim.state, sim.world);
    expect(estate).toBeGreaterThanOrEqual(0);
    expect(estate).toBeLessThanOrEqual(1);
  });

  it('reforested land counts half while young and fully once mature (§3.10)', () => {
    const sim = createSim(42);
    const block = ownedWild(sim)[0]!;
    writeBlock(sim.state, sim.world, block).phase = 'cleared';
    sim.state.economy.cash = 1_000_000_000;
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.dispatch({ type: 'BuyItem', item: 'forestSapling', quantity: SLOTS_PER_BLOCK });
    expect(sim.dispatch({ type: 'PlantBlock', block, species: 'forest' })).toEqual({ ok: true });

    const own = (): number => forestCoverAround(sim.state, sim.world, block, 0);
    expect(own()).toBe(0);
    sim.state.palms.get(block)!.growth.fill(400);
    expect(own()).toBeCloseTo(0.5, 6);
    sim.state.palms.get(block)!.growth.fill(5000);
    expect(own()).toBeCloseTo(1, 6);
  });
});

describe('landslides (§3.6.2)', () => {
  it('only slopes slide, only in the wet season', () => {
    const sim = createSim(42);
    const block = { ...sim.world.block(10, 10), slope: true, phase: 'planted' as const };
    sim.state.weather.wetStreak = 6;
    expect(landslideChance(sim.state, sim.world, { ...block, slope: false }, true)).toBe(0);
    expect(landslideChance(sim.state, sim.world, block, false)).toBe(0);
    expect(landslideChance(sim.state, sim.world, block, true)).toBeGreaterThanOrEqual(0);
  });

  it('a cover crop halves the chance, but only once established', () => {
    const sim = createSim(42);
    const block = ownedWild(sim)[0]!;
    const b = writeBlock(sim.state, sim.world, block);
    b.slope = true;
    b.phase = 'cleared';
    sim.state.weather.wetStreak = 6;
    const bare = landslideChance(sim.state, sim.world, b, true);

    expect(sim.dispatch({ type: 'CoverCropBlock', block })).toEqual({ ok: true });
    expect(sim.dispatch({ type: 'CoverCropBlock', block })).toMatchObject({ code: 'occupied' });
    expect(coverCropEstablished(b, sim.state.tick)).toBe(false);
    expect(landslideChance(sim.state, sim.world, b, true)).toBeCloseTo(bare, 9);

    sim.state.tick += COVER_CROP.establishDays;
    expect(coverCropEstablished(b, sim.state.tick)).toBe(true);
    expect(landslideChance(sim.state, sim.world, b, true)).toBeCloseTo(
      bare * LANDSLIDE.coverCropFactor,
      9,
    );
  });

  it('a slide takes the palms, tears the block to debris and dumps spoil downhill', () => {
    const sim = createSim(1);
    const high = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.slope && b.phase === 'wild',
    );
    expect(high).toBeDefined();
    plant(sim, high!.id);
    const planted = BIOMES[sim.state.blocks.get(high!.id)!.biome].plantableSlots;

    const sink = new EventSink();
    slide(sim.state, sim.world, sink, high!.id);
    const landslide = sink.drain().find((e) => e.type === 'Landslide');
    if (!landslide || landslide.type !== 'Landslide') throw new Error('no Landslide event');

    expect(landslide.block).toBe(high!.id);
    expect(landslide.palmsLost).toBe(planted);
    expect(sim.state.palms.has(high!.id)).toBe(false);
    expect(sim.state.blocks.get(high!.id)!.phase).toBe('cleared');
    expect(sim.state.blocks.get(high!.id)!.debris).toBeGreaterThanOrEqual(LANDSLIDE.debrisOnBlock);
    if (landslide.below !== null) {
      expect(sim.state.blocks.get(landslide.below)!.debris).toBeGreaterThanOrEqual(
        LANDSLIDE.debrisBelow,
      );
    }
  });

  it('the block keeps the scar, with what it buried, until it is planted again', () => {
    const sim = createSim(1);
    const high = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.slope && b.phase === 'wild',
    );
    expect(high).toBeDefined();
    plant(sim, high!.id);
    const planted = BIOMES[sim.state.blocks.get(high!.id)!.biome].plantableSlots;
    expect(sim.state.blocks.get(high!.id)!.landslideAt).toBe(-1);

    sim.state.tick += 200;
    slide(sim.state, sim.world, new EventSink(), high!.id);
    const scarred = sim.state.blocks.get(high!.id)!;
    expect(scarred.landslideAt).toBe(sim.state.tick);
    expect(scarred.landslidePalms).toBe(planted);

    // Debris has to go before anything is planted, and then the scar goes too.
    writeBlock(sim.state, sim.world, high!.id).debris = 0;
    sim.state.economy.cash = 1_000_000_000;
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: SLOTS_PER_BLOCK })).toEqual({
      ok: true,
    });
    expect(sim.dispatch({ type: 'PlantBlock', block: high!.id, species: 'palm' })).toEqual({
      ok: true,
    });
    expect(sim.state.blocks.get(high!.id)!.landslideAt).toBe(-1);
    expect(sim.state.blocks.get(high!.id)!.landslidePalms).toBe(0);
  });

  it('an excavation crew digs the slide out, and the hectare is ground again', () => {
    const sim = createSim(1);
    const { state } = sim;
    const high = [...state.blocks.values()].find((b) => b.owned && b.slope && b.phase === 'wild');
    expect(high).toBeDefined();
    plant(sim, high!.id);
    slide(sim.state, sim.world, new EventSink(), high!.id);
    const block = () => sim.state.blocks.get(high!.id)!;
    expect(block().landslideAt).toBeGreaterThanOrEqual(0);
    expect(block().debris).toBeGreaterThan(0);

    // Nothing to dig without a crew in stock, and nothing to dig on clean land.
    expect(sim.validate({ type: 'ExcavateBlock', block: high!.id })).toMatchObject({
      code: 'noInventory',
    });
    state.economy.cash = 1_000_000_000;
    expect(sim.dispatch({ type: 'BuyItem', item: 'excavationCrew', quantity: 1 })).toEqual({
      ok: true,
    });
    expect(sim.dispatch({ type: 'ExcavateBlock', block: high!.id })).toEqual({ ok: true });
    expect(state.inventory.excavationCrew).toBe(0);
    // Once is enough: the second order is turned away while they are on it.
    expect(sim.validate({ type: 'ExcavateBlock', block: high!.id })).toMatchObject({
      code: 'occupied',
    });
    // And they are on the block from the first day, not the second.
    expect([...workedBlocks(state)]).toContain(high!.id);

    for (let day = 0; day < EXCAVATION.days; day++) {
      expect(block().landslideAt).toBeGreaterThanOrEqual(0);
      sim.tick();
    }
    // Spoil, scar and debris all gone together.
    expect(block().landslideAt).toBe(-1);
    expect(block().landslidePalms).toBe(0);
    expect(block().debris).toBe(0);
    expect(block().excavateUntil).toBe(-1);
    // The crew has no reason to stay.
    sim.tick();
    expect([...workedBlocks(sim.state)]).not.toContain(high!.id);
  });

  it(
    'a wet year on a bare hillside costs you a block; a forested one usually does not (M1e done-criterion)',
    { timeout: 20_000 },
    () => {
      const SEEDS = 40;
      const runs = (forested: boolean): number => {
        let slid = 0;
        for (let seed = 1; seed <= SEEDS; seed++) {
          const sim = createSim(seed);
          const block = ownedWild(sim)[0]!;
          const [x, y] = sim.world.toXY(block);
          // Surround the slope with forest, or strip it bare.
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (!sim.world.inBounds(x + dx, y + dy) || (dx === 0 && dy === 0)) continue;
              const n = writeBlock(sim.state, sim.world, sim.world.toId(x + dx, y + dy));
              n.biome = forested ? 'forest' : 'grassfield';
              n.phase = forested ? 'wild' : 'cleared';
            }
          }
          const b = writeBlock(sim.state, sim.world, block);
          b.slope = true;
          b.biome = 'grassfield';
          plant(sim, block);
          for (let i = 0; i < 2 * GROWTH.daysPerYear; i++) {
            sim.state.weather.regime = 'laNina';
            if (sim.tick().some((e) => e.type === 'Landslide' && e.block === block)) {
              slid += 1;
              break;
            }
          }
        }
        return slid;
      };
      // Statistical, so over 40 seeds: measured ~75% bare against ~15% forested.
      const bare = runs(false);
      const forested = runs(true);
      expect(bare).toBeGreaterThanOrEqual(SEEDS * 0.55);
      expect(forested).toBeLessThanOrEqual(SEEDS * 0.3);
      expect(bare).toBeGreaterThanOrEqual(forested * 3);
    },
  );
});

describe('the sky and its lightning (§3.6)', () => {
  it('reads the day off its rain: sun, cloud, rain, thunder', () => {
    expect(skyFor(0)).toBe('clear');
    expect(skyFor(SKY.cloudyAbove)).toBe('cloudy');
    expect(skyFor(SKY.rainAbove)).toBe('rain');
    expect(skyFor(SKY.stormAbove)).toBe('storm');
    expect(skyFor(1)).toBe('storm');
  });

  it('the sky holds for a spell of days rather than flipping every morning', () => {
    const sim = createSim(42);
    let changes = 0;
    let last = sim.state.weather.sky;
    for (let i = 0; i < 2 * GROWTH.daysPerYear; i++) {
      sim.tick();
      if (sim.state.weather.sky !== last) changes += 1;
      last = sim.state.weather.sky;
    }
    // Spells of 3–7 days, storms excepted: well under one change a day.
    expect(changes).toBeLessThan(GROWTH.daysPerYear * 2 * 0.4);
    expect(changes).toBeGreaterThan(40);
  });

  it('a few years have all four kinds of day, not just rain', () => {
    // Skies hold for spells of a week or two now, so a single year samples the
    // rain only a few dozen times; three years is enough to see every kind.
    const sim = createSim(42);
    const seen = new Set<string>();
    for (let i = 0; i < 1080; i++) {
      sim.tick();
      seen.add(sim.state.weather.sky);
    }
    expect([...seen].sort()).toEqual(['clear', 'cloudy', 'rain', 'storm']);
  });

  it('lightning only falls in a storm, near the estate, and sometimes starts a fire', () => {
    let strikes = 0;
    let fires = 0;
    let stormDays = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const sim = createSim(seed);
      for (let i = 0; i < 1080; i++) {
        const storm = (() => {
          const events = sim.tick();
          return events.filter((e) => e.type === 'LightningStruck');
        })();
        if (sim.state.weather.sky === 'storm') stormDays += 1;
        for (const strike of storm) {
          expect(sim.state.weather.sky).toBe('storm');
          strikes += 1;
          // A wet storm can douse its own fire the same day; a dry one cannot.
          if (strike.ignited && sim.state.blocks.get(strike.block)?.burning === true) fires += 1;
        }
      }
    }
    expect(stormDays).toBeGreaterThan(100);
    expect(strikes).toBeGreaterThan(20);
    expect(fires).toBeGreaterThan(0);
  });

  it("a lightning fire is nobody's fault: no pressure, no attention", () => {
    const sim = createSim(3);
    let struck = false;
    for (let i = 0; i < 2000 && !struck; i++) {
      for (const e of sim.tick()) if (e.type === 'LightningStruck' && e.ignited) struck = true;
    }
    expect(struck).toBe(true);
    expect(sim.state.society.firePressure).toBe(0);
    expect(sim.state.society.attention).toBe(0);
  });
});
