import { BANKRUPTCY, ISPO, REBOISASI, REDEMPTION } from '../balance/endings.ts';
import { LANDSLIDE } from '../balance/events.ts';
import { GROWTH } from '../balance/growth.ts';
import { ECONOMY } from '../balance/prices.ts';
import { inKopdesRange } from '../kopdes.ts';
import { blockLabel } from '../labels.ts';
import { estateForestCover, forestCoverAround } from '../landscape.ts';
import { slotStage } from '../palms.ts';
import { chronicle, endRun, runOver } from '../run.ts';
import { readBlock, type SimContext } from '../state.ts';
import type { BlockId, SimState, YearSummary } from '../types.ts';
import type { World } from '../worldgen/index.ts';

import { bearingCount } from './harvest.ts';
import { operatingBanned } from './society.ts';

export type IspoConditionId = 'profit' | 'hectares' | 'noBurn' | 'forest' | 'kopdes';

/** How many conditions there are, so the HUD's pips are not a magic number. */
export const ISPO_CONDITIONS = 5;

export interface IspoCondition {
  id: IspoConditionId;
  met: boolean;
  value: number;
  target: number;
}

export function endings(ctx: SimContext): void {
  const { state } = ctx;

  if (runOver(state)) return;

  const closedYear = keepBooks(ctx);

  if (state.run.sandbox) return;

  if (insolvent(ctx)) return;
  if (closedYear !== null) closeYear(ctx, closedYear);
}

// ── The books ─────────────────────────────────────────────────────────────

/** Count what the epilogue will show. Returns the year that just closed, if one did. */
function keepBooks(ctx: SimContext): number | null {
  const { state, world, events } = ctx;
  const stats = state.run.stats;
  const burned: BlockId[] = [];
  const chopped: BlockId[] = [];
  let spread = 0;
  let spreadNotYours = 0;
  let closedYear: number | null = null;

  for (const event of events.peek()) {
    switch (event.type) {
      case 'BurnStarted':
        stats.burns += 1;
        stats.blocksBurned += 1;
        burned.push(event.block);
        break;
      case 'FireSpread':
        stats.blocksBurned += 1;
        spread += 1;

        if (!readBlock(state, world, event.to).owned) {
          stats.neighbourBlocksBurned += 1;
          spreadNotYours += 1;
        }

        break;
      case 'PalmDied':
        stats.palmsLost += 1;
        break;
      case 'PalmsBurned':
        stats.palmsLost += event.count;
        break;
      case 'Landslide':
        stats.palmsLost += event.palmsLost;
        stats.disasters += 1;
        break;
      case 'WeatherEventStarted':
      case 'WildfireStarted':
        stats.disasters += 1;
        break;
      case 'ForestChopped':
        stats.forestChopped += 1;
        chopped.push(event.block);
        break;
      case 'BlockPlanted':
        if (event.species === 'forest') {
          stats.forestPlanted += 1;
          chronicle(state, {
            lane: 'estate',
            severity: 'notice',
            title: `Forest planted back on ${blockList(world, [event.block])}`,
          });
        }

        break;
      case 'InvestigationSettled':
        stats.settled += event.cost;
        break;
      case 'KopdesUpgraded':
        chronicle(state, {
          lane: 'estate',
          severity: 'notice',
          title: `Kopdes upgraded to level ${event.level}`,
        });
        break;
      case 'YearPassed':
        closedYear = event.year;
        break;
      default:
        break;
    }
  }

  if (chopped.length > 0) {
    chronicle(state, {
      lane: 'estate',
      severity: 'notice',
      title: `Forest chopped on ${blockList(world, chopped)}`,
    });
  }

  if (burned.length > 0) {
    chronicle(state, {
      lane: 'estate',
      severity: 'warning',
      title: `${capitalise(blockList(world, burned))} burned to clear`,
    });
  }

  if (spread > 0) {
    chronicle(state, {
      lane: 'estate',
      severity: spreadNotYours > 0 ? 'critical' : 'warning',
      title:
        spreadNotYours > 0
          ? `Fire spread to ${spread} block${spread === 1 ? '' : 's'}, ${spreadNotYours} not yours`
          : `Fire spread to ${spread} block${spread === 1 ? '' : 's'}`,
    });
  }

  stats.lowestCash = Math.min(stats.lowestCash, state.economy.cash);
  return closedYear;
}

