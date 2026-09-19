import { Palette } from '../../materials/paletteSlots.ts';
import { between, type ModelKit, type Rand } from '../kit.ts';

export function hangVines(
  kit: ModelKit,
  rand: Rand,
  from: number,
  radius: number,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const length = between(rand, from * 0.35, from * 0.75);
    kit.box(
      Math.cos(a) * radius,
      from - length,
      Math.sin(a) * radius,
      0.08,
      length,
      0.08,
      Palette.Vine,
      {
        bottom: true,
      },
    );
    // A leafy knot partway down.
    kit.box(
      Math.cos(a) * radius,
      from - length * 0.5,
      Math.sin(a) * radius,
      0.22,
      0.22,
      0.22,
      Palette.Vine,
      {
        bottom: true,
      },
    );
  }
}
