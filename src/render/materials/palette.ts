/**
 * The palette strip (§6.4).
 *
 * Every vertex in the world carries a `paletteU` attribute instead of a UV.
 * The palette is a 256x2 texture: row 0 is the wet-season colour for each slot,
 * row 1 is the dry-season colour. A single `season` uniform lerps between them,
 * and an event tint uniform (haze amber-grey, ash grey) is mixed on top, so the
 * whole world shifts mood with two floats.
 *
 * Colours are the real-place set from §6.1: saturated sawit green, yellow-green
 * young fronds, laterite red-orange soil, dark peat brown, ochre grassfield.
 */

import {
  DataTexture,
  LinearSRGBColorSpace,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three/webgpu';

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

type Hex = number;

/** [wet, dry] colour pair per slot. Wet deepens greens and darkens soil; dry pulls to ochre. */
const COLOURS: Partial<Record<number, [Hex, Hex]>> = {
  [Palette.PalmFrond]: [0x2f7a2b, 0x5d8a33],
  [Palette.PalmFrondYoung]: [0x7fb03a, 0x9cb54a],
  [Palette.PalmFrondSenile]: [0x4a6b2a, 0x7a7c3c],
  [Palette.PalmTrunk]: [0x5a4632, 0x6f5a41],
  [Palette.PalmBunch]: [0xd4562a, 0xe06a2f],

  [Palette.Grass]: [0x7f9a3c, 0xa89a46],
  [Palette.Forest]: [0x245c26, 0x3d6b2c],
  [Palette.ForestDark]: [0x163f1c, 0x2a4d21],
  [Palette.Terrace]: [0x6b8f3a, 0x8d9243],
  [Palette.Scrub]: [0xb8a874, 0xcdb883],
  [Palette.Peat]: [0x2b2118, 0x3a2d20],

  [Palette.Laterite]: [0x9c4a24, 0xc2612e],
  [Palette.Dirt]: [0x6b4a30, 0x8a6340],
  [Palette.Rock]: [0x7d7a72, 0x928f86],
  [Palette.Sand]: [0xcfc09a, 0xe0d3ab],
  [Palette.Charcoal]: [0x241f1c, 0x2e2825],

  [Palette.Water]: [0x2f6f9c, 0x3d7ea8],
  [Palette.WaterShallow]: [0x4a95b5, 0x59a3bf],

  [Palette.Debris]: [0x6a5540, 0x82694e],
  [Palette.Stump]: [0x4b3a29, 0x5d4a35],

  [Palette.KopdesWall]: [0xd9cbb0, 0xe6dabf],
  [Palette.KopdesRoof]: [0x8c3f2e, 0xa04c37],
  [Palette.KopdesFlag]: [0xc23b2e, 0xd14738],
};

const FALLBACK: [Hex, Hex] = [0xff00ff, 0xff00ff];

function writeHex(data: Uint8Array, offset: number, hex: Hex): void {
  data[offset] = (hex >> 16) & 0xff;
  data[offset + 1] = (hex >> 8) & 0xff;
  data[offset + 2] = hex & 0xff;
  data[offset + 3] = 255;
}

/**
 * Build the 256x2 palette texture. Row 0 = wet, row 1 = dry.
 * Nearest filtering: slots must never bleed into each other.
 */
export function createPaletteTexture(): DataTexture {
  const data = new Uint8Array(PALETTE_WIDTH * 2 * 4);

  for (let i = 0; i < PALETTE_WIDTH; i++) {
    const [wet, dry] = COLOURS[i] ?? FALLBACK;
    writeHex(data, i * 4, wet);
    writeHex(data, (PALETTE_WIDTH + i) * 4, dry);
  }

  const texture = new DataTexture(data, PALETTE_WIDTH, 2, RGBAFormat, UnsignedByteType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
