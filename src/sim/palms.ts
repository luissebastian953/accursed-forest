import { FOREST_GROWTH, GROWTH } from './balance/growth.ts';
import { SLOTS_PER_BLOCK, WORLD } from './balance/world.ts';
import type { GrowthStage, PalmArrays, Species, Tick } from './types.ts';

export function createPalmArrays(slots: number = SLOTS_PER_BLOCK): PalmArrays {
  return {
    plantedAt: new Int32Array(slots).fill(-1),
    growth: new Float32Array(slots),
    health: new Uint8Array(slots),
    ganoderma: new Uint8Array(slots),
    yieldAcc: new Float32Array(slots),
    ganodermaSince: new Int32Array(slots).fill(-1),
    trenched: new Uint8Array(slots),
  };
}

/** Put a fresh palm in one slot. Trenches survive replanting. */
export function plantSlot(palms: PalmArrays, slot: number, tick: Tick): void {
  palms.plantedAt[slot] = tick;
  palms.growth[slot] = 0;
  palms.health[slot] = 255;
  palms.ganoderma[slot] = 0;
  palms.ganodermaSince[slot] = -1;
  palms.yieldAcc[slot] = 0;
}

/** Empty a slot, leaving the ground (and any trench) as it was. */
export function clearSlot(palms: PalmArrays, slot: number): void {
  palms.plantedAt[slot] = -1;
  palms.growth[slot] = 0;
  palms.health[slot] = 0;
  palms.ganoderma[slot] = 0;
  palms.ganodermaSince[slot] = -1;
  palms.yieldAcc[slot] = 0;
}

/** Plant the first `count` empty slots. Returns how many were planted. */
export function plantSlots(palms: PalmArrays, count: number, tick: Tick): number {
  let planted = 0;
  for (let i = 0; i < palms.plantedAt.length && planted < count; i++) {
    if (palms.plantedAt[i] !== -1) continue;
    plantSlot(palms, i, tick);
    planted += 1;
  }
  return planted;
}

export function ageInYears(plantedAt: Tick, tick: Tick): number {
  return (tick - plantedAt) / GROWTH.daysPerYear;
}

/**
 * The stage a palm (or reforested tree) is in.
 *
 * `ganoderma === 3` and zero health are both "dead"; senescence is by calendar
 * age; everything else is by accumulated growth-days.
 */
export function stageOf(
  species: Species,
  growthDays: number,
  ageDays: number,
  health: number,
  ganoderma: number,
): GrowthStage {
  if (health <= 0 || ganoderma === 3) return 'dead';

  if (species === 'forest') {
    if (growthDays >= FOREST_GROWTH.matureDays) return 'mature';
    if (growthDays >= FOREST_GROWTH.saplingDays) return 'immature';
    return 'seedling';
  }

  const ageYears = ageDays / GROWTH.daysPerYear;
  if (ageYears >= GROWTH.deadYears) return 'dead';
  if (ageYears >= GROWTH.senileYears) return 'senile';
  if (growthDays >= GROWTH.immatureDays) return 'mature';
  if (growthDays >= GROWTH.seedlingDays) return 'immature';
  return 'seedling';
}

export function slotStage(
  palms: PalmArrays,
  slot: number,
  species: Species,
  tick: Tick,
): GrowthStage {
  const plantedAt = palms.plantedAt[slot]!;
  if (plantedAt < 0) return 'empty';
  return stageOf(
    species,
    palms.growth[slot]!,
    tick - plantedAt,
    palms.health[slot]!,
    palms.ganoderma[slot]!,
  );
}

/** Palms that bear fruit. */
export function isBearing(stage: GrowthStage): boolean {
  return stage === 'mature' || stage === 'senile';
}

/** Palms the beetle bores: the young ones (GDD 2). */
export function isYoung(stage: GrowthStage): boolean {
  return stage === 'seedling' || stage === 'immature';
}

// ── Lattice ───────────────────────────────────────────────────────────────

const SIDE = WORLD.blockSide;

export function slotRow(slot: number): number {
  return Math.floor(slot / SIDE);
}

export function slotCol(slot: number): number {
  return slot % SIDE;
}

export function slotIndex(row: number, col: number): number {
  return row * SIDE + col;
}

/**
 * The up-to-six neighbours of a slot on the offset triangular lattice, written
 * into `out`; returns how many. Odd rows are shifted right by half a slot.
 */
export function slotNeighbours(slot: number, out: number[]): number {
  const row = slotRow(slot);
  const col = slotCol(slot);
  const odd = row % 2 === 1;
  let n = 0;

  const push = (r: number, c: number): void => {
    if (r < 0 || c < 0 || r >= SIDE || c >= SIDE) return;
    out[n++] = slotIndex(r, c);
  };

  push(row, col - 1);
  push(row, col + 1);
  if (odd) {
    push(row - 1, col);
    push(row - 1, col + 1);
    push(row + 1, col);
    push(row + 1, col + 1);
  } else {
    push(row - 1, col - 1);
    push(row - 1, col);
    push(row + 1, col - 1);
    push(row + 1, col);
  }
  return n;
}
