/**
 * What a landslide leaves on a hectare: heaps of spoil, and the branches that
 * came down the slope with it, snapped off and driven into the mud.
 */

import { Palette } from '../../materials/paletteSlots.ts';
import { between, type Model } from '../kit.ts';

/** A heap of earth and stones, wider than it is tall. */
export const spoilHeap: Model = {
  name: 'spoil heap',
  // A 2.6-wide heap turned on the diagonal reaches its own half-diagonal.
  radius: 1.9,
  build(kit, rand) {
    const width = between(rand, 1.6, 2.6);
    const height = between(rand, 0.35, 0.7);
    kit.box(0, height / 2, 0, width, height, width * between(rand, 0.7, 1), Palette.Dirt, {
      top: Palette.Laterite,
      turn: rand() * Math.PI,
    });
    // A second, smaller heap leaning on the first: one box reads as a crate.
    kit.box(
      between(rand, -0.6, 0.6),
      height * 0.75,
      between(rand, -0.6, 0.6),
      width * 0.55,
      height * 0.8,
      width * 0.5,
      Palette.Dirt,
      { top: Palette.Laterite, turn: rand() * Math.PI },
    );
    // Stones the slide turned up.
    const stones = Math.floor(between(rand, 1, 4));
    for (let i = 0; i < stones; i++) {
      const s = between(rand, 0.18, 0.34);
      kit.box(
        between(rand, -width * 0.5, width * 0.5),
        s / 2,
        between(rand, -width * 0.5, width * 0.5),
        s,
        s * 0.8,
        s,
        rand() < 0.5 ? Palette.Rock : Palette.RockDark,
        { turn: rand() * Math.PI },
      );
    }
  },
};

/** A branch snapped off in the slide, half buried and sticking up out of it. */
export const snappedBranch: Model = {
  name: 'snapped branch',
  radius: 1.2,
  build(kit, rand) {
    const length = between(rand, 1.2, 2.2);
    const tilt = between(rand, 0.5, 1.1) * (rand() < 0.5 ? -1 : 1);
    kit.box(0, length * 0.38, 0, 0.16, length, 0.16, Palette.Log, {
      tiltZ: tilt,
      turn: rand() * Math.PI,
      bottom: true,
    });
    // A fork part way up, so it reads as a branch rather than a post.
    if (rand() < 0.75) {
      kit.box(
        Math.sin(tilt) * length * 0.35,
        length * 0.6,
        0,
        0.11,
        length * 0.45,
        0.11,
        Palette.Bark,
        { tiltZ: tilt + between(rand, 0.5, 0.9), turn: rand() * Math.PI, bottom: true },
      );
    }
    // The mud it is driven into.
    kit.box(0, 0.08, 0, between(rand, 0.5, 0.8), 0.16, between(rand, 0.5, 0.8), Palette.Dirt, {
      top: Palette.Dirt,
      turn: rand() * Math.PI,
    });
  },
};
