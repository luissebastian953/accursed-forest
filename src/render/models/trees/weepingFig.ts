/**
 * Weeping fig (beringin): a short, massive trunk under a wide dome, with
 * aerial roots dropping from the crown to the ground — the village tree.
 */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const weepingFig: Model = {
  name: 'weeping fig',
  radius: 3.8,
  build(kit, rand) {
    const trunk = between(rand, 1.4, 1.8);
    kit.box(0, 0, 0, 0.8, trunk + 0.4, 0.8, Palette.Bark);
    const width = between(rand, 4.6, 5.4);
    kit.box(0, trunk, 0, width, 1.2, width * 0.9, Palette.CanopyDark, { turn: rand() });
    kit.box(0, trunk + 1, 0, width * 0.72, 1, width * 0.68, Palette.Canopy, { turn: rand() });
    kit.box(0, trunk + 1.8, 0, width * 0.4, 0.6, width * 0.4, Palette.Canopy);
    const roots = 10;
    for (let i = 0; i < roots; i++) {
      const a = rand() * Math.PI * 2;
      const r = between(rand, 0.7, width * 0.4);
      kit.box(Math.cos(a) * r, 0, Math.sin(a) * r, 0.09, trunk, 0.09, Palette.Bark);
    }
  },
};
