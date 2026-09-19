import {
  DataTexture,
  LinearSRGBColorSpace,
  NearestFilter,
  RGBAFormat,
  UnsignedByteType,
} from 'three';

import { PALETTE_WIDTH, Palette } from './paletteSlots.ts';

export { PALETTE_WIDTH, Palette, paletteU, type PaletteSlot } from './paletteSlots.ts';

type Hex = number;

/** [wet, dry] colour pair per slot. Wet deepens greens and darkens soil; dry pulls to ochre. */
const COLOURS: Partial<Record<number, [Hex, Hex]>> = {
  [Palette.PalmFrond]: [0x2f7a2b, 0x5d8a33],
  [Palette.PalmFrondYoung]: [0x7fb03a, 0x9cb54a],
  [Palette.PalmFrondSenile]: [0x4a6b2a, 0x7a7c3c],
  [Palette.PalmTrunk]: [0x5a4632, 0x6f5a41],
  [Palette.PalmBunch]: [0xd4562a, 0xe06a2f],
  [Palette.GrassLight]: [0x93ad4a, 0xb9a954],
  [Palette.ForestLight]: [0x2f6a2c, 0x4a7632],
  [Palette.ScrubDark]: [0xa3945f, 0xb9a46e],

  [Palette.Grass]: [0x7f9a3c, 0xa89a46],
  [Palette.Forest]: [0x245c26, 0x3d6b2c],
  [Palette.ForestDark]: [0x163f1c, 0x2a4d21],
  [Palette.Terrace]: [0x6b8f3a, 0x8d9243],
  [Palette.Scrub]: [0xb8a874, 0xcdb883],
  [Palette.Peat]: [0x2b2118, 0x3a2d20],
  [Palette.Bank]: [0x8a7a55, 0xa8946a],
  [Palette.Reed]: [0x6f9a3a, 0x9da34a],

  [Palette.Laterite]: [0x9c4a24, 0xc2612e],
  [Palette.Dirt]: [0x6b4a30, 0x8a6340],
  [Palette.Rock]: [0x7d7a72, 0x928f86],
  [Palette.Sand]: [0xcfc09a, 0xe0d3ab],
  [Palette.Charcoal]: [0x241f1c, 0x2e2825],
  [Palette.Fire]: [0xff7a1f, 0xff8f2a],
  [Palette.Ash]: [0xb8b3aa, 0xc9c4ba],
  [Palette.Smoke]: [0x6e6a66, 0x7a766f],

  [Palette.Water]: [0x2f6f9c, 0x3d7ea8],
  [Palette.WaterShallow]: [0x4a95b5, 0x59a3bf],
  [Palette.RockDark]: [0x5f5c56, 0x74716a],
  [Palette.Bush]: [0x557a2c, 0x7d8a3a],
  [Palette.Canopy]: [0x2d6e2a, 0x467a30],
  [Palette.CanopyLight]: [0x4a8a34, 0x6a9340],
  [Palette.CanopyDark]: [0x1c4d22, 0x2f5a27],
  [Palette.Bark]: [0x4a3a2a, 0x5c4a36],

  [Palette.Debris]: [0x6a5540, 0x82694e],
  [Palette.Stump]: [0x4b3a29, 0x5d4a35],
  [Palette.Log]: [0x6b5138, 0x7d6143],
  [Palette.DeadWood]: [0x8a8175, 0x9c9285],
  [Palette.Vine]: [0x3f7a2e, 0x5a8034],
  [Palette.Pine]: [0x2a5a3a, 0x3c6440],
  [Palette.PineDark]: [0x1d4530, 0x2c5034],
  [Palette.Willow]: [0x6f9e45, 0x8ea24f],

  [Palette.KopdesWall]: [0xd9cbb0, 0xe6dabf],
  [Palette.KopdesRoof]: [0x8c3f2e, 0xa04c37],
  [Palette.KopdesFlag]: [0xc23b2e, 0xd14738],
  [Palette.KopdesRoofLight]: [0xb35a42, 0xc9694c],
  [Palette.KopdesTrim]: [0x3f8f45, 0x4fa353],
  [Palette.KopdesGlass]: [0x3d4a52, 0x4c5a63],

  [Palette.HouseWall]: [0xd8c9a6, 0xe4d6b4],
  [Palette.HouseWood]: [0x8a6440, 0x9c734b],
  [Palette.HouseRoof]: [0xa44a2c, 0xb85634],
  [Palette.Thatch]: [0x9c8a55, 0xb39d62],
  [Palette.Cave]: [0x1a1714, 0x221e1a],
  [Palette.Cactus]: [0x4f8a4a, 0x68924f],
  [Palette.Tumbleweed]: [0xa88d5a, 0xbfa067],
  [Palette.FlowerRed]: [0xd8403a, 0xe0503f],
  [Palette.FlowerYellow]: [0xf0c93a, 0xf4d24a],
  [Palette.FlowerWhite]: [0xf2eee4, 0xf6f2e8],
  [Palette.FlowerPink]: [0xe486b0, 0xea94b8],
  [Palette.Rain]: [0xbcd6e6, 0xc8dde8],
  [Palette.CharredGround]: [0x3a322b, 0x463c33],

  [Palette.FurDark]: [0x3b342c, 0x4a4136],
  [Palette.FurBoar]: [0x4f4237, 0x615345],
  [Palette.FurPig]: [0xe0a99a, 0xe8b6a7],
  [Palette.FurCow]: [0xefe6d8, 0xf4ece1],
  [Palette.FurCowSpot]: [0x0d0c0b, 0x14120f],
  [Palette.FurMouse]: [0x8d8378, 0x9c9287],
  [Palette.FurMonkey]: [0x6b5138, 0x7d6143],
  [Palette.FurOrangutan]: [0xb5562a, 0xc46836],
  [Palette.FurCapybara]: [0xa8794a, 0xb98a58],
  [Palette.Skin]: [0xc98f63, 0xd69c70],
  [Palette.ClothThief]: [0x2f3640, 0x3b434f],
  [Palette.ClothWorker]: [0x4a6b8a, 0x587c9c],
  [Palette.ClothDoctor]: [0xf2f2ee, 0xf8f8f4],
  [Palette.ClothSecurity]: [0x2b3550, 0x36415f],
  [Palette.HiVis]: [0xf0c93a, 0xf4d24a],
  [Palette.Steel]: [0x9aa3ab, 0xaab3ba],
  [Palette.Ghost]: [0xdcecf5, 0xe8f3fa],
  [Palette.Snout]: [0xd9a58f, 0xe2b29c],
  [Palette.Hoof]: [0x33302c, 0x413d38],
  [Palette.Sack]: [0xa8925f, 0xb9a26c],

  // A clear, bright light blue that holds up under rain light, with deeper pools.
  [Palette.River]: [0x5ec3f2, 0x6ccaf4],
  [Palette.RiverDeep]: [0x3a97da, 0x45a1e0],

  [Palette.FurPangolin]: [0x9c7a4a, 0xb08a55],
  [Palette.FurPangolinDark]: [0x6f5432, 0x7f613b],
  [Palette.FurCapybaraGold]: [0xf59a06, 0xffab12],
  [Palette.Coin]: [0xffa008, 0xffb114],
  [Palette.Sparkle]: [0xffdc55, 0xffe883],
  [Palette.Cloud]: [0xeef4f7, 0xf6f8f6],
  [Palette.CloudTop]: [0xffffff, 0xffffff],
  [Palette.ApeGrey]: [0xb3aab0, 0xc3bbc0],
};

