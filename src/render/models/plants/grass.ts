import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const grassTuft: Model = {
  name: 'grass tuft',
  radius: 0.4,
  build(kit, rand) {
    const slot = rand() < 0.5 ? Palette.GrassLight : Palette.Reed;
    kit.box(0, 0, 0, 0.45, between(rand, 0.3, 0.55), 0.4, slot, { turn: rand() });
  },
};

export const reeds: Model = {
  name: 'reeds',
  radius: 0.55,
  build(kit, rand) {
    for (let i = 0; i < 3; i++) {
      kit.box(
        between(rand, -0.3, 0.3),
        0,
        between(rand, -0.3, 0.3),
        0.1,
        between(rand, 0.8, 1.6),
        0.1,
        Palette.Reed,
        {
          tiltZ: between(rand, -0.12, 0.12),
        },
      );
    }
  },
};
