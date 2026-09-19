import { BIOMES } from './balance/biomes.ts';
import { GROWTH } from './balance/growth.ts';
import { KOPDES_UPGRADE_COST } from './balance/prices.ts';
import { seedlingsNeeded } from './commands/plantBlock.ts';
import { createSim, type Sim } from './index.ts';
import { distanceToKopdes, inKopdesRange } from './kopdes.ts';
import { isBearing, slotStage } from './palms.ts';
import { ganodermaCounts } from './systems/pest.ts';
import type { BlockId, Command, Ending, ItemId } from './types.ts';

export interface AutoplayOptions {
  seed: number;
  years: number;
  /** How many blocks to clear and plant, nearest to the Kopdes first. */
  blocks: number;
  /** Apply fertilizer whenever a block's window lapses and stock allows. */
  fertilize?: boolean;
  /**
   * Do the sanitation and pest work a careful player would: sanitize debris
   * before planting and whenever it piles up, trap beetles, treat and remove
   * visibly sick palms, replant the gaps.
   */
  managePests?: boolean;
  /**
   * Keep expanding: each month, while cash stays above `reserve`, chop and
   * plant the next owned block in Kopdes range, up to `maxBlocks`, and
   * upgrade the Kopdes whenever it can be afforded on top of the reserve.
   */
  expand?: { reserve: number; maxBlocks: number };
  /** Leave forest standing: never chop a block that counts as forest cover (GDD 3.6.2). */
  spareForest?: boolean;
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
  /** Palms lost to pests so far. */
  palmsLost: number;
  /** Palms visibly infected or dead right now. */
  sick: number;
  /** Operating profit for the year, from the endings system's books. */
  profit: number;
  /** ISPO conditions met at the close of the year. */
  conditions: number;
}

export interface AutoplayResult {
  sim: Sim;
  rows: YearRow[];
  /** Lowest cash seen at any tick; the reserve a player needed to survive. */
  lowestCash: number;
  /** How the run ended, if it did, and in which year. */
  ending: Ending | null;
  endedYear: number | null;
}