const FALLBACK: [Hex, Hex] = [0xff00ff, 0xff00ff];

/**
 * How much of its own light a slot gives off, 0..1, carried in the palette's
 * alpha channel because nothing else uses it. The material turns it into an
 * emissive term, which lifts these slots past the bloom threshold: the gold
 * things glow instead of sitting there as flat yellow paint.
 */
const EMISSION: Partial<Record<number, number>> = {
  [Palette.Coin]: 0.9,
  [Palette.Sparkle]: 1,
  [Palette.FurCapybaraGold]: 0.8,
};

function writeHex(data: Uint8Array, offset: number, hex: Hex, emission: number): void {
  data[offset] = (hex >> 16) & 0xff;
  data[offset + 1] = (hex >> 8) & 0xff;
  data[offset + 2] = hex & 0xff;
  // Alpha is the emission mask, not opacity: the material writes its own alpha.
  data[offset + 3] = Math.round(Math.min(1, Math.max(0, emission)) * 255);
}

/**
 * Build the 256x2 palette texture. Row 0 = wet, row 1 = dry.
 * Nearest filtering: slots must never bleed into each other.
 */
export function createPaletteTexture(): DataTexture {
  const data = new Uint8Array(PALETTE_WIDTH * 2 * 4);

  for (let i = 0; i < PALETTE_WIDTH; i++) {
    const [wet, dry] = COLOURS[i] ?? FALLBACK;
    const emission = EMISSION[i] ?? 0;

    writeHex(data, i * 4, wet, emission);
    writeHex(data, (PALETTE_WIDTH + i) * 4, dry, emission);
  }

  const texture = new DataTexture(data, PALETTE_WIDTH, 2, RGBAFormat, UnsignedByteType);

  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
