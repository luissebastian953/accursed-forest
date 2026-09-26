import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

/** A grave mound: a low heap of turned earth, most with a stone or a stake at the head. */
export const graveMound: Model = {
  name: 'grave mound',
  // A 1.6-wide mound on the diagonal, plus a stake leaning past its end.
  radius: 1.25,
  build(kit, rand) {
    const width = between(rand, 1.1, 1.6);
    const depth = between(rand, 0.7, 0.95);
    const height = between(rand, 0.22, 0.32);
    const turn = between(rand, -0.25, 0.25);

    // Two boxes, the upper one narrower: a heap, not a slab.
    kit.box(0, 0, 0, width, height, depth, Palette.GraveEarth, { top: Palette.GraveEarth, turn });
    kit.box(0, height, 0, width * 0.7, height * 0.7, depth * 0.62, Palette.GraveEarth, {
      top: Palette.Dirt,
      turn,
    });

    const marker = rand();

    if (marker < 0.4) {
      // A headstone: a thin upright slab, a little askew, at the head of the mound.
      kit.box(
        -width * 0.42,
        0,
        0,
        0.14,
        between(rand, 0.55, 0.85),
        between(rand, 0.34, 0.5),
        Palette.RockDark,
        { turn, tiltZ: between(rand, -0.12, 0.12) },
      );
    } else if (marker < 0.75) {
      // A wooden stake, weathered grey and leaning.
      kit.box(-width * 0.4, 0, 0, 0.1, between(rand, 0.8, 1.1), 0.1, Palette.DeadWood, {
        turn,
        tiltZ: between(rand, -0.22, 0.22),
        bottom: true,
      });
    }

    // Now and then the earth has not kept everything under it.
    if (rand() < 0.3) {
      kit.box(
        between(rand, -0.3, 0.3),
        height * 1.7,
        between(rand, -0.2, 0.2),
        between(rand, 0.35, 0.55),
        0.08,
        0.1,
        Palette.Bone,
        { turn: rand() * Math.PI },
      );
    }
  },
};
