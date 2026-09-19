import { Palette } from '../../materials/paletteSlots.ts';
import { between, oneOf, type Model } from '../kit.ts';

import { BLOOMS } from './bush.ts';

export const flowers: Model = {
  name: 'flowers',
  radius: 0.8,
  build(kit, rand) {
    const bloom = oneOf(rand, BLOOMS);
    const stems = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < stems; i++) {
      const x = between(rand, -0.45, 0.45);
      const z = between(rand, -0.45, 0.45);
      const h = between(rand, 0.25, 0.5);
      kit.box(x, 0, z, 0.05, h, 0.05, Palette.Reed);
      kit.box(x, h, z, 0.17, 0.12, 0.17, rand() < 0.8 ? bloom : Palette.FlowerWhite);
    }
  },
};
