import { describe, expect, it } from 'vitest';

import { BIOMES } from '../../src/sim/balance/biomes.ts';
import { createSim, type Sim } from '../../src/sim/index.ts';
import type { BlockId } from '../../src/sim/types.ts';
import {
  STEPS,
  firstUndone,
  pickFieldBlock,
  runOf,
  type Probe,
  type StepId,
} from '../../src/ui/svelte/tutorial/steps.ts';

const at = (id: StepId): number => STEPS.findIndex((s) => s.id === id);

function probe(sim: Sim, field: BlockId | null, selected: BlockId | null, shopOpen = false): Probe {
  return { sim, field, selected, shopOpen };
}

function distance(sim: Sim, a: BlockId, b: BlockId): number {
  const [ax, ay] = sim.world.toXY(a);
  const [bx, by] = sim.world.toXY(b);

  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** Run the clock until the crew is off the block, or give up. */
function tickUntilCleared(sim: Sim, block: BlockId): void {
  for (let day = 0; day < 120; day++) {
    if (sim.state.blocks.get(block)?.phase !== 'clearing') return;
    sim.tick();
  }
}

describe('the walkthrough (GDD 8 panel 24a)', () => {
  it('picks a wild block the player owns, next to the Workshop, never water or protected forest', () => {
    for (const seed of [1, 7, 42, 1234, 99_999]) {
      const sim = createSim(seed);
      const field = pickFieldBlock(sim);

      expect(field, `seed ${seed}`).not.toBeNull();

      const block = sim.state.blocks.get(field!)!;
      const home = sim.state.worldGen.kopdesBlock;

      expect(block.owned).toBe(true);
      expect(block.phase).toBe('wild');
      expect(BIOMES[block.biome].clearable).toBe(true);
      expect(['river', 'protected']).not.toContain(block.biome);
      expect(distance(sim, home, field!)).toBeLessThanOrEqual(3);

      // The nearest ring wins, and open land wins inside it.
      const ring = distance(sim, home, field!);

      for (const other of sim.state.blocks.values()) {
        if (!other.owned || other.phase !== 'wild' || other.id === home) continue;
        if (!BIOMES[other.biome].clearable) continue;

        const far = distance(sim, home, other.id);

        expect(far, `seed ${seed}: block ${other.id} is closer`).toBeGreaterThanOrEqual(ring);
        if (far === ring && BIOMES[other.biome].openLand)
          expect(BIOMES[block.biome].openLand).toBe(true);
      }
    }
  });

  it('walks the estate steps in order, reading each as done from the estate itself', () => {
    const sim = createSim(42);
    const home = sim.state.worldGen.kopdesBlock;
    const field = pickFieldBlock(sim)!;

    expect(firstUndone(0, probe(sim, field, null))).toBe(at('placeKopdes'));
    expect(firstUndone(0, probe(sim, field, home))).toBe(at('placeWorkshop'));

    expect(sim.dispatch({ type: 'PlaceKopdes', block: home }).ok).toBe(true);
    expect(firstUndone(0, probe(sim, field, null))).toBe(at('chop'));

    // Stocking up early does not skip the chop: the field is still wild.
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 144 }).ok).toBe(true);
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('chop'));

    expect(sim.dispatch({ type: 'ChopBlock', block: field }).ok).toBe(true);
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('clearing'));

    tickUntilCleared(sim, field);
    expect(sim.state.blocks.get(field)?.phase).toBe('cleared');
    // The seedlings are already on the shelf, so that step is behind the player too.
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('plantPalms'));

    expect(sim.dispatch({ type: 'PlantBlock', block: field, species: 'palm' }).ok).toBe(true);
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('standCard'));

    // The guide steps wait for Next, whatever the estate does.
    expect(firstUndone(at('standCard'), probe(sim, field, field))).toBe(at('standCard'));
    expect(firstUndone(at('autoHarvest'), probe(sim, field, field))).toBe(at('autoHarvest'));

    // Back to the Workshop: the selection is what moves it, then the shop.
    expect(firstUndone(at('visitKopdes'), probe(sim, field, null))).toBe(at('visitKopdes'));
    expect(firstUndone(at('visitKopdes'), probe(sim, field, home))).toBe(at('openShop'));
    expect(firstUndone(at('visitKopdes'), probe(sim, field, home, true))).toBe(at('shopSeedlings'));
    expect(firstUndone(at('shopTrap'), probe(sim, field, home, true))).toBe(at('shopTrap'));
  });

  it('asks for seedlings only while the shelf is short of a block', () => {
    const sim = createSim(42);
    const home = sim.state.worldGen.kopdesBlock;
    const field = pickFieldBlock(sim)!;

    sim.dispatch({ type: 'PlaceKopdes', block: home });
    sim.dispatch({ type: 'ChopBlock', block: field });
    tickUntilCleared(sim, field);
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('buySeedlings'));

    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 12 });
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('buySeedlings'));

    sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 144 });
    expect(firstUndone(0, probe(sim, field, field))).toBe(at('plantPalms'));
  });

  it('counts the guide and the shop as two runs, and the estate steps as neither', () => {
    expect(runOf(STEPS[at('standCard')]!)).toEqual({ n: 1, of: 4 });
    expect(runOf(STEPS[at('autoHarvest')]!)).toEqual({ n: 4, of: 4 });
    expect(runOf(STEPS[at('shopSeedlings')]!)).toEqual({ n: 1, of: 5 });
    expect(runOf(STEPS[at('shopTrap')]!)).toEqual({ n: 5, of: 5 });
    expect(runOf(STEPS[at('chop')]!)).toBeNull();
  });

  it('has seventeen steps, every one with a title in both languages', async () => {
    const en = (await import('../../src/i18n/locales/en/tutorial.json')).default;
    const id = (await import('../../src/i18n/locales/id/tutorial.json')).default;

    expect(STEPS).toHaveLength(17);

    for (const step of STEPS) {
      for (const [name, catalog] of [
        ['en', en],
        ['id', id],
      ] as const) {
        expect(catalog, `${name}: ${step.id}Title`).toHaveProperty(`${step.id}Title`);

        if (step.card === 'own') {
          expect(catalog, `${name}: ${step.id}Head`).toHaveProperty(`${step.id}Head`);
          expect(catalog, `${name}: ${step.id}Body`).toHaveProperty(`${step.id}Body`);
          if (!step.next)
            expect(catalog, `${name}: ${step.id}Eyebrow`).toHaveProperty(`${step.id}Eyebrow`);
        }
      }
    }

    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });
});
