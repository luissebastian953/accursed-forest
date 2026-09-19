import { describe, expect, it } from 'vitest';

import { PALETTE_WIDTH, Palette, createPaletteTexture, paletteU } from '@render/materials/palette';

/**
 * The palette strip is 256x2: wet colours on row 0, dry on row 1, and the alpha
 * channel of both is how much light a slot gives off rather than opacity. The
 * material turns that into an emissive term, so a slot with alpha is a slot
 * that glows.
 */

function slotBytes(data: Uint8Array, slot: number, row: 0 | 1): number[] {
  const at = (row * PALETTE_WIDTH + slot) * 4;

  return [data[at]!, data[at + 1]!, data[at + 2]!, data[at + 3]!];
}

describe('the palette strip', () => {
  const texture = createPaletteTexture();
  const data = texture.image.data as Uint8Array;

  it('is two rows of 256 slots', () => {
    expect(texture.image.width).toBe(PALETTE_WIDTH);
    expect(texture.image.height).toBe(2);
    expect(data.length).toBe(PALETTE_WIDTH * 2 * 4);
  });

  it('samples a slot at the centre of its texel', () => {
    expect(paletteU(0)).toBeCloseTo(0.5 / PALETTE_WIDTH, 9);
    expect(paletteU(Palette.Coin)).toBeCloseTo((Palette.Coin + 0.5) / PALETTE_WIDTH, 9);
  });

  it('lights the gold, and nothing else', () => {
    const glowing = [Palette.Coin, Palette.Sparkle, Palette.FurCapybaraGold];

    for (const slot of glowing) {
      for (const row of [0, 1] as const) {
        expect(slotBytes(data, slot, row)[3]).toBeGreaterThan(0);
      }
    }

    // Everything else is unlit: land that glowed would bloom in daylight.
    const dark = [Palette.Grass, Palette.PalmFrond, Palette.River, Palette.Cloud, Palette.ApeGrey];

    for (const slot of dark) {
      expect(slotBytes(data, slot, 0)[3]).toBe(0);
      expect(slotBytes(data, slot, 1)[3]).toBe(0);
    }
  });

  it('gives the gold a yellow that keeps its blue low', () => {
    // A washed-out gold is one whose blue has crept up: it reads as cream.
    for (const slot of [Palette.Coin, Palette.FurCapybaraGold]) {
      const [r, g, b] = slotBytes(data, slot, 0) as [number, number, number, number];

      expect(r).toBeGreaterThan(200);
      expect(g).toBeGreaterThan(80);
      expect(g).toBeLessThan(r);
      expect(b).toBeLessThan(40);
    }
  });

  texture.dispose();
});
