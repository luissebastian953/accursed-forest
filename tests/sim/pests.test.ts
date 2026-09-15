import { describe, expect, it } from 'vitest';

import { autoplay } from '@sim/autoplay.ts';
import { BIOMES } from '@sim/balance/biomes.ts';
import { BEETLES, GANODERMA, PEST_LABOUR } from '@sim/balance/pests.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { slotIndex, slotNeighbours, slotStage } from '@sim/palms.ts';
import { beetleCapacity, ganodermaCounts, pestPressure } from '@sim/systems/pest.ts';
import type { BlockId } from '@sim/types.ts';

function ownedWild(sim: Sim, biome?: string): BlockId[] {
  const out: BlockId[] = [];
  for (const block of sim.state.blocks.values()) {
    if (!block.owned || block.phase !== 'wild' || !BIOMES[block.biome].clearable) continue;
    if (biome && block.biome !== biome) continue;
    out.push(block.id);
  }
  return out;
}

function tickUntil(sim: Sim, predicate: () => boolean, limit = 5000): number {
  let n = 0;
  while (!predicate() && n < limit) {
    sim.tick();
    n += 1;
  }
  return n;
}

/** Kopdes, one block chopped, optionally sanitized, stocked and planted. */
function plantedEstate(
  seed: number,
  options: { biome?: string; sanitize?: boolean } = {},
): { sim: Sim; block: BlockId } {
  const sim = createSim(seed);
  sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
  const block = ownedWild(sim, options.biome)[0] ?? ownedWild(sim)[0]!;
  expect(sim.dispatch({ type: 'ChopBlock', block })).toEqual({ ok: true });
  tickUntil(sim, () => sim.state.blocks.get(block)!.phase === 'cleared');
  if (options.sanitize) {
    while (sim.state.blocks.get(block)!.debris > 0) {
      expect(sim.dispatch({ type: 'BuyItem', item: 'sanitationCrew', quantity: 1 })).toEqual({
        ok: true,
      });
      expect(sim.dispatch({ type: 'SanitizeBlock', block })).toEqual({ ok: true });
    }
  }
  const needed = BIOMES[sim.state.blocks.get(block)!.biome].plantableSlots;
  expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed })).toEqual({ ok: true });
  expect(sim.dispatch({ type: 'PlantBlock', block, species: 'palm' })).toEqual({ ok: true });
  return { sim, block };
}

function growToBearing(sim: Sim, block: BlockId): void {
  tickUntil(
    sim,
    () => slotStage(sim.state.palms.get(block)!, 0, 'palm', sim.state.tick) === 'mature',
    1600,
  );
}

function infect(sim: Sim, block: BlockId, slot: number, stage: 1 | 2 = 1): void {
  const palms = sim.state.palms.get(block)!;
  palms.ganoderma[slot] = stage;
  palms.ganodermaSince[slot] = sim.state.tick;
}

function deathsBy(sim: Sim, ticks: number, cause: 'beetles' | 'ganoderma'): number {
  let n = 0;
  for (let i = 0; i < ticks; i++)
    for (const e of sim.tick()) if (e.type === 'PalmDied' && e.cause === cause) n += 1;
  return n;
}

describe('the lattice (§3.4)', () => {
  it('every interior slot has six neighbours, corners have fewer', () => {
    const out: number[] = [];
    expect(slotNeighbours(slotIndex(5, 5), out)).toBe(6);
    expect(slotNeighbours(slotIndex(0, 0), out)).toBe(2);
    // Bottom-right corner sits on an odd (right-shifted) row: only two neighbours.
    expect(slotNeighbours(slotIndex(11, 11), out)).toBe(2);
    // Right edge on an even row keeps both diagonals on each side: five.
    expect(slotNeighbours(slotIndex(10, 11), out)).toBe(5);
  });

  it('neighbourhood is symmetric', () => {
    const a: number[] = [];
    const b: number[] = [];
    for (let slot = 0; slot < SLOTS_PER_BLOCK; slot++) {
      const n = slotNeighbours(slot, a);
      for (let i = 0; i < n; i++) {
        const m = slotNeighbours(a[i]!, b);
        expect(b.slice(0, m)).toContain(slot);
      }
    }
  });
});

