import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

export const cactus: Model = {
  name: 'cactus',
  radius: 0.8,
  build(kit, rand) {
    const height = between(rand, 1.2, 2);

    kit.box(0, 0, 0, 0.36, height, 0.36, Palette.Cactus);

    for (const side of [1, -1]) {
      if (rand() < 0.3) continue;

      const y = height * between(rand, 0.3, 0.6);

      kit.box(side * 0.35, y, 0, 0.4, 0.22, 0.22, Palette.Cactus);
      kit.box(side * 0.5, y, 0, 0.24, between(rand, 0.5, 0.8), 0.24, Palette.Cactus);
    }
  },
};

export const tumbleweed: Model = {
  name: 'tumbleweed',
  radius: 0.7,
  build(kit, rand) {
    const size = between(rand, 0.55, 0.85);

    // Three cubes turned against each other read as a ball of twigs.
    kit.box(0, 0, 0, size, size, size, Palette.Tumbleweed, { turn: rand(), bottom: true });
    kit.box(0, 0.02, 0, size * 0.9, size * 0.9, size * 0.9, Palette.Tumbleweed, {
      turn: rand(),
      tiltX: 0.6,
      tiltZ: 0.4,
      bottom: true,
    });
    kit.box(0, 0.04, 0, size * 0.8, size * 0.8, size * 0.8, Palette.DeadWood, {
      tiltX: -0.5,
      tiltZ: 0.8,
      bottom: true,
    });
  },
};
