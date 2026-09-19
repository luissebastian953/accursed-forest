import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const fallenLog: Model = {
  name: 'fallen log',
  radius: 1.6,
  build(kit, rand) {
    const length = between(rand, 2, 3);

    // Lying down: a box as long as the log, tipped over onto the ground.
    kit.box(0, 0.21 - length / 2, 0, 0.42, length, 0.42, Palette.Log, {
      tiltX: Math.PI / 2 - 0.05,
      bottom: true,
    });
    if (rand() < 0.5) kit.box(0.25, 0.25, length * 0.2, 0.25, 0.08, 0.3, Palette.Sand);
    if (rand() < 0.4) kit.box(0, 0.35, -length * 0.3, 0.4, 0.2, 0.4, Palette.Vine);
  },
};