describe('rhinoceros beetle (§3.4)', () => {
  it('capacity follows debris and a bare block holds none', () => {
    expect(beetleCapacity(0)).toBe(0);
    expect(beetleCapacity(BEETLES.minDebrisToBreed - 1)).toBe(0);
    expect(beetleCapacity(55)).toBe(55 * BEETLES.capacityPerDebris);
  });

  it('a fresh forest pile fills with beetles; a sanitized one stays empty', () => {
    const dirty = plantedEstate(1, { biome: 'forest' });
    const clean = plantedEstate(1, { biome: 'forest', sanitize: true });
    for (let i = 0; i < 90; i++) {
      dirty.sim.tick();
      clean.sim.tick();
    }
    const dirtyBlock = dirty.sim.state.blocks.get(dirty.block)!;
    const cleanBlock = clean.sim.state.blocks.get(clean.block)!;
    expect(dirtyBlock.beetles).toBeGreaterThan(30);
    expect(cleanBlock.beetles).toBe(0);
  });

  it('leaving forest debris around actually hurts: seedlings die without sanitation', () => {
    const dirty = plantedEstate(1, { biome: 'forest' });
    const clean = plantedEstate(1, { biome: 'forest', sanitize: true });
    const dirtyDeaths = deathsBy(dirty.sim, 720, 'beetles');
    const cleanDeaths = deathsBy(clean.sim, 720, 'beetles');
    expect(dirtyDeaths).toBeGreaterThan(20);
    expect(cleanDeaths).toBe(0);
  });

  it('traps thin the population and Metarhizium slows its growth', () => {
    const control = plantedEstate(1, { biome: 'forest' });
    const trapped = plantedEstate(1, { biome: 'forest' });
    const treated = plantedEstate(1, { biome: 'forest' });

    for (let i = 0; i < 10; i++) {
      control.sim.tick();
      trapped.sim.tick();
      treated.sim.tick();
    }
    expect(trapped.sim.dispatch({ type: 'SetTrap', block: trapped.block })).toMatchObject({
      code: 'noInventory',
    });
    expect(trapped.sim.dispatch({ type: 'BuyItem', item: 'pheromoneTrap', quantity: 1 })).toEqual({
      ok: true,
    });
    expect(trapped.sim.dispatch({ type: 'SetTrap', block: trapped.block })).toEqual({ ok: true });
    expect(trapped.sim.dispatch({ type: 'SetTrap', block: trapped.block })).toMatchObject({
      code: 'occupied',
    });
    expect(treated.sim.dispatch({ type: 'BuyItem', item: 'metarhizium', quantity: 1 })).toEqual({
      ok: true,
    });
    expect(treated.sim.dispatch({ type: 'ApplyMetarhizium', block: treated.block })).toEqual({
      ok: true,
    });

    for (let i = 0; i < 40; i++) {
      control.sim.tick();
      trapped.sim.tick();
      treated.sim.tick();
    }
    const c = control.sim.state.blocks.get(control.block)!.beetles;
    expect(trapped.sim.state.blocks.get(trapped.block)!.beetles).toBeLessThan(c * 0.7);
    expect(treated.sim.state.blocks.get(treated.block)!.beetles).toBeLessThan(c * 0.7);
  });

  it('beetles spare mature palms', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    growToBearing(sim, block);
    sim.state.blocks.get(block)!.debris = 80;
    expect(deathsBy(sim, 360, 'beetles')).toBe(0);
  });
});

