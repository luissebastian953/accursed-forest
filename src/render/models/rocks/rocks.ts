import { Palette } from '../../materials/paletteSlots.ts';
import { between, oneOf, type Model } from '../kit.ts';

const STONE = [Palette.Rock, Palette.RockDark] as const;

export const boulders: Model = {
  name: 'boulders',
  radius: 1.4,
  build(kit, rand) {
    const count = 1 + Math.floor(rand() * 3);

    for (let i = 0; i < count; i++) {
      const size = between(rand, 0.5, 1.2) * (i === 0 ? 1 : 0.6);

      kit.box(
        between(rand, -0.5, 0.5),
        -0.1,
        between(rand, -0.5, 0.5),
        size,
        size * between(rand, 0.6, 1),
        size * 0.9,
        oneOf(rand, STONE),
        {
          turn: rand(),
          tiltX: between(rand, -0.2, 0.2),
        },
      );
    }
  },
};

export const rockSpire: Model = {
  name: 'rock spire',
  radius: 1.8,
  build(kit, rand) {
    const tiers = 3 + Math.floor(rand() * 3);
    let width = between(rand, 1.8, 2.4);
    let y = -0.2;

    for (let i = 0; i < tiers; i++) {
      const height = between(rand, 0.9, 1.5);

      kit.box(
        between(rand, -0.15, 0.15),
        y,
        between(rand, -0.15, 0.15),
        width,
        height,
        width * 0.85,
        i % 2 === 0 ? Palette.Rock : Palette.RockDark,
        {
          turn: rand() * 0.5,
        },
      );
      y += height * 0.9;
      width *= 0.72;
    }
  },
};

export const cave: Model = {
  name: 'cave',
  radius: 2.2,
  build(kit, rand) {
    const width = between(rand, 2.6, 3.2);

    kit.box(0, -0.1, 0, width, 1.8, width * 0.8, Palette.Rock);
    kit.box(0.2, 1.5, -0.2, width * 0.65, 1, width * 0.55, Palette.RockDark, { turn: 0.2 });
    // The mouth: a dark recess on the front face under a lintel of stone.
    kit.box(0, 0, width * 0.4, 1, 1.1, 0.12, Palette.Cave);
    kit.box(0, 1.1, width * 0.41, 1.4, 0.3, 0.2, Palette.RockDark);
    kit.box(0.9, 0, width * 0.45, 0.5, 0.4, 0.4, Palette.Rock, { turn: 0.5 });
  },
};
