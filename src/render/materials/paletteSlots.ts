/**
 * Palette slot indices (§6.4).
 *
 * Kept free of Three.js so the mesher worker and the chunk field builder can
 * import it without pulling the renderer into the worker bundle. The colours
 * for each slot, and the texture that carries them, live in `palette.ts`.
 */

export const PALETTE_WIDTH = 256;

/** Slot indices. The value is the column in the palette texture. */
export const Palette = {
  PalmFrond: 0,
  PalmFrondYoung: 1,
  PalmFrondSenile: 2,
  PalmTrunk: 3,
  PalmBunch: 4,

  Grass: 8,
  Forest: 9,
  ForestDark: 10,
  Terrace: 11,
  Scrub: 12,
  Peat: 13,

  Laterite: 16,
  Dirt: 17,
  Rock: 18,
  Sand: 19,
  Charcoal: 20,

  Water: 24,
  WaterShallow: 25,

  Debris: 32,
  Stump: 33,

  KopdesWall: 40,
  KopdesRoof: 41,
  KopdesFlag: 42,
} as const;

export type PaletteSlot = (typeof Palette)[keyof typeof Palette];

/** UV coordinate for a slot, at the centre of its texel. */
export function paletteU(slot: PaletteSlot | number): number {
  return (slot + 0.5) / PALETTE_WIDTH;
}
