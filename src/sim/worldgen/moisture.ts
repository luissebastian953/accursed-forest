import { NOISE, WORLD } from '../balance/world.ts';

import { NOISE_TAG, noiseFor, type ElevationField } from './elevation.ts';

export interface MoistureField {
  /** Moisture before any river boost, 0..1. */
  base(x: number, y: number): number;
}

export function createMoistureField(seed: number, elevation: ElevationField): MoistureField {
  const noise = noiseFor(seed, NOISE_TAG.moisture);

  return {
    base(x, y) {
      const n = noise(x * NOISE.moistureScale, y * NOISE.moistureScale);
      const wet = (n + 1) / 2;
      const highness = elevation.elevation(x, y) / WORLD.maxElevation;

      return Math.min(1, Math.max(0, wet - highness * NOISE.moistureElevationBias));
    },
  };
}
