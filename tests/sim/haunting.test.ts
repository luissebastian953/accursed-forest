import { describe, expect, it } from 'vitest';

import { deserializeState, serializeState } from '@persistence/schema.ts';
import { EXCAVATION } from '@sim/balance/events.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { HAUNT } from '@sim/balance/haunting.ts';
import { WORKERS_FROM_LEVEL, WORKER_JOBS } from '@sim/balance/mobs.ts';
import { CLEAR_PLANTATION } from '@sim/balance/prices.ts';
import { GRAVES, SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { EventSink, type SimEvent } from '@sim/events.ts';
import {
  blockHauntStage,
  hauntStage,
  isGrave,
  missingFruit,
  wasGrave,
  workerFactor,
} from '@sim/haunting.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { createPalmArrays, plantSlots } from '@sim/palms.ts';
import { writeBlock } from '@sim/state.ts';
import { pickBlock } from '@sim/systems/harvest.ts';
import { workedBlocks } from '@sim/systems/mobs.ts';
import type { BlockId, Mob } from '@sim/types.ts';
import { createWorld } from '@sim/worldgen/index.ts';

const YEAR = GROWTH.daysPerYear;
const SEEDS = [1, 42, 1234, 99_999, 0x7fffffff];

/** Every grave block the world generated. */
function graveBlocks(sim: Sim): BlockId[] {
  const { world } = sim;
  const out: BlockId[] = [];

  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.generated(x, y).biome === 'grave') out.push(world.toId(x, y));
    }
  }

  return out;
}

/** Title to the first grave, a Kopdes big enough for a payroll, and a crew on the shelf. */
function estateWithGrave(seed = 42): { sim: Sim; grave: BlockId } {
  const sim = createSim(seed);
  const { state, world } = sim;
  const grave = graveBlocks(sim)[0]!;

  // Years in, so a haunting can be backdated without the clock going negative.
  state.tick = 5 * YEAR;
  state.weather.dayOfYear = 0;
  sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock });
  state.kopdes!.level = WORKERS_FROM_LEVEL;
  state.economy.cash = 5e9;
  writeBlock(state, world, grave).owned = true;
  state.inventory.excavationCrew = 1;
  return { sim, grave };
}

function run(sim: Sim, days: number, onEvent?: (e: SimEvent) => void): void {
  for (let i = 0; i < days; i++) for (const e of sim.tick()) onEvent?.(e);
}

/** Dig the grave out and plant palms on it, the whole way through. */
function plantGrave(sim: Sim, grave: BlockId): void {
  expect(sim.dispatch({ type: 'ExcavateBlock', block: grave })).toEqual({ ok: true });
  run(sim, EXCAVATION.days + 1);
  expect(sim.state.blocks.get(grave)!.phase).toBe('cleared');
  sim.state.inventory.bibit = SLOTS_PER_BLOCK;
  expect(sim.dispatch({ type: 'PlantBlock', block: grave, species: 'palm' })).toEqual({ ok: true });
}

/** A bearing stand with fruit on it, on this block. */
function bearing(sim: Sim, id: BlockId): void {
  const { state, world } = sim;
  const block = writeBlock(state, world, id);

  block.owned = true;
  block.phase = 'planted';
  block.species = 'palm';
  block.clearProgress = 1;
  block.lastHarvest = state.tick - 5;

  const palms = createPalmArrays();

  plantSlots(palms, SLOTS_PER_BLOCK, 0);
  palms.growth.fill(3000);
  palms.yieldAcc.fill(3);
  state.palms.set(id, palms);
}

/** Pick `id` on `rounds` different days and count what the dead took. */
function pickRounds(sim: Sim, id: BlockId, rounds: number): { picked: number; missing: number } {
  const { state, world } = sim;
  const events = new EventSink();
  let picked = 0;
  let missing = 0;

  for (let round = 0; round < rounds; round++) {
    state.tick += 5;

    const palms = state.palms.get(id)!;

    palms.yieldAcc.fill(3);
    picked += pickBlock({ state, world, events }, id, false);
  }

  for (const e of events.drain()) if (e.type === 'HarvestHaunted') missing += e.kilograms;
  return { picked, missing };
}

const spectre = (m: Mob): boolean => m.species === 'ghost' || m.species === 'pocong';