export function autoplay(options: AutoplayOptions): AutoplayResult {
  const sim = createSim(options.seed);
  const { state, world } = sim;

  sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock });

  // Candidate blocks: owned, wild, clearable, nearest to the Kopdes.
  const candidates: BlockId[] = [];

  for (const block of state.blocks.values()) {
    if (!block.owned || block.phase !== 'wild' || !BIOMES[block.biome].clearable) continue;
    if (options.spareForest && BIOMES[block.biome].forestCover) continue;
    candidates.push(block.id);
  }

  candidates.sort(
    (a, b) => (distanceToKopdes(state, world, a) ?? 99) - (distanceToKopdes(state, world, b) ?? 99),
  );

  const targets = candidates.slice(0, options.blocks);
  let nextCandidate = targets.length;

  for (const block of targets) sim.dispatch({ type: 'ChopBlock', block });

  const buyAnd = (item: ItemId, command: Command): void => {
    if (state.inventory[item] < 1) sim.dispatch({ type: 'BuyItem', item, quantity: 1 });
    sim.dispatch(command);
  };

  const rows: YearRow[] = [];
  let lowestCash = state.economy.cash;
  let palmsLost = 0;
  let cashAtYearStart = state.economy.cash;
  let soldAtYearStart = 0;
  const totalTicks = options.years * GROWTH.daysPerYear;

  for (let t = 0; t < totalTicks; t++) {
    if (state.run.ending) break;
    for (const e of sim.tick()) if (e.type === 'PalmDied') palmsLost += 1;
    lowestCash = Math.min(lowestCash, state.economy.cash);

    if (options.expand && state.tick % 30 === 0) {
      const { reserve, maxBlocks } = options.expand;

      if (sim.validate({ type: 'UpgradeKopdes' }) === null) {
        const level = state.kopdes?.level ?? 1;

        if (state.economy.cash - (KOPDES_UPGRADE_COST[level] ?? 0) > reserve) {
          sim.dispatch({ type: 'UpgradeKopdes' });
        }
      }

      const next = candidates[nextCandidate];

      if (
        next !== undefined &&
        targets.length < maxBlocks &&
        state.economy.cash > reserve &&
        inKopdesRange(state, world, next) &&
        sim.dispatch({ type: 'ChopBlock', block: next }).ok
      ) {
        targets.push(next);
        nextCandidate += 1;
      }
    }

    for (const block of targets) {
      const b = state.blocks.get(block)!;

      if (b.phase === 'cleared') {
        if (options.managePests && b.debris > 20) {
          buyAnd('sanitationCrew', { type: 'SanitizeBlock', block });
          continue;
        }

        const needed = seedlingsNeeded(b.biome);

        if (state.inventory.bibit < needed) {
          sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed });
        }

        sim.dispatch({ type: 'PlantBlock', block, species: 'palm' });
      } else if (b.phase === 'planted') {
        if (sim.validate({ type: 'HarvestBlock', block }) === null) {
          sim.dispatch({ type: 'HarvestBlock', block });
        }

        if (options.fertilize && b.fertilizedUntil <= state.tick) {
          buyAnd('fertilizer', { type: 'FertilizeBlock', block });
        }

        if (options.managePests) managePests(sim, block, buyAnd);
      }
    }

    if (state.tick % GROWTH.daysPerYear === 0) {
      let planted = 0;
      let bearing = 0;
      let sick = 0;

      for (const [id, palms] of state.palms) {
        if (state.blocks.get(id)?.phase !== 'planted') continue;
        planted += 1;
        if (isBearing(slotStage(palms, 0, 'palm', state.tick))) bearing += 1;

        const c = ganodermaCounts(palms);

        sick += c.symptomatic + c.dead;
      }

      rows.push({
        year: state.tick / GROWTH.daysPerYear,
        cash: state.economy.cash,
        net: state.economy.cash - cashAtYearStart,
        soldKg: state.economy.soldKgTotal - soldAtYearStart,
        planted,
        bearing,
        tbsPrice: state.economy.tbsPrice,
        palmsLost,
        sick,
        profit: state.run.years.at(-1)?.profit ?? 0,
        conditions: state.run.years.at(-1)?.conditionsMet ?? 0,
      });
      cashAtYearStart = state.economy.cash;
      soldAtYearStart = state.economy.soldKgTotal;
    }
  }

  const ending = state.run.ending ?? null;
  const endedYear =
    state.run.endedAt === undefined ? null : Math.ceil(state.run.endedAt / GROWTH.daysPerYear);

  return { sim, rows, lowestCash, ending, endedYear };
}

/**
 * The careful player's pest routine for one planted block: traps when the
 * beetles build up, sanitation when debris piles up, Trichoderma and removal
 * once Ganoderma shows, and replanting the gaps every so often.
 */
function managePests(
  sim: Sim,
  block: BlockId,
  buyAnd: (item: ItemId, command: Command) => void,
): void {
  const { state } = sim;
  const b = state.blocks.get(block)!;
  const palms = state.palms.get(block);

  if (!palms) return;

  const tick = state.tick;

  if (b.debris > 30) buyAnd('sanitationCrew', { type: 'SanitizeBlock', block });
  if (b.beetles > 15 && b.trapsUntil <= tick) buyAnd('pheromoneTrap', { type: 'SetTrap', block });

  if (tick % 30 === 0) {
    const counts = ganodermaCounts(palms);

    if (counts.symptomatic + counts.dead > 0) {
      if (b.trichodermaUntil <= tick) buyAnd('trichoderma', { type: 'ApplyTrichoderma', block });

      for (let slot = 0; slot < palms.plantedAt.length; slot++) {
        if (palms.plantedAt[slot]! >= 0 && palms.ganoderma[slot]! >= 2) {
          sim.dispatch({ type: 'RemovePalm', block, slot });
        }
      }
    }
  }

  if (tick % 180 === 0) {
    const rejection = sim.validate({ type: 'ReplantBlock', block });

    if (rejection?.code === 'noInventory') {
      const needed = Number(/Needs (\d+)/.exec(rejection.reason)?.[1] ?? 0);

      if (needed > 0) sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: needed });
    }

    sim.dispatch({ type: 'ReplantBlock', block });
  }
}
