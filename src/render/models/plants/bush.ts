import { Palette } from '../../materials/paletteSlots.ts';
import { between, oneOf, type Model } from '../kit.ts';

const LEAF = [Palette.Bush, Palette.Bush, Palette.ScrubDark, Palette.CanopyLight] as const;
export const BLOOMS = [
  Palette.FlowerRed,
  Palette.FlowerYellow,
  Palette.FlowerWhite,
  Palette.FlowerPink,
] as const;

export const bush: Model = {
  name: 'bush',
  radius: 1,
  build(kit, rand) {
    const width = between(rand, 0.9, 1.5);
    const height = between(rand, 0.55, 0.95);
    const leaf = oneOf(rand, LEAF);
    kit.box(0, 0, 0, width, height, width * 0.85, leaf, { turn: rand() });
    kit.box(
      between(rand, -0.2, 0.2),
      height * 0.6,
      0,
      width * 0.6,
      height * 0.6,
      width * 0.55,
      leaf,
      {
        turn: rand(),
      },
    );
  },
};

export const floweringBush: Model = {
  name: 'flowering bush',
  radius: 1,
  build(kit, rand) {
    const width = between(rand, 1, 1.4);
    const height = between(rand, 0.6, 0.9);
    kit.box(0, 0, 0, width, height, width * 0.9, Palette.Bush, { turn: rand() });
    const bloom = oneOf(rand, BLOOMS);
    for (let i = 0; i < 6; i++) {
      kit.box(
        between(rand, -width * 0.4, width * 0.4),
        height - 0.05,
        between(rand, -width * 0.35, width * 0.35),
        0.18,
        0.18,
        0.18,
        bloom,
      );
    }
  },
};
