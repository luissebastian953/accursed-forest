/**
 * A scripted player for balance sweeps and tests (§10.3, `tools/balance-sweep.ts`).
 *
 * It does the sensible, boring thing: build the Kopdes on day one, chop the
 * nearest owned blocks, buy bibit and plant as soon as land is cleared, and
 * harvest every block the day it is ripe. Nothing clever — the point is to
 * see what the numbers do to a player who simply follows the loop.
 */

import { BIOMES } from './balance/biomes.ts';
import { GROWTH } from './balance/growth.ts';
import { seedlingsNeeded } from './commands/plantBlock.ts';
import { createSim, type Sim } from './index.ts';
import { distanceToKopdes } from './kopdes.ts';
import { isBearing, slotStage } from './palms.ts';
import type { BlockId } from './types.ts';

export interface AutoplayOptions {
  seed: number;
  years: number;
  /** How many blocks to clear and plant, nearest to the Kopdes first. */
  blocks: number;
  /** Apply fertilizer whenever a block's window lapses and stock allows. */
  fertilize?: boolean;
}

export interface YearRow {
  year: number;
  cash: number;
  /** Net cash change over the year. */
  net: number;
  soldKg: number;
  planted: number;
  bearing: number;
  tbsPrice: number;
}

export interface AutoplayResult {
  sim: Sim;
  rows: YearRow[];
  /** Lowest cash seen at any tick — the reserve a player needed to survive. */
  lowestCash: number;
}

export function autoplay(options: AutoplayOptions): AutoplayResult {
  const sim = createSim(options.seed);
  const { state, world } = sim;

  sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock });

  // Candidate blocks: owned, wild, clearable, nearest to the Kopdes.
  const candidates: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable)
      candidates.push(block.id);
  }
  candidates.sort(
    (a, b) => (distanceToKopdes(state, world, a) ?? 99) - (distanceToKopdes(state, world, b) ?? 99),
  );
  const targets = candidates.slice(0, options.blocks);
  for (const block of targets) sim.dispatch({ type: 'ChopBlock', block });

  const rows: YearRow[] = [];
  let lowestCash = state.economy.cash;
  let cashAtYearStart = state.economy.cash;
  let soldAtYearStart = 0;
  const totalTicks = options.years * GROWTH.daysPerYear;

  for (let t = 0; t < totalTicks; t++) {
    sim.tick();
    lowestCash = Math.min(lowestCash, state.economy.cash);

    for (const block of targets) {
      const b = state.blocks.get(block)!;
      if (b.phase === 'cleared') {
        const needed = seedlingsNeeded(b.biome);
        if (state.inventory.bibit < needed)
          sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed });
        sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });
      } else if (b.phase === 'planted') {
        if (sim.validate({ type: 'HarvestBlock', block }) === null)
          sim.dispatch({ type: 'HarvestBlock', block });
        if (options.fertilize && b.fertilizedUntil <= state.tick) {
          if (state.inventory.fertilizer < 1)
            sim.dispatch({ type: 'BuyItem', item: 'fertilizer', quantity: 1 });
          sim.dispatch({ type: 'FertilizeBlock', block });
        }
      }
    }

    if (state.tick % GROWTH.daysPerYear === 0) {
      let planted = 0;
      let bearing = 0;
      for (const [id, palms] of state.palms) {
        if (state.blocks.get(id)?.phase !== 'planted') continue;
        planted += 1;
        if (isBearing(slotStage(palms, 0, 'palm', state.tick))) bearing += 1;
      }
      rows.push({
        year: state.tick / GROWTH.daysPerYear,
        cash: state.economy.cash,
        net: state.economy.cash - cashAtYearStart,
        soldKg: state.economy.soldKgTotal - soldAtYearStart,
        planted,
        bearing,
        tbsPrice: state.economy.tbsPrice,
      });
      cashAtYearStart = state.economy.cash;
      soldAtYearStart = state.economy.soldKgTotal;
    }
  }

  return { sim, rows, lowestCash };
}
