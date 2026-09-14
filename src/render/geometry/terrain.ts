/**
 * Column terrain mesher (§6.3, §6.7).
 *
 * The world is a grid of 1-unit columns whose heights are quantised to half-unit
 * steps. Top faces are painted by biome/height, exposed sides by depth. Only
 * faces exposed to a lower neighbour are emitted — at estate scale that culls
 * most of the geometry, which is what keeps a 48x48 chunk inside the
 * ~6-10k triangle budget.
 *
 * This runs in `workers/mesher.worker.ts` once chunk streaming lands; it is kept
 * dependency-light (no sim imports) so the worker can own it.
 */

import type { BufferGeometry } from 'three/webgpu';

import { BoxBuilder } from './boxBuilder.ts';

export interface ColumnField {
  /** Columns per side. */
  size: number;
  /** Top surface Y per column, row-major `z * size + x`. Already quantised. */
  heights: Float32Array;
  /** Palette slot for each column's top face, row-major. */
  topSlots: Uint16Array;
  /** Palette slot for exposed vertical faces. */
  sideSlot: number;
  /** Palette slot for the deepest exposed band (rock under the soil). */
  deepSlot?: number;
  /** Y below which nothing is drawn — the underside of the diorama slab. */
  floorY: number;
  /** World-space offset of column (0,0). */
  originX?: number;
  originZ?: number;
}

/** Height sampler that treats out-of-bounds as the floor, so edges step down. */
function heightAt(field: ColumnField, x: number, z: number): number {
  if (x < 0 || z < 0 || x >= field.size || z >= field.size) return field.floorY;
  return field.heights[z * field.size + x]!;
}

export function buildColumnGeometry(field: ColumnField): BufferGeometry {
  const b = new BoxBuilder();
  const ox = field.originX ?? 0;
  const oz = field.originZ ?? 0;

  for (let z = 0; z < field.size; z++) {
    for (let x = 0; x < field.size; x++) {
      const h = field.heights[z * field.size + x]!;

      const east = heightAt(field, x + 1, z);
      const west = heightAt(field, x - 1, z);
      const south = heightAt(field, x, z + 1);
      const north = heightAt(field, x, z - 1);

      // The box only needs to reach down as far as the lowest exposed neighbour.
      const lowest = Math.min(east, west, south, north);
      const hasSides = lowest < h - 1e-6;
      const yBottom = hasSides ? Math.max(field.floorY, lowest) : h - 0.02;
      const height = Math.max(0.02, h - yBottom);

      // Deep columns show rock rather than soil on their exposed band.
      const deep = field.deepSlot !== undefined && height > 1.2;

      b.addAABox(
        ox + x + 0.5,
        yBottom + height / 2,
        oz + z + 0.5,
        1,
        height,
        1,
        {
          side: deep ? field.deepSlot! : field.sideSlot,
          top: field.topSlots[z * field.size + x]!,
        },
        {
          // never visible: the underside of the slab, and any face whose
          // neighbour is at least as tall as this column
          ny: true,
          px: east >= h - 1e-6,
          nx: west >= h - 1e-6,
          pz: south >= h - 1e-6,
          nz: north >= h - 1e-6,
        },
      );
    }
  }

  return b.build();
}
