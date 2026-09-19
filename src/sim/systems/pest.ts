import { clamp } from '@shared/math';

import { BIOMES } from '../balance/biomes.ts';
import { FLOOD } from '../balance/events.ts';
import { BEETLES, GANODERMA, PLAGUE } from '../balance/pests.ts';
import { FLOOD_EVENT, activeEvent } from '../fire.ts';
import { isYoung, slotNeighbours, slotStage } from '../palms.ts';
import { chance, nextFloat } from '../rng.ts';
import { neighbourIds, type SimContext } from '../state.ts';
import type { Block, PalmArrays, Tick } from '../types.ts';

const neighbourSlots: number[] = new Array<number>(6).fill(0);

export function beetleCapacity(debris: number): number {
  return debris >= BEETLES.minDebrisToBreed ? debris * BEETLES.capacityPerDebris : 0;
}

export interface GanodermaCounts {
  latent: number;
  symptomatic: number;
  dead: number;
  planted: number;
}

export function ganodermaCounts(palms: PalmArrays): GanodermaCounts {
  const counts: GanodermaCounts = { latent: 0, symptomatic: 0, dead: 0, planted: 0 };

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;
    counts.planted += 1;

    switch (palms.ganoderma[slot]) {
      case 1:
        counts.latent += 1;
        break;
      case 2:
        counts.symptomatic += 1;
        break;
      case 3:
        counts.dead += 1;
        break;
    }
  }

  return counts;
}

/** The plague meter: beetles against a scale, plus the visibly infected share. */
export function pestPressure(block: Readonly<Block>, palms: PalmArrays | undefined): number {
  let pressure = block.beetles / PLAGUE.beetleScale;

  if (palms) {
    const c = ganodermaCounts(palms);

    if (c.planted > 0) pressure += ((c.symptomatic + c.dead) / c.planted) * PLAGUE.infectedScale;
  }

  return pressure;
}

