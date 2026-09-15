/** A dead tree: bleached, leafless, a couple of bare branches. */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const deadTree: Model = {
  name: 'dead tree',
  radius: 1,
  build(kit, rand) {
    const trunk = between(rand, 1.6, 2.4);
    kit.box(0, 0, 0, 0.26, trunk, 0.26, Palette.DeadWood, { tiltX: between(rand, -0.08, 0.08) });
    const branches = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < branches; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const y = trunk * between(rand, 0.45, 0.85);
      const length = between(rand, 0.6, 1);
      kit.box(side * 0.3, y, between(rand, -0.2, 0.2), 0.12, length, 0.12, Palette.DeadWood, {
        turn: rand() * Math.PI,
        tiltZ: side * 0.9,
        bottom: true,
      });
    }
  },
};
