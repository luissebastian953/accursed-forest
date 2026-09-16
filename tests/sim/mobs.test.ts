import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import {
  BABI_NGEPET,
  BEHAVIOUR,
  THIEF,
  WILDLIFE,
  WORKERS,
  WORKER_JOBS,
} from '@sim/balance/mobs.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { distanceToKopdes } from '@sim/kopdes.ts';
import { createPalmArrays, plantSlots } from '@sim/palms.ts';
import { writeBlock } from '@sim/state.ts';
import { guardPost, wildKinds } from '@sim/systems/mobs.ts';
import type { BlockId, Mob } from '@sim/types.ts';

const YEAR = GROWTH.daysPerYear;

/** Bearing palms on `n` open blocks by the Kopdes, planted years ago, fruit on the trees. */
function bearingEstate(seed = 42, n = 3): Sim {
  const sim = createSim(seed);
  const { state, world } = sim;
  state.tick = 4 * YEAR;
  state.weather.dayOfYear = 0;
  sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock });
  const candidates: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && !BIOMES[block.biome].forestCover)
      candidates.push(block.id);
  }
  candidates.sort(
    (a, b) => (distanceToKopdes(state, world, a) ?? 99) - (distanceToKopdes(state, world, b) ?? 99),
  );
  for (const id of candidates.slice(0, n)) {
    const block = writeBlock(state, world, id);
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
  return sim;
}

function run(sim: Sim, days: number, onMob?: (mob: Mob) => void): void {
  for (let i = 0; i < days; i++) {
    sim.tick();
    if (onMob) for (const mob of sim.state.mobs) onMob(mob);
  }
}

