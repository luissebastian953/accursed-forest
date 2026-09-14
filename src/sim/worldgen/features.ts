/**
 * Map-scale features (§4.6): protected forest, and where the player starts.
 *
 * Both need to see the whole map at once — the largest contiguous forest
 * cluster, and a start site with a river in reach — so unlike elevation and
 * moisture they are computed once when the world is created rather than
 * per-cell on demand.
 */

import { PROTECTED, START_SITE, WORLD } from '../balance/world.ts';
import type { Biome } from '../types.ts';

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface FeatureInputs {
  width: number;
  height: number;
  biomeAt: (x: number, y: number) => Biome;
  elevationAt: (x: number, y: number) => number;
  riverDistanceAt: (x: number, y: number) => number;
}

/**
 * The largest contiguous cluster of high forest, plus a one-block buffer ring,
 * becomes protected forest — the map's fixed boundary. Returns an empty set if
 * no cluster reaches the minimum size, which is a legitimate world.
 */
export function findProtectedForest(input: FeatureInputs): Set<number> {
  const { width, height, biomeAt, elevationAt } = input;
  const seen = new Uint8Array(width * height);
  let best: number[] = [];

  const eligible = (x: number, y: number): boolean =>
    biomeAt(x, y) === 'forest' && elevationAt(x, y) >= PROTECTED.minElevation;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = y * width + x;
      if (seen[key] === 1 || !eligible(x, y)) continue;

      const cluster: number[] = [];
      const stack = [key];
      seen[key] = 1;

      while (stack.length > 0) {
        const current = stack.pop()!;
        cluster.push(current);
        const cx = current % width;
        const cy = (current - cx) / width;

        for (const [dx, dy] of NEIGHBOURS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nKey = ny * width + nx;
          if (seen[nKey] === 1 || !eligible(nx, ny)) continue;
          seen[nKey] = 1;
          stack.push(nKey);
        }
      }

      if (cluster.length > best.length) best = cluster;
    }
  }

  if (best.length < PROTECTED.minClusterSize) return new Set();

  const result = new Set(best);
  // Buffer ring: forest immediately around the core is protected too.
  for (const key of best) {
    const x = key % width;
    const y = (key - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (biomeAt(nx, ny) === 'forest') result.add(ny * width + nx);
    }
  }
  return result;
}

export interface StartSite {
  /** Top-left of the initially owned square. */
  x: number;
  y: number;
  size: number;
  /** Block the Kopdes is pre-cleared on. */
  kopdesX: number;
  kopdesY: number;
}

const ALLOWED: ReadonlySet<Biome> = new Set(START_SITE.allowed);

/**
 * Search outward from the map centre for somewhere to put the estate: a core
 * that is plantable, off the slopes, clear of protected forest and water, with
 * a river within reach. Always returns a site — if nothing scores well the best
 * candidate found wins, because a world with nowhere to start is not playable.
 */
export function findStartSite(
  input: FeatureInputs,
  isProtected: (x: number, y: number) => boolean,
): StartSite {
  const { width, height, biomeAt, riverDistanceAt } = input;
  const size = WORLD.startSize;
  const centreX = Math.floor(width / 2);
  const centreY = Math.floor(height / 2);

  let bestScore = -Infinity;
  let bestX = Math.max(0, Math.min(width - size, centreX - Math.floor(size / 2)));
  let bestY = Math.max(0, Math.min(height - size, centreY - Math.floor(size / 2)));

  for (let dy = -START_SITE.searchRadius; dy <= START_SITE.searchRadius; dy++) {
    for (let dx = -START_SITE.searchRadius; dx <= START_SITE.searchRadius; dx++) {
      const originX = centreX + dx - Math.floor(size / 2);
      const originY = centreY + dy - Math.floor(size / 2);
      if (originX < 0 || originY < 0 || originX + size > width || originY + size > height) continue;

      const score = scoreSite(originX, originY, size, input, isProtected);
      if (score > bestScore) {
        bestScore = score;
        bestX = originX;
        bestY = originY;
      }
    }
  }

  // Put the Kopdes on the most workable cell near the middle of the region.
  const midX = bestX + Math.floor(size / 2);
  const midY = bestY + Math.floor(size / 2);
  let kopdesX = midX;
  let kopdesY = midY;
  let kopdesScore = -Infinity;

  for (let y = bestY + 1; y < bestY + size - 1; y++) {
    for (let x = bestX + 1; x < bestX + size - 1; x++) {
      if (!ALLOWED.has(biomeAt(x, y)) || isProtected(x, y)) continue;
      // Prefer flat, central, and not right on the water.
      const distance = Math.abs(x - midX) + Math.abs(y - midY);
      const riverPenalty = riverDistanceAt(x, y) < 2 ? 6 : 0;
      const score = -distance - riverPenalty + (biomeAt(x, y) === 'grassfield' ? 2 : 0);
      if (score > kopdesScore) {
        kopdesScore = score;
        kopdesX = x;
        kopdesY = y;
      }
    }
  }

  return { x: bestX, y: bestY, size, kopdesX, kopdesY };
}

function scoreSite(
  originX: number,
  originY: number,
  size: number,
  input: FeatureInputs,
  isProtected: (x: number, y: number) => boolean,
): number {
  const { biomeAt, riverDistanceAt } = input;
  let allowed = 0;
  let blocked = 0;
  let nearestRiver = Infinity;

  for (let y = originY; y < originY + size; y++) {
    for (let x = originX; x < originX + size; x++) {
      const biome = biomeAt(x, y);
      if (isProtected(x, y) || biome === 'river' || biome === 'village') blocked += 1;
      else if (ALLOWED.has(biome)) allowed += 1;
      nearestRiver = Math.min(nearestRiver, riverDistanceAt(x, y));
    }
  }

  const cells = size * size;
  const share = allowed / cells;
  if (share < START_SITE.minAllowedShare) return share - 10;

  const riverBonus = nearestRiver <= START_SITE.riverWithin ? 3 : 0;
  return share * 10 + riverBonus - (blocked / cells) * 8;
}