describe('Ganoderma (§3.4)', () => {
  it('goes latent → symptomatic → dead on the mature timetable, leaving a stump and debris', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    growToBearing(sim, block);
    const palms = sim.state.palms.get(block)!;
    infect(sim, block, 60);
    const debrisBefore = sim.state.blocks.get(block)!.debris;

    const sick = tickUntil(sim, () => palms.ganoderma[60] === 2, 400);
    expect(sick).toBe(GANODERMA.latentDays.mature);
    expect(ganodermaCounts(palms).symptomatic).toBeGreaterThanOrEqual(1);

    let died: number | null = null;
    for (let i = 0; i < 1200 && died === null; i++) {
      for (const e of sim.tick())
        if (e.type === 'PalmDied' && e.slot === 60 && e.cause === 'ganoderma') died = i + 1;
    }
    expect(died).toBe(GANODERMA.symptomaticDays.mature);
    expect(palms.ganoderma[60]).toBe(3);
    expect(slotStage(palms, 60, 'palm', sim.state.tick)).toBe('dead');
    expect(sim.state.blocks.get(block)!.debris).toBeGreaterThanOrEqual(
      debrisBefore + GANODERMA.debrisPerDeath - 1,
    );
  });

  it('young palms go faster', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    infect(sim, block, 60);
    const palms = sim.state.palms.get(block)!;
    const sick = tickUntil(sim, () => palms.ganoderma[60] === 2, 400);
    expect(sick).toBe(GANODERMA.latentDays.immature);
  });

  it('a symptomatic palm grows at most 60% as fast as its neighbours', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    const palms = sim.state.palms.get(block)!;
    infect(sim, block, 60, 2);
    const before60 = palms.growth[60]!;
    const before61 = palms.growth[61]!;
    for (let i = 0; i < 30; i++) sim.tick();
    const gained60 = palms.growth[60]! - before60;
    const gained61 = palms.growth[61]! - before61;
    // float32 accumulation: allow a hair of slack
    expect(gained60).toBeLessThanOrEqual(gained61 * GANODERMA.stressCap + 1e-3);
    expect(gained60).toBeGreaterThan(0);
  });

  it('spreads along the lattice; left alone it takes much of the block in a few years', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    growToBearing(sim, block);
    infect(sim, block, slotIndex(5, 5));
    for (let i = 0; i < 4 * 360; i++) sim.tick();
    const c = ganodermaCounts(sim.state.palms.get(block)!);
    expect(c.latent + c.symptomatic + c.dead).toBeGreaterThan(8);
  });

  it('a careful player can contain an outbreak: Trichoderma plus removal', () => {
    const neglect = plantedEstate(42, { sanitize: true });
    const careful = plantedEstate(42, { sanitize: true });
    growToBearing(neglect.sim, neglect.block);
    growToBearing(careful.sim, careful.block);
    infect(neglect.sim, neglect.block, slotIndex(5, 5));
    infect(careful.sim, careful.block, slotIndex(5, 5));
    careful.sim.state.economy.cash = 500_000_000;

    for (let day = 0; day < 4 * 360; day++) {
      neglect.sim.tick();
      careful.sim.tick();
      if (day % 30 === 0) {
        const b = careful.sim.state.blocks.get(careful.block)!;
        if (b.trichodermaUntil <= careful.sim.state.tick) {
          careful.sim.dispatch({ type: 'BuyItem', item: 'trichoderma', quantity: 1 });
          careful.sim.dispatch({ type: 'ApplyTrichoderma', block: careful.block });
        }
        const palms = careful.sim.state.palms.get(careful.block)!;
        for (let slot = 0; slot < palms.plantedAt.length; slot++) {
          if (palms.plantedAt[slot]! >= 0 && palms.ganoderma[slot]! >= 2) {
            careful.sim.dispatch({ type: 'RemovePalm', block: careful.block, slot });
          }
        }
      }
    }

    const n = ganodermaCounts(neglect.sim.state.palms.get(neglect.block)!);
    const c = ganodermaCounts(careful.sim.state.palms.get(careful.block)!);
    const neglectInfected = n.latent + n.symptomatic + n.dead;
    const carefulInfected = c.latent + c.symptomatic + c.dead;
    expect(carefulInfected).toBeLessThan(neglectInfected / 2);
    expect(c.dead).toBe(0);
  });

  it('an isolation trench cuts the links: a ringed palm infects nobody', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    growToBearing(sim, block);
    sim.state.economy.cash = 500_000_000;
    const centre = slotIndex(5, 5);
    infect(sim, block, centre, 2);
    const ring: number[] = [];
    const n = slotNeighbours(centre, ring);
    for (let i = 0; i < n; i++)
      expect(sim.dispatch({ type: 'TrenchPalm', block, slot: ring[i]! })).toEqual({ ok: true });
    expect(sim.dispatch({ type: 'TrenchPalm', block, slot: ring[0]! })).toMatchObject({
      code: 'occupied',
    });

    // Silence spontaneous infection so only spread counts.
    sim.state.blocks.get(block)!.debris = 0;
    const palms = sim.state.palms.get(block)!;
    for (let i = 0; i < 720; i++) {
      sim.tick();
      // spontaneous spores can still land; undo any that did not come via the centre
    }
    let viaSpread = 0;
    for (let i = 0; i < n; i++) if (palms.ganoderma[ring[i]!] !== 0) viaSpread += 1;
    expect(viaSpread).toBe(0);
  });
});

