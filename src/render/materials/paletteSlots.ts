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
  GrassLight: 5,
  ForestLight: 6,
  ScrubDark: 7,

  Grass: 8,
  Forest: 9,
  ForestDark: 10,
  Terrace: 11,
  Scrub: 12,
  Peat: 13,
  Bank: 14,
  Reed: 15,

  Laterite: 16,
  Dirt: 17,
  Rock: 18,
  Sand: 19,
  Charcoal: 20,
  Fire: 21,
  Ash: 22,
  Smoke: 23,

  Water: 24,
  WaterShallow: 25,
  RockDark: 26,
  Bush: 27,
  Canopy: 28,
  CanopyLight: 29,
  CanopyDark: 30,
  Bark: 31,

  Debris: 32,
  Stump: 33,
  Log: 34,
  DeadWood: 35,
  Vine: 36,
  Pine: 37,
  PineDark: 38,
  Willow: 39,

  KopdesWall: 40,
  KopdesRoof: 41,
  KopdesFlag: 42,

  HouseWall: 44,
  HouseWood: 45,
  HouseRoof: 46,
  Thatch: 47,
  Cave: 48,
  Cactus: 49,
  Tumbleweed: 50,
  FlowerRed: 51,
  FlowerYellow: 52,
  FlowerWhite: 53,
  FlowerPink: 54,
  Rain: 55,
  CharredGround: 56,

  // Mobs (§POC): fur, skin, cloth and the things that are not quite there.
  FurDark: 57,
  FurBoar: 58,
  FurPig: 59,
  FurCow: 60,
  FurCowSpot: 61,
  FurMouse: 62,
  FurMonkey: 63,
  FurOrangutan: 64,
  FurCapybara: 65,
  Skin: 66,
  ClothThief: 67,
  ClothWorker: 68,
  ClothDoctor: 69,
  ClothSecurity: 70,
  HiVis: 71,
  Steel: 72,
  Ghost: 73,
  Snout: 74,
  Hoof: 75,
  Sack: 76,

  // River surface: its own light blue, and the darker patches that texture it.
  River: 77,
  RiverDeep: 78,

  FurPangolin: 79,
  FurPangolinDark: 80,
  /** The capybara nobody believes you saw. */
  FurCapybaraGold: 81,
  /** Coins in the air, and the glint that says something is worth clicking. */
  Coin: 82,
  Sparkle: 83,
  /** Clouds: white, and a touch brighter where the sun catches the top. */
  Cloud: 84,
  CloudTop: 85,
} as const;

export type PaletteSlot = (typeof Palette)[keyof typeof Palette];

/** UV coordinate for a slot, at the centre of its texel. */
export function paletteU(slot: PaletteSlot | number): number {
  return (slot + 0.5) / PALETTE_WIDTH;
}
