import { createNoise2D } from 'simplex-noise';

import { NOISE, WORLD } from '../balance/world.ts';
import { forkRng, nextFloat, type RngState } from '../rng.ts';

/** Distinct stream tags so layers never share a noise sequence. */
export const NOISE_TAG = {
  continent: 1,
  hills: 2,
  detail: 3,
  moisture: 4,
  rivers: 5,
  features: 6,
  riverWobble: 7,
  // Render-only streams: the look of the land, never the sim's terrain.
  riverMeander: 8,
  groundTint: 9,
  groundWarp: 10,
  villages: 11,
  graves: 12,
} as const;

export function noiseFor(seed: number, tag: number): (x: number, y: number) => number {
  const rng: RngState = forkRng(seed, tag);

  return createNoise2D(() => nextFloat(rng));
}

export interface ElevationField {
  /** Continuous height, 0..1. */
  height01(x: number, y: number): number;
  /** Quantised elevation, 0..WORLD.maxElevation. */
  elevation(x: number, y: number): number;
}

export function createElevationField(seed: number): ElevationField {
  const continent = noiseFor(seed, NOISE_TAG.continent);
  const hills = noiseFor(seed, NOISE_TAG.hills);
  const detail = noiseFor(seed, NOISE_TAG.detail);

  const height01 = (x: number, y: number): number => {
    const c = continent(x * NOISE.continentScale, y * NOISE.continentScale);
    const h = hills(x * NOISE.hillScale, y * NOISE.hillScale);
    const d = detail(x * NOISE.detailScale, y * NOISE.detailScale);

    const raw = c * NOISE.continentWeight + h * NOISE.hillWeight + d * NOISE.detailWeight;

    // Noise is -1..1 and the weights sum to 1, so raw is -1..1.
    return Math.min(1, Math.max(0, (raw + 1) / 2));
  };

  return {
    height01,
    elevation(x, y) {
      const steps = WORLD.maxElevation + 1;

      return Math.min(WORLD.maxElevation, Math.floor(height01(x, y) * steps));
    },
  };
}