describe('per-palm commands (§3.4)', () => {
  it('removing a palm empties the slot, adds debris and costs labour; replanting refills from stock', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    const palms = sim.state.palms.get(block)!;
    const cash = sim.state.economy.cash;
    const debris = sim.state.blocks.get(block)!.debris;

    expect(sim.dispatch({ type: 'RemovePalm', block, slot: 999 })).toMatchObject({
      code: 'badSlot',
    });
    expect(sim.dispatch({ type: 'RemovePalm', block, slot: 10 })).toEqual({ ok: true });
    expect(palms.plantedAt[10]).toBe(-1);
    expect(sim.dispatch({ type: 'RemovePalm', block, slot: 10 })).toMatchObject({
      code: 'badSlot',
    });
    expect(cash - sim.state.economy.cash).toBe(PEST_LABOUR.removePalm);
    expect(sim.state.blocks.get(block)!.debris).toBeCloseTo(debris + GANODERMA.debrisPerRemoval, 6);

    expect(sim.dispatch({ type: 'ReplantBlock', block })).toMatchObject({ code: 'noInventory' });
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toEqual({ ok: true });
    for (let i = 0; i < 5; i++) sim.tick();
    expect(sim.dispatch({ type: 'ReplantBlock', block })).toEqual({ ok: true });
    expect(palms.plantedAt[10]).toBe(sim.state.tick);
    expect(sim.dispatch({ type: 'ReplantBlock', block })).toMatchObject({ code: 'wrongPhase' });
  });

  it('a trench survives replanting', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    sim.dispatch({ type: 'TrenchPalm', block, slot: 3 });
    sim.dispatch({ type: 'RemovePalm', block, slot: 3 });
    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 });
    sim.dispatch({ type: 'ReplantBlock', block });
    expect(sim.state.palms.get(block)!.trenched[3]).toBe(1);
  });
});

describe('plague (§3.4)', () => {
  it('flags a block when pressure crosses the line and clears it with hysteresis', () => {
    const { sim, block } = plantedEstate(42, { sanitize: true });
    const b = sim.state.blocks.get(block)!;
    expect(pestPressure(b, sim.state.palms.get(block))).toBeLessThan(0.1);

    b.debris = 100;
    let started = false;
    for (let i = 0; i < 200 && !started; i++)
      for (const e of sim.tick()) if (e.type === 'PlagueStarted') started = true;
    expect(started).toBe(true);
    expect(b.plagued).toBe(true);

    // Sanitize hard and trap; the flag lifts once pressure falls past the lower bound.
    sim.state.economy.cash = 500_000_000;
    while (b.debris > 0) {
      sim.dispatch({ type: 'BuyItem', item: 'sanitationCrew', quantity: 1 });
      sim.dispatch({ type: 'SanitizeBlock', block });
    }
    sim.dispatch({ type: 'BuyItem', item: 'pheromoneTrap', quantity: 1 });
    sim.dispatch({ type: 'SetTrap', block });
    let ended = false;
    for (let i = 0; i < 200 && !ended; i++)
      for (const e of sim.tick()) if (e.type === 'PlagueEnded') ended = true;
    expect(ended).toBe(true);
    expect(b.plagued).toBe(false);
  });
});

describe('the careful player (M1d done-criterion)', () => {
  it('managing pests on a forest start loses far fewer palms than ignoring them', () => {
    const careless = autoplay({ seed: 1, years: 5, blocks: 2 });
    const careful = autoplay({ seed: 1, years: 5, blocks: 2, managePests: true });
    const lostCareless = careless.rows.at(-1)!.palmsLost;
    const lostCareful = careful.rows.at(-1)!.palmsLost;
    expect(lostCareless).toBeGreaterThan(20);
    expect(lostCareful).toBeLessThan(lostCareless / 3);
    // and it still pays
    expect(careful.rows.at(-1)!.net).toBeGreaterThan(0);
  });
});
