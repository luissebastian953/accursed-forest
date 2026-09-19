import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { CLEAR_PLANTATION } from '@sim/balance/prices.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { clearPlantationCost, palmsStanding } from '@sim/commands/clearPlantation.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { writeBlock } from '@sim/state.ts';
import { workedBlocks } from '@sim/systems/mobs.ts';
import type { BlockId } from '@sim/types.ts';

function ownedWild(sim: Sim): BlockId {
  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) return block.id;
  }

  throw new Error('no owned wild block');
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

describe('clearing a plantation (GDD 3.1.1)', () => {
  it('is refused where nothing stands, while a crew is on it, and when the money is short', () => {
    const sim = createSim(3);
    const id = ownedWild(sim);

    expect(sim.validate({ type: 'ClearPlantation', block: id })).toMatchObject({
      code: 'wrongPhase',
    });

    plant(sim, id);
    sim.state.economy.cash = 0;
    expect(sim.validate({ type: 'ClearPlantation', block: id })).toMatchObject({ code: 'noCash' });

    sim.state.economy.cash = 1_000_000_000;
    expect(sim.dispatch({ type: 'ClearPlantation', block: id })).toEqual({ ok: true });
    expect(sim.validate({ type: 'ClearPlantation', block: id })).toMatchObject({
      code: 'wrongPhase',
    });
  });

  it('costs a great deal per palm, sells nothing, and leaves bare land after the crew', () => {
    const sim = createSim(3);
    const { state } = sim;
    const id = ownedWild(sim);

    plant(sim, id);
    expect(palmsStanding(state, id)).toBe(SLOTS_PER_BLOCK);

    const cost = clearPlantationCost(state, id);

    expect(cost).toBe(
      Math.round(SLOTS_PER_BLOCK * CLEAR_PLANTATION.perPalm * state.economy.inputPriceIndex),
    );
    // Dearer than any clearing that pays for itself: tens of millions a hectare.
    expect(cost).toBeGreaterThan(40_000_000);

    const before = state.economy.cash;
    const block = () => state.blocks.get(id)!;

    expect(sim.dispatch({ type: 'ClearPlantation', block: id })).toEqual({ ok: true });
    expect(before - state.economy.cash).toBe(cost);
    expect(block().fellingUntil).toBe(state.tick + CLEAR_PLANTATION.days);
    // The crew is on the block the moment the order is given, and the palms
    // stand until the job is done.
    expect(workedBlocks(state).has(id)).toBe(true);
    expect(block().phase).toBe('planted');
    expect(palmsStanding(state, id)).toBe(SLOTS_PER_BLOCK);

    const afterOrder = state.economy.cash;
    let cleared: { palms: number } | null = null;
    let timber = 0;
    let days = 0;

    while (block().phase !== 'cleared' && days < CLEAR_PLANTATION.days + 2) {
      if (days < CLEAR_PLANTATION.days - 1) expect(palmsStanding(state, id)).toBe(SLOTS_PER_BLOCK);

      for (const e of sim.tick()) {
        if (e.type === 'PlantationCleared' && e.block === id) cleared = { palms: e.palms };
        if (e.type === 'TimberSold') timber += 1;
      }

      days += 1;
    }

    expect(days).toBeGreaterThanOrEqual(CLEAR_PLANTATION.days);
    expect(days).toBeLessThanOrEqual(CLEAR_PLANTATION.days + 1);
    expect(cleared).toEqual({ palms: SLOTS_PER_BLOCK });
    expect(timber).toBe(0);
    expect(state.economy.cash).toBeLessThanOrEqual(afterOrder);
    expect(block().fellingUntil).toBe(-1);
    expect(block().phase).toBe('cleared');
    expect(block().debris).toBeGreaterThanOrEqual(CLEAR_PLANTATION.debris);
    expect(state.palms.has(id)).toBe(false);
    expect(palmsStanding(state, id)).toBe(0);

    // The crew packs up once the job is over.
    sim.tick();
    sim.tick();
    expect(workedBlocks(state).has(id)).toBe(false);

    // And the hectare takes seedlings again.
    writeBlock(state, sim.world, id).debris = 0;
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: SLOTS_PER_BLOCK })).toEqual({
      ok: true,
    });
    expect(sim.dispatch({ type: 'PlantBlock', block: id, species: 'palm' })).toEqual({ ok: true });
  });
});
