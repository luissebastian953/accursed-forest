import { sampleCurve } from '@shared/math';

import { HARVEST_ROTATION_DAYS, YIELD_CURVE } from '../balance/growth.ts';
import { HARVEST } from '../balance/prices.ts';
import { ASH_EVENT, activeEvent } from '../fire.ts';
import { inKopdesRange } from '../kopdes.ts';
import { wageFactor } from '../macro.ts';
import { ageInYears, isBearing, slotStage } from '../palms.ts';
import { spend, writeBlock, type SimContext } from '../state.ts';
import type { Block, BlockId, PalmArrays, Species, Tick } from '../types.ts';

import { operatingBanned } from './society.ts';

export function isRipe(block: Readonly<Block>, tick: Tick): boolean {
  return block.lastHarvest >= 0 && tick - block.lastHarvest >= HARVEST_ROTATION_DAYS;
}

/** Days until the next round, 0 if ripe now, null if the clock has not started. */
export function daysUntilRipe(block: Readonly<Block>, tick: Tick): number | null {
  if (block.lastHarvest < 0) return null;
  return Math.max(0, HARVEST_ROTATION_DAYS - (tick - block.lastHarvest));
}

/** Palms on the block that are old enough to bear fruit. */
export function bearingCount(palms: PalmArrays, species: Species, tick: Tick): number {
  let n = 0;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    if (isBearing(slotStage(palms, slot, species, tick))) n += 1;
  }

  return n;
}

/** Kilograms waiting on the bearing palms of a block. */
export function harvestableKg(palms: PalmArrays, species: Species, tick: Tick): number {
  let kg = 0;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    if (isBearing(slotStage(palms, slot, species, tick))) kg += palms.yieldAcc[slot]!;
  }

  return kg;
}

/**
 * The most fruit this block can hold: past it the bunches rot rather than
 * accrue, so a stand left standing this long is losing what it grows.
 */
export function harvestCapKg(palms: PalmArrays, species: Species, tick: Tick): number {
  let kg = 0;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    const plantedAt = palms.plantedAt[slot]!;

    if (plantedAt < 0) continue;
    if (!isBearing(slotStage(palms, slot, species, tick))) continue;
    kg += sampleCurve(YIELD_CURVE, ageInYears(plantedAt, tick)) * HARVEST.overripeCapRounds;
  }

  return kg;
}

/**
 * Take the round off one block: fruit to the Kopdes intake, wages paid, clock
 * reset. The crew's own rounds pay a surcharge on top (GDD 3.3).
 */
export function pickBlock(ctx: SimContext, id: BlockId, auto: boolean): number {
  const { state, world, events } = ctx;
  const block = writeBlock(state, world, id);
  const palms = state.palms.get(id)!;

  let kilograms = 0;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    if (!isBearing(slotStage(palms, slot, 'palm', state.tick))) continue;
    kilograms += palms.yieldAcc[slot]!;
    palms.yieldAcc[slot] = 0;
  }

  block.lastHarvest = state.tick;
  state.economy.tbsPending += kilograms;
  spend(
    state,
    Math.round(
      (HARVEST.crewWagePerRound + (auto ? HARVEST.autoSurchargePerRound : 0)) * wageFactor(state),
    ),
    'wages',
    `${auto ? 'auto-harvest' : 'harvest'}: block ${id}`,
  );

  events.push({ type: 'Harvested', block: id, kilograms });
  events.push({ type: 'CashChanged', cash: state.economy.cash });
  return kilograms;
}

export function harvest(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;
  // The Kopdes crew picks for you, unless ash is falling or the estate is shut.
  const autoCrew =
    (state.kopdes?.autoHarvest ?? false) &&
    !activeEvent(state, ASH_EVENT) &&
    !operatingBanned(state);

  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);

    if (!block || block.phase !== 'planted' || block.species !== 'palm') continue;

    let bearing = false;

    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      const plantedAt = palms.plantedAt[slot]!;

      if (plantedAt < 0) continue;
      if (!isBearing(slotStage(palms, slot, 'palm', tick))) continue;
      bearing = true;

      // Rot: fruit does not wait on the tree forever.
      const cap = sampleCurve(YIELD_CURVE, ageInYears(plantedAt, tick)) * HARVEST.overripeCapRounds;

      if (palms.yieldAcc[slot]! > cap) palms.yieldAcc[slot] = cap;
    }

    if (!bearing) continue;

    if (block.lastHarvest < 0) {
      block.lastHarvest = tick;
      continue;
    }

    if (tick - block.lastHarvest === HARVEST_ROTATION_DAYS) {
      events.push({ type: 'BlockRipe', block: id });
    }

    if (autoCrew && isRipe(block, tick) && harvestableKg(palms, 'palm', tick) > 0) {
      if (inKopdesRange(state, ctx.world, id)) pickBlock(ctx, id, true);
    }
  }
}