function blockList(world: World, blocks: readonly BlockId[]): string {
  const names = blocks.map((id) => blockLabel(world, id));

  if (names.length === 1) return `block ${names[0]}`;
  if (names.length <= 3) return `blocks ${names.join('; ')}`;
  return `${names.length} blocks`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ── Bankruptcy and the ban ────────────────────────────────────────────────

/**
 * How far into the red the bank lets the estate go, with palms in Kopdes
 * range as collateral.
 */
export function creditLine(state: SimState, world: World): number {
  if (!state.kopdes || operatingBanned(state)) return 0;

  let hectares = 0;

  for (const block of state.blocks.values()) {
    if (block.phase !== 'planted' || block.species !== 'palm') continue;
    if (inKopdesRange(state, world, block.id)) hectares += 1;
  }

  return hectares * BANKRUPTCY.creditPerHectare;
}

function insolvent(ctx: SimContext): boolean {
  const { state, world, events } = ctx;
  const run = state.run;
  const cash = state.economy.cash;

  run.insolventFor = cash < 0 && cash < -creditLine(state, world) ? run.insolventFor + 1 : 0;
  if (run.insolventFor < BANKRUPTCY.daysInRed) return false;

  // A ban that stood at any point in this spell is what sank the estate.
  const banned = state.society.operatingBanUntil > state.tick - run.insolventFor;
  const ending = banned ? 'banned' : 'bankrupt';

  endRun(state, ending);
  events.push({ type: 'RunEnded', ending });
  return true;
}

// ── The year ──────────────────────────────────────────────────────────────

/** Blocks of palms where at least `ISPO.matureShare` of the palms bear. One block is one hectare. */
/** Blocks planted with palms, bearing or not. */
export function palmHectares(state: SimState): number {
  let n = 0;

  for (const block of state.blocks.values()) {
    if (block.phase === 'planted' && block.species === 'palm') n += 1;
  }

  return n;
}

/** Reforesting blocks whose trees have mostly grown past sapling. */
export function reforestedHectares(state: SimState): number {
  let n = 0;

  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);

    if (block?.phase !== 'reforesting') continue;

    let planted = 0;
    let grown = 0;

    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      if (palms.plantedAt[slot]! < 0) continue;
      planted += 1;

      const stage = slotStage(palms, slot, 'forest', state.tick);

      if (stage === 'immature' || stage === 'mature') grown += 1;
    }

    if (planted > 0 && grown >= planted * REBOISASI.grownShare) n += 1;
  }

  return n;
}

/**
 * Redemption's test (secret): fire was set here, the forest put back, and
 * the estate never became an estate.
 */
export function redemptionReached(state: SimState): boolean {
  if (state.run.stats.burns < REDEMPTION.burnsAtLeast) return false;
  if (palmHectares(state) > 0 || state.economy.soldKgTotal > 0) return false;
  return reforestedHectares(state) >= REDEMPTION.hectares;
}

/** The reboisasi ending's test: more land back to forest than under palms, by a margin. */
export function reboisasiReached(state: SimState): boolean {
  const forest = reforestedHectares(state);

  return (
    forest >= REBOISASI.minHectares && forest >= palmHectares(state) + REBOISASI.marginHectares
  );
}

export function matureHectares(state: SimState): number {
  let n = 0;

  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);

    if (block?.phase !== 'planted' || block.species !== 'palm') continue;

    let planted = 0;

    for (const t of palms.plantedAt) if (t >= 0) planted += 1;
    if (planted > 0 && bearingCount(palms, 'palm', state.tick) >= planted * ISPO.matureShare)
      n += 1;
  }

  return n;
}

/**
 * Forest share around the estate's slopes (GDD 3.6.2); overall cover if there
 * are none.
 */
export function slopeForestCover(state: SimState, world: World): number {
  const r = LANDSLIDE.coverRadius;
  const seen = new Set<BlockId>();
  let sum = 0;
  let n = 0;

  for (const block of state.blocks.values()) {
    if (!block.owned) continue;

    const [x, y] = world.toXY(block.id);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!world.inBounds(x + dx, y + dy)) continue;

        const id = world.toId(x + dx, y + dy);

        if (seen.has(id)) continue;
        seen.add(id);

        const b = readBlock(state, world, id);

        if (!b.slope || b.biome === 'river') continue;
        sum += forestCoverAround(state, world, id);
        n += 1;
      }
    }
  }

  return n === 0 ? estateForestCover(state, world) : sum / n;
}

