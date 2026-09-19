import { BIOME_RULES } from '../balance/world.ts';
import type { Biome } from '../types.ts';

export interface CellTerrain {
  elevation: number;
  slope: boolean;
  moisture: number;
  /** Blocks to the nearest river cell; `Infinity` if far away. */
  riverDistance: number;
  isWater: boolean;
}

export function classifyBiome(cell: CellTerrain): Biome {
  if (cell.isWater) return 'river';

  // The strip beside the water, before anything else claims it (GDD 3.1).
  if (cell.riverDistance <= BIOME_RULES.riverbankRange) return 'riverbank';

  if (cell.elevation >= BIOME_RULES.hillsElevation && cell.slope) return 'hills';

  if (cell.moisture < BIOME_RULES.scrubMoisture) return 'scrub';
  if (cell.moisture >= BIOME_RULES.forestMoisture) return 'forest';

  return 'grassfield';
}
