/** What a wildfire leaves standing: a charred snag, snapped short, one stub of a branch. */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const burntTree: Model = {
  name: 'burnt tree',
  radius: 0.8,
  build(kit, rand) {
    const trunk = between(rand, 0.9, 2.4);
    kit.box(0, 0, 0, 0.3, trunk, 0.3, Palette.Charcoal, { tiltX: between(rand, -0.12, 0.12) });
    kit.box(0, trunk - 0.05, 0, 0.2, 0.25, 0.2, Palette.Ash, { tiltZ: 0.3 });
    if (rand() < 0.6) {
      kit.box(0.25, trunk * 0.6, 0, 0.1, 0.5, 0.1, Palette.Charcoal, { tiltZ: 1, bottom: true });
    }
  },
};
