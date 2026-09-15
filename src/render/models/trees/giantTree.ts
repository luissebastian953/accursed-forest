/**
 * Emergent giant: a tree that stands over the canopy, with buttress roots
 * flaring at its foot, a crown of broad layers, and vines hanging from it.
 */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';
import { hangVines } from '../plants/vines.ts';

export const giantTree: Model = {
  name: 'giant tree',
  radius: 4,
  build(kit, rand) {
    const trunk = between(rand, 3.8, 5);
    kit.box(0, 0, 0, 0.6, trunk, 0.6, Palette.Bark);
    // Buttresses: four flat fins leaning into the trunk.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand() * 0.4;
      kit.box(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 0.14, 1.1, 0.9, Palette.Bark, {
        turn: -a,
        tiltZ: 0,
      });
    }
    const crown = trunk * 0.85;
    const width = between(rand, 4.6, 5.8);
    kit.box(0, crown, 0, width, 1.1, width * 0.9, Palette.CanopyDark, { turn: rand() });
    kit.box(0.3, crown + 0.9, -0.2, width * 0.65, 1, width * 0.6, Palette.Canopy, { turn: rand() });
    kit.box(-0.2, crown + 1.7, 0.2, width * 0.35, 0.7, width * 0.35, Palette.CanopyLight);
    hangVines(kit, rand, crown, width * 0.42, 5);
  },
};