describe('mass graves in the world (GDD 3.11)', () => {
  it('every world has a site or two of low, unmarked ground outside the free square', () => {
    for (const seed of SEEDS) {
      const world = createWorld(seed);
      const graves: [number, number][] = [];

      for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
          if (world.generated(x, y).biome === 'grave') graves.push([x, y]);
        }
      }

      expect(graves.length, `seed ${seed}`).toBeGreaterThanOrEqual(GRAVES.min * GRAVES.minSize);
      expect(graves.length, `seed ${seed}`).toBeLessThanOrEqual(GRAVES.max * GRAVES.maxSize);

      const { start } = world;

      for (const [x, y] of graves) {
        const g = world.generated(x, y);

        expect(g.forSale).toBe(true);
        expect(g.elevation).toBeLessThanOrEqual(GRAVES.maxElevation);

        const inside =
          x >= start.x - GRAVES.startClearance &&
          x < start.x + start.size + GRAVES.startClearance &&
          y >= start.y - GRAVES.startClearance &&
          y < start.y + start.size + GRAVES.startClearance;

        expect(inside, `seed ${seed}: grave at ${x}, ${y} is on the doorstep`).toBe(false);

        // Never beside a village.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!world.inBounds(x + dx, y + dy)) continue;
            expect(world.generated(x + dx, y + dy).biome).not.toBe('village');
          }
        }
      }
    }
  });

  it('is dug out, never chopped or burned, and comes up as cleared land with the dead in it', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;

    expect(isGrave(state.blocks.get(grave)!)).toBe(true);
    expect(wasGrave(state.blocks.get(grave)!)).toBe(false);
    expect(sim.validate({ type: 'ChopBlock', block: grave })).toMatchObject({ code: 'wrongPhase' });
    expect(sim.validate({ type: 'BurnBlock', block: grave, intensity: 1 })).toMatchObject({
      code: 'noFuel',
    });
    expect(sim.validate({ type: 'PlantBlock', block: grave, species: 'palm' })).toMatchObject({
      code: 'wrongPhase',
    });

    // The crew is the only way in, and it has to be on the shelf.
    state.inventory.excavationCrew = 0;
    expect(sim.validate({ type: 'ExcavateBlock', block: grave })).toMatchObject({
      code: 'noInventory',
    });
    state.inventory.excavationCrew = 1;
    expect(sim.dispatch({ type: 'ExcavateBlock', block: grave })).toEqual({ ok: true });
    expect(workedBlocks(state).has(grave)).toBe(true);
    expect(state.blocks.get(grave)!.phase).toBe('wild');

    let dug = false;

    run(sim, EXCAVATION.days + 1, (e) => {
      if (e.type === 'GraveExcavated' && e.block === grave) dug = true;
    });

    const block = state.blocks.get(grave)!;

    expect(dug).toBe(true);
    expect(block.phase).toBe('cleared');
    expect(block.biome).toBe('grave');
    // What came up, less the day's rot.
    expect(block.debris).toBeCloseTo(HAUNT.exhumedDebris, 0);
    expect(wasGrave(block)).toBe(true);
    expect(block.hauntedSince).toBe(-1);
    expect(hauntStage(state)).toBe(0);
  });
});

