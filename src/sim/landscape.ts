import { BIOMES } from './balance/biomes.ts';
import { COVER_CROP, FOREST_COVER_WEIGHT, LANDSLIDE } from './balance/events.ts';
import { FOREST_GROWTH } from './balance/growth.ts';
import type { EventSink } from './events.ts';
import { landslideFactor } from './macro.ts';
import { neighbourIds, readBlock, writeBlock } from './state.ts';
import type { Block, BlockId, SimState, Tick } from './types.ts';
import type { World } from './worldgen/index.ts';

/** How much this one block counts as forest, 0..1. */
export function forestWeight(state: SimState, block: Readonly<Block>): number {
  if (block.burning) return 0;
  if (block.phase === 'wild') return BIOMES[block.biome].forestCover ? FOREST_COVER_WEIGHT.wild : 0;
  if (block.phase !== 'reforesting') return 0;

  const palms = state.palms.get(block.id);

  if (!palms) return 0;

  let sum = 0;
  let n = 0;

  for (let slot = 0; slot < palms.plantedAt.length; slot++) {
    if (palms.plantedAt[slot]! < 0) continue;

    const g = palms.growth[slot]!;

    sum +=
      g >= FOREST_GROWTH.matureDays
        ? FOREST_COVER_WEIGHT.reforestMature
        : g >= FOREST_GROWTH.saplingDays
          ? FOREST_COVER_WEIGHT.reforestYoung
          : 0;
    n += 1;
  }

  return n === 0 ? 0 : sum / n;
}

/** Share of forest in the neighbourhood of a block, 0..1, the block itself included. */
export function forestCoverAround(
  state: SimState,
  world: World,
  id: BlockId,
  radius: number = LANDSLIDE.coverRadius,
): number {
  const [x, y] = world.toXY(id);
  let sum = 0;
  let n = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!world.inBounds(x + dx, y + dy)) continue;

      const neighbour = readBlock(state, world, world.toId(x + dx, y + dy));

      if (neighbour.biome === 'river') continue;
      sum += forestWeight(state, neighbour);
      n += 1;
    }
  }

  return n === 0 ? 0 : sum / n;
}

/**
 * Forest cover across the estate's neighbourhood; every owned block and
 * everything within the cover radius of one (GDD 8 top bar).
 */
export function estateForestCover(state: SimState, world: World): number {
  const region = new Set<BlockId>();
  const r = LANDSLIDE.coverRadius;

  for (const block of state.blocks.values()) {
    if (!block.owned) continue;

    const [x, y] = world.toXY(block.id);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (world.inBounds(x + dx, y + dy)) region.add(world.toId(x + dx, y + dy));
      }
    }
  }

  let sum = 0;
  let n = 0;

  for (const id of region) {
    const block = readBlock(state, world, id);

    if (block.biome === 'river') continue;
    sum += forestWeight(state, block);
    n += 1;
  }

  return n === 0 ? 0 : sum / n;
}

export function coverCropEstablished(block: Readonly<Block>, tick: Tick): boolean {
  if (block.coverCropUntil <= tick) return false;
  return tick >= block.coverCropUntil - COVER_CROP.days + COVER_CROP.establishDays;
}

/** Today's chance that this slope gives way (GDD 3.6.2). Zero off-slope or out of the wet. */
export function landslideChance(
  state: SimState,
  world: World,
  block: Readonly<Block>,
  wetSeason: boolean,
): number {
  if (!wetSeason || !block.slope || block.biome === 'river' || block.phase === 'kopdes') return 0;

  const streak = Math.min(
    LANDSLIDE.maxStreakFactor,
    1 + state.weather.wetStreak / LANDSLIDE.streakScale,
  );
  const cover = forestCoverAround(state, world, block.id);
  const planted =
    block.phase === 'planted' || block.phase === 'cleared' || block.phase === 'clearing';
  const crop = coverCropEstablished(block, state.tick) ? LANDSLIDE.coverCropFactor : 1;

  return (
    LANDSLIDE.basePerDay *
    streak *
    (1 - cover) *
    (planted ? LANDSLIDE.plantedFactor : LANDSLIDE.unplantedFactor) *
    crop *
    landslideFactor(state)
  );
}

/**
 * The slope gives way: palms on it are gone, the ground is torn to debris,
 * and the spoil lands on the lowest neighbour.
 */
export function slide(state: SimState, world: World, events: EventSink, id: BlockId): void {
  const block = writeBlock(state, world, id);
  const palms = state.palms.get(id);
  let lost = 0;

  if (palms) {
    for (const t of palms.plantedAt) if (t >= 0) lost += 1;
    state.palms.delete(id);
  }

  if (block.phase === 'planted' || block.phase === 'reforesting' || block.phase === 'clearing') {
    block.phase = 'cleared';
    block.clearProgress = 1;
  }

  block.lastHarvest = -1;
  block.coverCropUntil = -1;
  block.debris = Math.min(100, block.debris + LANDSLIDE.debrisOnBlock);
  // The scar stays on the block until something is planted on it again: the
  // HUD keeps a pin over it so a slide on the far side is not missed.
  block.landslideAt = state.tick;
  block.landslidePalms = lost;

  let below: Block | null = null;

  for (const n of neighbourIds(world, id)) {
    const candidate = readBlock(state, world, n);

    if (candidate.biome === 'river') continue;

    if (
      candidate.elevation < block.elevation &&
      (below === null || candidate.elevation < below.elevation)
    ) {
      below = writeBlock(state, world, n);
    }
  }

  if (below) below.debris = Math.min(100, below.debris + LANDSLIDE.debrisBelow);

  events.push({ type: 'Landslide', block: id, below: below?.id ?? null, palmsLost: lost });
  events.push({ type: 'BlockChanged', block: id });
  if (below) events.push({ type: 'BlockChanged', block: below.id });
}
