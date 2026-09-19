import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const pineTree: Model = {
  name: 'pine tree',
  radius: 1.7,
  build(kit, rand) {
    const trunk = between(rand, 0.6, 0.9);

    kit.box(0, 0, 0, 0.22, trunk + 0.6, 0.22, Palette.Bark);

    const tiers = 4 + Math.floor(rand() * 2);
    let width = between(rand, 1.9, 2.3);
    let y = trunk;
    const dark = rand() < 0.5;

    for (let i = 0; i < tiers; i++) {
      kit.box(
        0,
        y,
        0,
        width,
        0.7,
        width,
        (i % 2 === 0) === dark ? Palette.PineDark : Palette.Pine,
        {
          turn: i * 0.35,
        },
      );
      y += 0.55;
      width *= 0.74;
    }

    kit.box(0, y, 0, 0.18, 0.5, 0.18, Palette.PineDark);
  },
};