describe('the haunting (GDD 3.11)', () => {
  it('starts the day the grave is planted, and keeps a few of the dead on the block', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;
    let started = false;

    plantGrave(sim, grave);
    for (const e of sim.tick())
      if (e.type === 'HauntingStarted' && e.block === grave) started = true;
    expect(state.blocks.get(grave)!.hauntedSince).toBeGreaterThanOrEqual(0);
    expect(blockHauntStage(state.blocks.get(grave)!, state.tick)).toBe(1);
    expect(hauntStage(state)).toBe(1);
    // The first stage is the grave's own business: the workers are still whole.
    expect(workerFactor(state)).toBe(1);

    let most = 0;
    let elsewhere = 0;

    run(sim, 120, () => {
      let here = 0;

      for (const mob of state.mobs) {
        if (!spectre(mob)) continue;
        if (mob.target === grave) here += 1;
        else elsewhere += 1;
      }

      most = Math.max(most, here);
    });
    expect(started || state.blocks.get(grave)!.hauntedSince >= 0).toBe(true);
    expect(most).toBeGreaterThanOrEqual(HAUNT.onGrave.min);
    expect(most).toBeLessThanOrEqual(HAUNT.onGrave.max);
    expect(elsewhere).toBe(0);
  });

  it('raises both kinds: the drifting ghost and the hopping pocong', () => {
    const seen = new Set<string>();

    for (const seed of [42, 7, 1234]) {
      const { sim, grave } = estateWithGrave(seed);

      plantGrave(sim, grave);
      run(sim, 200, (e) => {
        if (e.type === 'MobArrived' && (e.species === 'ghost' || e.species === 'pocong'))
          seen.add(e.species);
      });
    }

    expect([...seen].sort()).toEqual(['ghost', 'pocong']);
  });

  it('takes a share of the grave block’s fruit, and only the grave block’s, at first', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;

    plantGrave(sim, grave);
    bearing(sim, grave);

    const other = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!.id;

    bearing(sim, other);

    const haunted = pickRounds(sim, grave, 40);
    const clean = pickRounds(sim, other, 40);

    expect(haunted.missing).toBeGreaterThan(0);
    expect(haunted.picked + haunted.missing).toBeCloseTo(40 * SLOTS_PER_BLOCK * 3, 3);
    expect(haunted.missing / (haunted.picked + haunted.missing)).toBeLessThan(
      HAUNT.missingShare.max,
    );
    expect(clean.missing).toBe(0);
    expect(clean.picked).toBeCloseTo(40 * SLOTS_PER_BLOCK * 3, 3);
  });

  it('spreads after two years: the dead walk the whole estate and the hired hands slow down', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;

    plantGrave(sim, grave);

    const block = state.blocks.get(grave)!;

    // Stand on the eve of the second anniversary and step over it.
    block.hauntedSince = state.tick + 1 - HAUNT.spreadAfterYears * YEAR;

    const stages: number[] = [];

    for (const e of sim.tick()) if (e.type === 'HauntingStage') stages.push(e.stage);
    expect(stages).toEqual([2]);
    expect(hauntStage(state)).toBe(2);
    expect(workerFactor(state)).toBe(HAUNT.workerFactor);
    expect(state.society.news.some((n) => n.key === 'estate.haunting')).toBe(true);

    // A sanitizer clears the messiest block at half its usual pace.
    const messy = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;

    messy.phase = 'cleared';
    messy.debris = 100;
    expect(sim.dispatch({ type: 'HireWorker', kind: 'sanitizer' })).toEqual({ ok: true });

    let roaming = 0;
    let cleared = 0;
    let before = messy.debris;

    run(sim, 120, () => {
      for (const mob of state.mobs) if (spectre(mob) && mob.target !== grave) roaming += 1;

      if (messy.debris < before) {
        cleared = Math.max(cleared, before - messy.debris);
        before = messy.debris;
      }
    });
    expect(roaming).toBeGreaterThan(0);
    expect(cleared).toBeGreaterThan(0);
    // Half a day's clearing, plus the little that rots on its own each day.
    expect(cleared).toBeLessThanOrEqual(WORKER_JOBS.sanitizePerDay * HAUNT.workerFactor + 0.1);
  });

  it('deepens after four years: fruit goes missing from every block', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;

    plantGrave(sim, grave);

    const other = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!.id;

    bearing(sim, other);
    state.blocks.get(grave)!.hauntedSince = state.tick + 1 - HAUNT.deepenAfterYears * YEAR;

    const stages: number[] = [];

    for (const e of sim.tick()) if (e.type === 'HauntingStage') stages.push(e.stage);
    expect(stages).toEqual([3]);
    expect(hauntStage(state)).toBe(3);
    expect(state.society.news.some((n) => n.key === 'estate.hauntingDeep')).toBe(true);
    expect(missingFruit(state, other, 100)).toBeGreaterThanOrEqual(0);

    const lost = pickRounds(sim, other, 40);

    expect(lost.missing).toBeGreaterThan(0);
  });

  it('stops when the plantation on the grave is cleared, and the dead go back to sleep', () => {
    const { sim, grave } = estateWithGrave();
    const { state } = sim;

    plantGrave(sim, grave);
    state.blocks.get(grave)!.hauntedSince = state.tick - HAUNT.deepenAfterYears * YEAR - 10;
    run(sim, 30);
    expect(hauntStage(state)).toBe(3);
    expect(state.mobs.some(spectre)).toBe(true);

    expect(sim.dispatch({ type: 'ClearPlantation', block: grave })).toEqual({ ok: true });

    let ended = false;

    run(sim, CLEAR_PLANTATION.days + 2, (e) => {
      if (e.type === 'HauntingEnded' && e.block === grave) ended = true;
    });
    expect(ended).toBe(true);
    expect(state.blocks.get(grave)!.phase).toBe('cleared');
    expect(state.blocks.get(grave)!.hauntedSince).toBe(-1);
    expect(hauntStage(state)).toBe(0);
    expect(workerFactor(state)).toBe(1);
    // The label outlives the haunting: it was a grave, and it still is.
    expect(wasGrave(state.blocks.get(grave)!)).toBe(true);

    // Whoever was already walking fades in their own time, and nobody new comes.
    run(sim, HAUNT.stayDays.max + 2);
    expect(state.mobs.some(spectre)).toBe(false);

    const other = [...state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!.id;

    bearing(sim, other);
    expect(pickRounds(sim, other, 20).missing).toBe(0);

    // Planting it again wakes them again.
    writeBlock(state, sim.world, grave).debris = 0;
    state.inventory.bibit = SLOTS_PER_BLOCK;
    expect(sim.dispatch({ type: 'PlantBlock', block: grave, species: 'palm' })).toEqual({
      ok: true,
    });
    expect(state.blocks.get(grave)!.hauntedSince).toBe(state.tick);
  });

  it('survives a save: the clock and the grave ride the round trip', () => {
    const { sim, grave } = estateWithGrave();

    plantGrave(sim, grave);
    run(sim, 40);

    const saved = serializeState(sim.state, 'test', '2026-01-01T00:00:00.000Z');
    const loaded = deserializeState(saved.manifest, saved.chunks.values());

    expect(loaded.blocks.get(grave)!.hauntedSince).toBe(sim.state.blocks.get(grave)!.hauntedSince);
    expect(loaded.blocks.get(grave)!.biome).toBe('grave');
    expect(loaded.mobs.filter(spectre).length).toBe(sim.state.mobs.filter(spectre).length);
  });
});