export function pest(ctx: SimContext): void {
  const { state, events, world } = ctx;
  const tick = state.tick;

  // ── Beetles: every breeding site, planted or not ────────────────────────
  const spill: { id: number; amount: number }[] = [];

  for (const block of state.blocks.values()) {
    if (!state.active.has(block.id)) continue;

    const capacity = beetleCapacity(block.debris);

    if (capacity <= 0) {
      block.beetles = block.beetles < 0.5 ? 0 : block.beetles * BEETLES.decayWithoutFood;
      continue;
    }

    if (block.beetles < BEETLES.seedPopulation) block.beetles = BEETLES.seedPopulation;

    const growth =
      BEETLES.growthPerDay * (block.metarhiziumUntil > tick ? BEETLES.metarhiziumGrowthFactor : 1);

    block.beetles += growth * block.beetles * (1 - block.beetles / capacity);
    if (block.trapsUntil > tick)
      block.beetles = Math.max(0, block.beetles - BEETLES.trapKillPerDay);
    block.beetles = Math.min(block.beetles, capacity * 1.2);

    if (block.beetles > BEETLES.seedPopulation) {
      const flying = block.beetles * BEETLES.spilloverPerDay;

      for (const n of neighbourIds(world, block.id)) spill.push({ id: n, amount: flying });
    }
  }

  for (const { id, amount } of spill) {
    const target = state.blocks.get(id);

    if (target && beetleCapacity(target.debris) > 0) target.beetles += amount;
  }

  const floodBlocks = activeEvent(state, FLOOD_EVENT)?.blocks;
  const floodedNow = floodBlocks ? new Set(floodBlocks) : null;

  // ── Palms: beetle damage, Ganoderma seeding, progression, spread ────────
  for (const [id, palms] of state.palms) {
    const block = state.blocks.get(id);

    if (!block || (block.phase !== 'planted' && block.phase !== 'reforesting') || block.burning)
      continue;

    const species = block.species;

    // Beetles bore young palms.
    if (block.beetles > 0 && species === 'palm') {
      const expected = block.beetles * BEETLES.damagePerBeetle;
      const whole = Math.floor(expected);
      const fraction = expected - whole;

      for (let slot = 0; slot < palms.plantedAt.length; slot++) {
        if (palms.plantedAt[slot]! < 0) continue;

        const stage = slotStage(palms, slot, species, tick);

        if (!isYoung(stage)) continue;

        const loss = whole + (chance(state.rng, fraction) ? 1 : 0);

        if (loss === 0) continue;

        const health = Math.max(0, palms.health[slot]! - loss);

        palms.health[slot] = health;

        if (health === 0) {
          palms.ganoderma[slot] = 0;
          events.push({ type: 'PalmDied', block: id, slot, cause: 'beetles' });
        }
      }
    }

    if (species !== 'palm') continue;

    // Spontaneous infection: spores, worse with debris.
    const flooded = floodedNow?.has(id) ? FLOOD.ganodermaSeedFactor : 1;
    const seed =
      (GANODERMA.baseSeedPerDay + block.debris * GANODERMA.seedPerDebrisPerDay) * flooded;

    if (chance(state.rng, seed)) infectRandomHealthy(palms, tick, state.rng);

    // Progression and spread.
    const spreadFactor =
      GANODERMA.spreadPerDay *
      (1 + block.debris / 100) *
      (block.plagued ? GANODERMA.plagueSpreadFactor : 1) *
      (block.trichodermaUntil > tick ? GANODERMA.trichodermaFactor : 1);

    for (let slot = 0; slot < palms.plantedAt.length; slot++) {
      const stage = palms.ganoderma[slot]!;

      if (stage === 0 || palms.plantedAt[slot]! < 0) continue;

      if (stage < 3) {
        const young = isYoung(slotStage(palms, slot, species, tick));
        const since = tick - palms.ganodermaSince[slot]!;

        if (
          stage === 1 &&
          since >= (young ? GANODERMA.latentDays.immature : GANODERMA.latentDays.mature)
        ) {
          palms.ganoderma[slot] = 2;
          palms.ganodermaSince[slot] = tick;
          events.push({ type: 'PalmSick', block: id, slot });
        } else if (
          stage === 2 &&
          since >= (young ? GANODERMA.symptomaticDays.immature : GANODERMA.symptomaticDays.mature)
        ) {
          palms.ganoderma[slot] = 3;
          palms.ganodermaSince[slot] = tick;
          palms.yieldAcc[slot] = 0;
          block.debris = Math.min(100, block.debris + GANODERMA.debrisPerDeath);
          events.push({ type: 'PalmDied', block: id, slot, cause: 'ganoderma' });
        }
      }

      if (palms.trenched[slot] === 1) continue;

      const p = spreadFactor * (palms.ganoderma[slot] === 3 ? GANODERMA.stumpSourceFactor : 1);
      const n = slotNeighbours(slot, neighbourSlots);

      for (let i = 0; i < n; i++) {
        const target = neighbourSlots[i]!;

        if (
          palms.plantedAt[target]! < 0 ||
          palms.ganoderma[target] !== 0 ||
          palms.trenched[target] === 1
        )
          continue;
        if (!chance(state.rng, p)) continue;
        palms.ganoderma[target] = 1;
        palms.ganodermaSince[target] = tick;
      }
    }

    // ── Plague flag, with hysteresis ──────────────────────────────────────
    const pressure = pestPressure(block, palms);

    if (!block.plagued && pressure >= PLAGUE.onAt) {
      block.plagued = true;
      events.push({ type: 'PlagueStarted', block: id });
    } else if (block.plagued && pressure <= PLAGUE.offAt) {
      block.plagued = false;
      events.push({ type: 'PlagueEnded', block: id });
    }
  }
}

function infectRandomHealthy(palms: PalmArrays, tick: Tick, rng: SimContext['state']['rng']): void {
  const healthy: number[] = [];

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! >= 0 && palms.ganoderma[slot] === 0) healthy.push(slot);
  }

  if (healthy.length === 0) return;

  const slot = healthy[Math.floor(nextFloat(rng) * healthy.length)]!;

  palms.ganoderma[slot] = 1;
  palms.ganodermaSince[slot] = tick;
}

/** Slots a block can hold palms in (hills terrace to fewer). */
export function plantableSlots(block: Readonly<Block>): number {
  return clamp(BIOMES[block.biome].plantableSlots, 0, 144);
}
