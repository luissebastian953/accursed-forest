/** Willow by the water: a leaning trunk, a rounded crown, and curtains of strands hanging to the bank. */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const willowTree: Model = {
  name: 'willow',
  radius: 2.3,
  build(kit, rand) {
    const trunk = between(rand, 1.3, 1.8);
    const lean = between(rand, -0.15, 0.15);
    kit.box(0, 0, 0, 0.3, trunk, 0.3, Palette.Bark, { tiltZ: lean });
    const top = lean * -trunk * 0.5;
    const crown = between(rand, 2.4, 3);
    kit.box(top, trunk * 0.9, 0, crown, 1, crown, Palette.Willow, { turn: rand() });
    kit.box(top, trunk * 0.9 + 0.8, 0, crown * 0.6, 0.6, crown * 0.6, Palette.Willow);
    const strands = 12;
    for (let i = 0; i < strands; i++) {
      const a = (i / strands) * Math.PI * 2 + rand() * 0.3;
      const r = crown * 0.47;
      const length = between(rand, 1, trunk * 0.95);
      kit.box(
        top + Math.cos(a) * r,
        trunk * 0.9 - length,
        Math.sin(a) * r,
        0.14,
        length,
        0.14,
        Palette.Willow,
        {
          bottom: true,
        },
      );
    }
  },
};
