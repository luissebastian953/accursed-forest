/**
 * Column terrain mesher (§6.3, §6.7).
 *
 * The world is a grid of 1-unit columns whose heights are quantised to half-unit
 * steps. Top faces are painted by biome/height, exposed sides by depth. Only
 * faces exposed to a lower neighbour are emitted; at estate scale that culls
 * most of the geometry, which is what keeps a 48x48 chunk inside the
 * ~6-10k triangle budget.
 *
 * This runs in `workers/mesher.worker.ts` once chunk streaming lands; it is kept
 * dependency-light (no sim imports) so the worker can own it.
 */

import type { BufferGeometry } from 'three';

import { BoxBuilder, geometryFromArrays, type MeshArrays } from './boxBuilder.ts';

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
  /** Y below which nothing is drawn; the underside of the diorama slab. */
  floorY: number;
  /**
   * Columns within `inset` of the field's edge are neighbour context only:
   * their heights cull the faces of the columns beside them, but they are not
   * emitted. A chunk builds with `inset: 1` so its border faces are culled
   * against the next chunk rather than drawn as a wall down to the floor.
   */
  inset?: number;
  /** World-space position of the first *emitted* column. */
  originX?: number;
  originZ?: number;
}

/** Height sampler that treats out-of-bounds as the floor, so edges step down. */
function heightAt(field: ColumnField, x: number, z: number): number {
  if (x < 0 || z < 0 || x >= field.size || z >= field.size) return field.floorY;
  return field.heights[z * field.size + x]!;
}

/**
 * Mesh a column field. `decorate` may add more boxes to the same builder;
 * the chunk mesher grows its trees and rocks there, so they ship as one mesh.
 */
export function buildColumnArrays(
  field: ColumnField,
  decorate?: (builder: BoxBuilder) => void,
): MeshArrays {
  const b = new BoxBuilder();
  const inset = field.inset ?? 0;
  const ox = (field.originX ?? 0) - inset;
  const oz = (field.originZ ?? 0) - inset;

  for (let z = inset; z < field.size - inset; z++) {
    for (let x = inset; x < field.size - inset; x++) {
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

  decorate?.(b);
  return b.toArrays();
}

export function buildColumnGeometry(field: ColumnField): BufferGeometry {
  return geometryFromArrays(buildColumnArrays(field));
}