/**
 * The five ISPO conditions (GDD 3.8), as they stand now. Profit counts the year
 * in progress; "profitable in each of the last three years" only closed ones.
 */
export function ispoConditions(state: SimState, world: World): IspoCondition[] {
  const run = state.run;
  const recent = run.years.slice(-ISPO.profitableYears);
  const profit = run.profitTotal + run.yearProfit;
  const profitable = recent.length === ISPO.profitableYears && recent.every((y) => y.profit > 0);
  const hectares = matureHectares(state);
  const noBurnDays = ISPO.noBurnYears * GROWTH.daysPerYear;
  const sinceBurn = run.lastBurnAt < 0 ? state.tick : state.tick - run.lastBurnAt;
  const forest = slopeForestCover(state, world);
  const level = state.kopdes?.level ?? 0;

  return [
    {
      id: 'profit',
      met: profit >= ISPO.winProfit && profitable,
      value: profit,
      target: ISPO.winProfit,
    },
    {
      id: 'hectares',
      met: hectares >= ISPO.winHectares,
      value: hectares,
      target: ISPO.winHectares,
    },
    {
      id: 'noBurn',
      met: run.lastBurnAt < 0 || sinceBurn >= noBurnDays,
      value: sinceBurn / GROWTH.daysPerYear,
      target: ISPO.noBurnYears,
    },
    {
      id: 'forest',
      met: forest >= ISPO.winForestFloor,
      value: forest,
      target: ISPO.winForestFloor,
    },
    {
      id: 'kopdes',
      met: level >= ECONOMY.kopdesMaxLevel,
      value: level,
      target: ECONOMY.kopdesMaxLevel,
    },
  ];
}

function closeYear(ctx: SimContext, year: number): void {
  const { state, world, events } = ctx;
  const run = state.run;

  const profit = run.yearProfit;

  run.profitTotal += profit;
  run.yearProfit = 0;

  const summary: YearSummary = {
    year,
    profit,
    cash: state.economy.cash,
    matureHectares: matureHectares(state),
    forestCover: estateForestCover(state, world),
    conditionsMet: 0,
  };

  run.years.push(summary);
  if (run.years.length > ISPO.yearsKept) run.years.splice(0, run.years.length - ISPO.yearsKept);

  const closed = ispoConditions(state, world);

  summary.conditionsMet = closed.filter((c) => c.met).length;
  events.push({ type: 'YearClosed', summary });

  // Quiet years before the first harvest are not part of the story.
  if (summary.matureHectares > 0 || Math.abs(profit) >= 1_000_000) {
    chronicle(state, {
      lane: 'estate',
      severity: 'notice',
      title: `Year ${year} closed: ${summary.profit >= 0 ? 'profit' : 'loss'} Rp ${Math.abs(Math.round(summary.profit / 1_000_000))}M, ${summary.matureHectares} ha bearing`,
    });
  }

  // Redemption first: it is the narrower story, and the one that says why the
  // forest went back. Reboisasi is the same act without the fire beforehand.
  if (year >= ISPO.progressFromYear && redemptionReached(state)) {
    endRun(state, 'redemption');
    events.push({ type: 'RunEnded', ending: 'redemption' });
    return;
  }

  // The forest next: someone who put the land back is not waiting on a certificate.
  if (year >= ISPO.progressFromYear && reboisasiReached(state)) {
    endRun(state, 'reboisasi');
    events.push({ type: 'RunEnded', ending: 'reboisasi' });
    return;
  }

  const met = (id: IspoConditionId): boolean => closed.find((c) => c.id === id)!.met;

  if (met('profit') && met('hectares') && met('kopdes')) {
    const waived = (['noBurn', 'forest'] as const).filter((id) => !met(id));

    if (waived.length === 0 || state.society.integrity < ISPO.waiverMaxIntegrity) {
      const ending = waived.length === 0 ? 'clean' : 'dirty';

      endRun(state, ending);
      events.push({ type: 'Certified', clean: ending === 'clean', waived: [...waived] });
      events.push({ type: 'RunEnded', ending });
      return;
    }
  }

  if (year >= ISPO.horizonYears) {
    endRun(state, 'fade');
    events.push({ type: 'RunEnded', ending: 'fade' });
  }
}
