/**
 * Lowland rainforest tree: a tall, bare trunk carrying flat umbrella layers
 * of canopy — the dipterocarp silhouette of a Kalimantan forest.
 */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, oneOf, type Model } from '../kit.ts';

const LEAVES = [Palette.Canopy, Palette.Canopy, Palette.CanopyLight, Palette.CanopyDark] as const;

export const rainforestTree: Model = {
  name: 'rainforest tree',
  radius: 2.6,
  build(kit, rand) {
    const trunk = between(rand, 1.6, 2.6);
    const leaves = oneOf(rand, LEAVES);
    kit.box(0, 0, 0, 0.32, trunk, 0.32, Palette.Bark);
    const layers = 1 + Math.floor(rand() * 3);
    let y = trunk * 0.8;
    let width = between(rand, 2.4, 3.2);
    for (let i = 0; i < layers; i++) {
      const height = between(rand, 0.7, 1.1);
      const dx = between(rand, -0.35, 0.35);
      const dz = between(rand, -0.35, 0.35);
      kit.box(dx, y, dz, width, height, width * between(rand, 0.8, 1), leaves, { turn: rand() });
      y += height * 0.75;
      width *= between(rand, 0.6, 0.75);
    }
  },
};
