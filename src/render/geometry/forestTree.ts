import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';

import { Palette } from '../materials/paletteSlots.ts';
import { MODELS } from '../models/index.ts';
import { ModelKit, type Model } from '../models/kit.ts';

import { BoxBuilder, type BoxFaces } from './boxBuilder.ts';

export type ForestForm = 'sapling' | 'shrub' | 'tree';
/** Two draws of the small forms, so neighbours are not identical. */
export type ForestVariant = 'a' | 'b';

/** What grows back, from the wild forest's own models. */
export type ForestSpecies = 'rainforest' | 'fig' | 'willow' | 'pine' | 'giant';

export const FOREST_VARIANTS: readonly ForestVariant[] = ['a', 'b'];
export const FOREST_SPECIES: readonly ForestSpecies[] = [
  'rainforest',
  'fig',
  'willow',
  'pine',
  'giant',
];

/**
 * How often each species comes up, and the scale that brings it into one
 * size class: a giant tree is four times a slot wide at its natural size.
 */
export const SPECIES_DRAW: Record<ForestSpecies, { weight: number; model: Model; scale: number }> =
  {
    rainforest: { weight: 0.42, model: MODELS.rainforestTree, scale: 1 },
    fig: { weight: 0.16, model: MODELS.weepingFig, scale: 0.8 },
    willow: { weight: 0.16, model: MODELS.willowTree, scale: 0.95 },
    pine: { weight: 0.16, model: MODELS.pineTree, scale: 1.05 },
    giant: { weight: 0.1, model: MODELS.giantTree, scale: 0.7 },
  };

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

const LEAF_LIGHT: BoxFaces = { side: Palette.CanopyLight, top: Palette.ForestLight };
const BARK: BoxFaces = { side: Palette.Bark };

/** The crews' handiwork: a stem on a stake, in a ring of mulch. */
function sapling(b: BoxBuilder, variant: ForestVariant): void {
  b.addAABox(0, 0.012, 0, 0.28, 0.024, 0.28, { side: Palette.Dirt });
  b.addAABox(0.08, 0.2, 0.02, 0.024, 0.4, 0.024, { side: Palette.HouseWood });
  b.addAABox(0.045, 0.22, 0.01, 0.08, 0.022, 0.034, { side: Palette.Sand });
  b.addAABox(0, 0.15, 0, 0.024, 0.3, 0.024, BARK);

  if (variant === 'a') {
    b.addAABox(0, 0.33, 0, 0.16, 0.12, 0.16, LEAF_LIGHT);
    turned(b, -0.07, 0.25, 0.05, 0.11, 0.08, 0.11, 0.6, LEAF_LIGHT);
    turned(b, 0.06, 0.28, -0.06, 0.1, 0.08, 0.1, 0.3, LEAF_LIGHT);
  } else {
    turned(b, 0, 0.22, 0, 0.22, 0.05, 0.22, 0.4, LEAF_LIGHT);
    turned(b, 0, 0.3, 0, 0.15, 0.05, 0.15, 0.9, LEAF_LIGHT);
    b.addAABox(0, 0.37, 0, 0.07, 0.07, 0.07, LEAF_LIGHT);
  }
}

/** One fixed draw of a scenery model, as instanced geometry. */
function modelGeometry(model: Model, seed: number, scale: number): BufferGeometry {
  const b = new BoxBuilder();
  // A small LCG: the models want a 0..1 source, and this one never changes.
  let state = seed * 2654435761 + 1;
  const rand = (): number => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x80000000;
  };
  const kit = new ModelKit(b).at({ x: 0, y: 0, z: 0, scale, turn: 0 });

  model.build(kit, rand);
  return b.build();
}

export function buildSaplingGeometry(variant: ForestVariant): BufferGeometry {
  const b = new BoxBuilder();

  sapling(b, variant);
  return b.build();
}

export function buildShrubGeometry(variant: ForestVariant): BufferGeometry {
  return modelGeometry(variant === 'a' ? MODELS.bush : MODELS.floweringBush, 3, 0.8);
}

export function buildForestTreeGeometry(species: ForestSpecies): BufferGeometry {
  const draw = SPECIES_DRAW[species];

  return modelGeometry(draw.model, 7, draw.scale);
}