describe('wildlife (mobs)', () => {
  it('animals arrive, stay under the cap, keep to their land, and move on', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const seen = new Set<string>();
    let most = 0;
    run(sim, 2 * YEAR, (mob) => {
      seen.add(mob.species);
      most = Math.max(most, sim.state.mobs.filter((m) => wildKinds().includes(m.species)).length);
    });
    expect(most).toBeGreaterThan(3);
    expect(most).toBeLessThanOrEqual(WILDLIFE.cap);
    expect(seen.has('wildBoar') || seen.has('pig')).toBe(true);
    // Everyone who came has also had time to leave: the field turns over.
    const longest = WILDLIFE.stayDays.max + BEHAVIOUR.leaveGraceDays + 1;
    expect(sim.state.mobs.every((m) => sim.state.tick - m.born < longest)).toBe(true);
  });

  it('animals live on a repertoire — stand, mill about, cross, circle, sleep — at a walk', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const seen = new Set<string>();
    let fastest = 0;
    const last = new Map<number, [number, number]>();
    run(sim, 2 * YEAR, (mob) => {
      if (!wildKinds().includes(mob.species)) return;
      seen.add(mob.intent);
      const was = last.get(mob.id);
      if (was) fastest = Math.max(fastest, Math.hypot(mob.x - was[0], mob.z - was[1]));
      last.set(mob.id, [mob.x, mob.z]);
    });
    for (const intent of ['idle', 'pace', 'wander', 'circle', 'sleep'])
      expect(seen).toContain(intent);
    // Nobody covers more than a third of a block in a day: a stroll, not a teleport.
    expect(fastest).toBeLessThanOrEqual(WILDLIFE.wanderSpeed + 1e-9);
  });

  it('the ghost drifts through the same repertoire but never sleeps', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const block = [...sim.state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    block.phase = 'cleared';
    block.clearProgress = 1;
    block.debris = 0;
    sim.state.tick = 3 * YEAR;
    const intents = new Set<string>();
    let ghosts = 0;
    run(sim, YEAR, (mob) => {
      if (mob.species !== 'ghost') return;
      ghosts += 1;
      intents.add(mob.intent);
    });
    expect(ghosts).toBeGreaterThan(0);
    expect(intents.has('sleep')).toBe(false);
    expect(intents.size).toBeGreaterThan(1);
  });

  it('monkeys and orangutans spawn only on forest', () => {
    const sim = createSim(7);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    let checked = 0;
    for (let i = 0; i < 3 * YEAR; i++) {
      for (const e of sim.tick()) {
        if (e.type !== 'MobArrived') continue;
        if (e.species !== 'monkey' && e.species !== 'orangutan') continue;
        const [x, y] = sim.world.toXY(e.block);
        const biome = sim.world.generated(x, y).biome;
        expect(['forest', 'protected']).toContain(biome);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('mobs draw from their own stream: the weather is the same with or without them', () => {
    const a = createSim(42);
    const b = createSim(42);
    a.dispatch({ type: 'PlaceKopdes', block: a.state.worldGen.kopdesBlock });
    for (let i = 0; i < 200; i++) {
      a.tick();
      b.tick();
    }
    expect(a.state.mobs.length).toBeGreaterThan(0);
    expect(a.state.weather.rain).toBe(b.state.weather.rain);
    expect(a.state.economy.tbsPrice).toBe(b.state.economy.tbsPrice);
  });
});

describe('the thief (mobs)', () => {
  it('comes for ripe fruit, takes a share, and makes the news', () => {
    const sim = bearingEstate(42);
    const before = [...sim.state.palms.values()].reduce(
      (sum, p) => sum + p.yieldAcc.reduce((a, b) => a + b, 0),
      0,
    );
    let stolen = 0;
    let arrived = false;
    for (let i = 0; i < 2 * YEAR && stolen === 0; i++) {
      for (const e of sim.tick()) {
        if (e.type === 'MobArrived' && e.species === 'thief') arrived = true;
        if (e.type === 'HarvestStolen') stolen = e.kilograms;
      }
      // Keep fruit on the trees so there is always something to take.
      for (const p of sim.state.palms.values())
        for (let s = 0; s < p.yieldAcc.length; s++) p.yieldAcc[s] = Math.max(p.yieldAcc[s]!, 2);
    }
    expect(arrived).toBe(true);
    expect(stolen).toBeGreaterThan(0);
    void before;
    expect(sim.state.society.news.some((n) => n.key === 'estate.theft')).toBe(true);
  });

  it('waits in the trees before the dash, and runs back to them with the sack', () => {
    const sim = bearingEstate(42);
    const order: string[] = [];
    for (let i = 0; i < 2 * YEAR; i++) {
      sim.tick();
      const thief = sim.state.mobs.find((m) => m.species === 'thief');
      if (thief && order[order.length - 1] !== thief.intent) order.push(thief.intent);
      if (thief?.intent === 'leave') break;
      for (const p of sim.state.palms.values())
        for (let s = 0; s < p.yieldAcc.length; s++) p.yieldAcc[s] = Math.max(p.yieldAcc[s]!, 2);
    }
    expect(order.indexOf('hide')).toBeGreaterThan(-1);
    expect(order.indexOf('raid')).toBeGreaterThan(order.indexOf('hide'));
    expect(order.indexOf('flee')).toBeGreaterThan(order.indexOf('raid'));
  });

  it('a security guard makes thieves rarer and catches the ones who come', () => {
    const attempts = (guarded: boolean): { arrivals: number; thefts: number; caught: number } => {
      let arrivals = 0;
      let thefts = 0;
      let caught = 0;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const sim = bearingEstate(seed);
        sim.state.economy.cash = 5e9;
        if (guarded)
          expect(sim.dispatch({ type: 'HireWorker', kind: 'security' })).toEqual({ ok: true });
        for (let i = 0; i < 3 * YEAR; i++) {
          for (const e of sim.tick()) {
            if (e.type === 'MobArrived' && e.species === 'thief') arrivals += 1;
            if (e.type === 'HarvestStolen') thefts += 1;
            if (e.type === 'ThiefCaught') caught += 1;
          }
          for (const p of sim.state.palms.values())
            for (let s = 0; s < p.yieldAcc.length; s++) p.yieldAcc[s] = Math.max(p.yieldAcc[s]!, 2);
        }
      }
      return { arrivals, thefts, caught };
    };
    const open = attempts(false);
    const guarded = attempts(true);
    expect(open.arrivals).toBeGreaterThan(guarded.arrivals * 1.5);
    expect(guarded.caught).toBeGreaterThan(0);
    expect(guarded.thefts).toBeLessThan(open.thefts);
    expect(THIEF.guardedFactor).toBeLessThan(1);
  });
});

describe('the babi ngepet (mobs)', () => {
  it('walks to the Kopdes on four legs, stands up, and the cash box is lighter', () => {
    // Rare by design: try seeds until one turns up, then check what it did.
    let taken = 0;
    let stoodUp = false;
    let sim = bearingEstate(1);
    for (let seed = 1; seed <= 8 && taken === 0; seed++) {
      sim = bearingEstate(seed);
      sim.state.economy.cash = 500_000_000;
      for (let i = 0; i < 6 * YEAR && taken === 0; i++) {
        for (const e of sim.tick()) if (e.type === 'CashStolen') taken = e.amount;
        if (sim.state.mobs.some((m) => m.species === 'babiNgepet' && m.standing)) stoodUp = true;
      }
    }
    expect(taken).toBeGreaterThan(0);
    expect(taken).toBeLessThanOrEqual(BABI_NGEPET.maxTake);
    expect(stoodUp).toBe(true);
    expect(sim.state.society.news.some((n) => n.key === 'estate.babiNgepet')).toBe(true);
    // Upright, it runs the estate for a few days, then is simply gone.
    let raidDays = 0;
    let fastest = 0;
    let was: [number, number] | null = null;
    for (let i = 0; i < BABI_NGEPET.raidDays + 5; i++) {
      sim.tick();
      const babi = sim.state.mobs.find((m) => m.species === 'babiNgepet');
      if (!babi) break;
      if (babi.intent === 'raid') {
        raidDays += 1;
        expect(babi.standing).toBe(true);
        if (was) fastest = Math.max(fastest, Math.hypot(babi.x - was[0], babi.z - was[1]));
        was = [babi.x, babi.z];
      }
    }
    expect(raidDays).toBeGreaterThan(0);
    expect(raidDays).toBeLessThanOrEqual(BABI_NGEPET.raidDays + 1);
    expect(fastest).toBeGreaterThan(WILDLIFE.wanderSpeed);
    expect(sim.state.mobs.some((m) => m.species === 'babiNgepet')).toBe(false);
  });
});

describe('workers (mobs)', () => {
  it('hiring costs a fee and a daily wage; dismissing stops the wage', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    expect(sim.validate({ type: 'HireWorker', kind: 'plantDoctor' })).toBeNull();
    const cash = sim.state.economy.cash;
    expect(sim.dispatch({ type: 'HireWorker', kind: 'plantDoctor' })).toEqual({ ok: true });
    expect(cash - sim.state.economy.cash).toBe(WORKERS.plantDoctor.hireFee);
    expect(sim.dispatch({ type: 'HireWorker', kind: 'plantDoctor' })).toMatchObject({
      code: 'occupied',
    });

    const afterHire = sim.state.economy.cash;
    sim.tick();
    const wages = sim.state.economy.ledger.filter((e) => e.note === WORKERS.plantDoctor.label);
    expect(wages).toHaveLength(1);
    expect(wages[0]!.amount).toBe(-WORKERS.plantDoctor.wagePerDay);
    void afterHire;

    expect(sim.dispatch({ type: 'DismissWorker', kind: 'plantDoctor' })).toEqual({ ok: true });
    expect(sim.state.mobs.some((m) => m.species === 'plantDoctor')).toBe(false);
    const paid = sim.state.economy.ledger.length;
    sim.tick();
    expect(
      sim.state.economy.ledger.slice(paid).some((e) => e.note === WORKERS.plantDoctor.label),
    ).toBe(false);
  });

  it('the security guard patrols the estate at a walk and rests at the post', () => {
    const sim = bearingEstate(42);
    sim.state.economy.cash = 5e9;
    expect(sim.dispatch({ type: 'HireWorker', kind: 'security' })).toEqual({ ok: true });
    const post = guardPost(sim.state, sim.world)!;
    let atPost = 0;
    let offEstate = 0;
    let fastest = 0;
    let was: [number, number] | null = null;
    run(sim, 200, (mob) => {
      if (mob.species !== 'security') return;
      if (Math.hypot(mob.x - post[0], mob.z - post[1]) < 0.05) atPost += 1;
      const block = sim.state.blocks.get(sim.world.toId(Math.floor(mob.x), Math.floor(mob.z)));
      if (!block?.owned) offEstate += 1;
      if (was) fastest = Math.max(fastest, Math.hypot(mob.x - was[0], mob.z - was[1]));
      was = [mob.x, mob.z];
    });
    expect(atPost).toBeGreaterThan(5);
    expect(atPost).toBeLessThan(180);
    expect(offEstate).toBe(0);
    expect(fastest).toBeLessThanOrEqual(WORKERS.security.speed + 1e-9);
  });

  it('a sanitizer walks to the messiest block and clears it', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.state.economy.cash = 5e9;
    const messy = [...sim.state.blocks.values()].find((b) => b.owned && b.phase === 'wild')!;
    messy.phase = 'cleared';
    messy.debris = 80;
    expect(sim.dispatch({ type: 'HireWorker', kind: 'sanitizer' })).toEqual({ ok: true });
    run(sim, 30);
    expect(messy.debris).toBeLessThan(40);
    const worker = sim.state.mobs.find((m) => m.species === 'sanitizer')!;
    expect(worker.hired).toBe(true);
  });

  it('a plant doctor removes sick palms and doses the block', () => {
    const sim = bearingEstate(42, 1);
    sim.state.economy.cash = 5e9;
    const [id, palms] = [...sim.state.palms.entries()][0]!;
    for (let s = 0; s < 10; s++) {
      palms.ganoderma[s] = 2;
      palms.ganodermaSince[s] = sim.state.tick - 10;
    }
    expect(sim.dispatch({ type: 'HireWorker', kind: 'plantDoctor' })).toEqual({ ok: true });
    run(sim, 30);
    let sick = 0;
    for (let s = 0; s < palms.plantedAt.length; s++) if (palms.ganoderma[s]! >= 2) sick += 1;
    expect(sick).toBeLessThan(10);
    expect(sim.state.blocks.get(id)!.trichodermaUntil).toBeGreaterThan(sim.state.tick);
  });

  it('a crew of four works a block while it is chopped, and leaves when it is cleared', () => {
    const sim = createSim(42);
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    const block = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.phase === 'wild' && BIOMES[b.biome].clearable,
    )!;
    expect(sim.dispatch({ type: 'ChopBlock', block: block.id })).toEqual({ ok: true });
    const crew = () => sim.state.mobs.filter((m) => m.species === 'crew' && m.target === block.id);
    // On the block the moment the order is given, not the next day.
    expect(crew().length).toBe(WORKER_JOBS.crewSize);
    sim.tick();
    expect(crew().length).toBe(WORKER_JOBS.crewSize);
    expect(WORKER_JOBS.crewSize).toBeGreaterThanOrEqual(4);
    // Four people, four spots: nobody starts on top of anybody.
    const spots = new Set(crew().map((m) => `${m.x.toFixed(2)},${m.z.toFixed(2)}`));
    expect(spots.size).toBe(WORKER_JOBS.crewSize);
    run(sim, 3);
    expect(crew().length).toBe(WORKER_JOBS.crewSize);
    run(sim, BIOMES[block.biome].chopDays);
    expect(block.phase).toBe('cleared');
    expect(sim.state.mobs.some((m) => m.species === 'crew' && m.target === block.id)).toBe(false);
  });
});
