/**
 * Reforestation trees, in the same box language and palette as the wild
 * forest (`models/trees/rainforestTree.ts`), at slot scale: 1 world unit is
 * one planting slot, so a mature tree's crown overlaps its neighbours and the
 * block reads as closed canopy rather than a plantation.
 *
 *   seedling  a planted sapling: a thin stem and a few leaves, tied to a
 *             wooden stake in a ring of mulch, the way replanting crews
 *             leave them;
 *   immature  a young tree with its first crown;
 *   mature    a small forest tree.
 *
 * Two variants per stage (a rounded broadleaf and a tiered crown) plus
 * per-instance scale and yaw keep a block of 144 from looking stamped.
 */

import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';

import { Palette } from '../materials/paletteSlots.ts';

import { BoxBuilder, type BoxFaces } from './boxBuilder.ts';

export type ForestStage = 'seedling' | 'immature' | 'mature';
export type ForestVariant = 'broadleaf' | 'tiered';

export const FOREST_STAGES: readonly ForestStage[] = ['seedling', 'immature', 'mature'];
export const FOREST_VARIANTS: readonly ForestVariant[] = ['broadleaf', 'tiered'];

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

/** A box centred at (x, y, z), turned about the vertical by `turn` radians. */
function turned(
  b: BoxBuilder,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  turn: number,
  faces: BoxFaces,
): void {
  _e.set(0, turn, 0);
  b.addBox(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz)), faces);
}

const LEAF: BoxFaces = { side: Palette.Canopy, top: Palette.CanopyLight };
const LEAF_LIGHT: BoxFaces = { side: Palette.CanopyLight, top: Palette.ForestLight };
const LEAF_DARK: BoxFaces = { side: Palette.CanopyDark, top: Palette.Canopy };
const BARK: BoxFaces = { side: Palette.Bark };

function sapling(b: BoxBuilder, variant: ForestVariant): void {
  // Mulch ring, the stake and its tie.
  b.addAABox(0, 0.012, 0, 0.28, 0.024, 0.28, { side: Palette.Dirt });
  b.addAABox(0.08, 0.2, 0.02, 0.024, 0.4, 0.024, { side: Palette.HouseWood });
  b.addAABox(0.045, 0.22, 0.01, 0.08, 0.022, 0.034, { side: Palette.Sand });
  // Stem.
  b.addAABox(0, 0.15, 0, 0.024, 0.3, 0.024, BARK);
  if (variant === 'broadleaf') {
    b.addAABox(0, 0.33, 0, 0.16, 0.12, 0.16, LEAF_LIGHT);
    turned(b, -0.07, 0.25, 0.05, 0.11, 0.08, 0.11, 0.6, LEAF_LIGHT);
    turned(b, 0.06, 0.28, -0.06, 0.1, 0.08, 0.1, 0.3, LEAF_LIGHT);
  } else {
    turned(b, 0, 0.22, 0, 0.22, 0.05, 0.22, 0.4, LEAF_LIGHT);
    turned(b, 0, 0.3, 0, 0.15, 0.05, 0.15, 0.9, LEAF_LIGHT);
    b.addAABox(0, 0.37, 0, 0.07, 0.07, 0.07, LEAF_LIGHT);
  }
}

function youngTree(b: BoxBuilder, variant: ForestVariant): void {
  if (variant === 'broadleaf') {
    b.addAABox(0, 0.28, 0, 0.05, 0.56, 0.05, BARK);
    turned(b, 0.08, 0.42, 0, 0.18, 0.03, 0.03, 0.4, BARK);
    turned(b, 0, 0.64, 0, 0.46, 0.36, 0.46, 0.2, LEAF);
    turned(b, 0.08, 0.86, -0.05, 0.3, 0.26, 0.3, 0.7, LEAF_LIGHT);
    turned(b, -0.17, 0.55, 0.09, 0.24, 0.2, 0.24, 1.1, LEAF);
  } else {
    b.addAABox(0, 0.33, 0, 0.05, 0.66, 0.05, BARK);
    turned(b, 0, 0.52, 0, 0.58, 0.14, 0.58, 0.3, LEAF_DARK);
    turned(b, 0, 0.66, 0, 0.42, 0.13, 0.42, 0.9, LEAF);
    turned(b, 0, 0.79, 0, 0.24, 0.13, 0.24, 0.5, LEAF_LIGHT);
  }
}

function matureTree(b: BoxBuilder, variant: ForestVariant): void {
  if (variant === 'broadleaf') {
    b.addAABox(0, 0.48, 0, 0.1, 0.96, 0.1, BARK);
    turned(b, 0.12, 0.72, 0.04, 0.3, 0.05, 0.05, 0.5, BARK);
    turned(b, 0, 1.06, 0, 1.05, 0.55, 1.05, 0.15, LEAF);
    turned(b, 0.1, 1.4, -0.08, 0.7, 0.4, 0.7, 0.8, LEAF_LIGHT);
    turned(b, -0.3, 0.9, 0.26, 0.5, 0.36, 0.5, 1.2, LEAF_DARK);
  } else {
    b.addAABox(0, 0.66, 0, 0.1, 1.32, 0.1, BARK);
    turned(b, 0, 1.2, 0, 1.15, 0.3, 1.0, 0.3, LEAF_DARK);
    turned(b, 0.06, 1.43, -0.04, 0.72, 0.28, 0.66, 1.0, LEAF);
    turned(b, 0, 1.62, 0, 0.36, 0.2, 0.36, 0.6, LEAF_LIGHT);
  }
}

export function buildForestTreeGeometry(
  stage: ForestStage,
  variant: ForestVariant,
): BufferGeometry {
  const b = new BoxBuilder();
  if (stage === 'seedling') sapling(b, variant);
  else if (stage === 'immature') youngTree(b, variant);
  else matureTree(b, variant);
  return b.build();
}
