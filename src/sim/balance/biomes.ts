import type { Biome } from '../types.ts';

export interface BiomeSpec {
  /** Days a chopping crew needs to clear one block. */
  chopDays: number;
  /** Debris left behind after chopping, 0..100. */
  chopDebris: number;
  /** Base purchase price in rupiah, before distance and estate-size multipliers. */
  price: number;
  /** Plantable slots out of 144. Hills terrace to 96 (GDD 3.1). */
  plantableSlots: number;
  /** Nothing standing to clear: forest plants straight on, palms still want it prepared. */
  openLand?: boolean;
  /** Multiplies the fertility factor of `G` once planted. */
  fertility: number;
  /** Can this biome ever be cleared and planted? */
  clearable: boolean;
  /** Can this biome ever be bought? */
  forSale: boolean;
  /** Counts toward forest cover on slopes (GDD 3.6.2). */
  forestCover: boolean;
}

const SLOTS = 144;

export const BIOMES: Record<Biome, BiomeSpec> = {
  grassfield: {
    chopDays: 10,
    chopDebris: 0,
    price: 12_000_000,
    plantableSlots: SLOTS,
    openLand: true,
    fertility: 1,
    clearable: true,
    forSale: true,
    forestCover: false,
  },
  forest: {
    chopDays: 30,
    chopDebris: 55,
    price: 9_000_000,
    plantableSlots: SLOTS,
    // Organic soil, once the debris is sanitised (GDD 3.1).
    fertility: 1.15,
    clearable: true,
    forSale: true,
    forestCover: true,
  },
  scrub: {
    chopDays: 10,
    chopDebris: 0,
    price: 6_000_000,
    plantableSlots: SLOTS,
    openLand: true,
    // Needs irrigation or takes the dry penalty (GDD 3.1).
    fertility: 0.6,
    clearable: true,
    forSale: true,
    forestCover: false,
  },
  hills: {
    chopDays: 45,
    chopDebris: 25,
    price: 7_000_000,
    plantableSlots: 96,
    fertility: 0.9,
    clearable: true,
    forSale: true,
    forestCover: false,
  },
  riverbank: {
    chopDays: 12,
    chopDebris: 10,
    price: 14_000_000,
    plantableSlots: SLOTS,
    // Moist, but floods first and washes fertilizer out (GDD 3.1).
    fertility: 1.2,
    clearable: true,
    forSale: true,
    forestCover: true,
  },
  river: {
    chopDays: 0,
    chopDebris: 0,
    price: 0,
    plantableSlots: 0,
    fertility: 0,
    clearable: false,
    forSale: false,
    forestCover: false,
  },
  protected: {
    chopDays: 0,
    chopDebris: 0,
    price: 0,
    plantableSlots: 0,
    fertility: 0,
    clearable: false,
    forSale: false,
    forestCover: true,
  },
  // ── Milestone 2+ biomes: shapes defined, not yet generated ──────────────
  peat: {
    chopDays: 35,
    chopDebris: 60,
    price: 5_000_000,
    plantableSlots: SLOTS,
    fertility: 1.3,
    clearable: true,
    forSale: true,
    forestCover: true,
  },
  rubber: {
    chopDays: 20,
    chopDebris: 85,
    price: 6_500_000,
    plantableSlots: SLOTS,
    fertility: 1,
    clearable: true,
    forSale: true,
    forestCover: false,
  },
  village: {
    chopDays: 0,
    chopDebris: 0,
    price: 40_000_000,
    plantableSlots: SLOTS,
    fertility: 1,
    clearable: false,
    forSale: false,
    forestCover: false,
  },
  swamp: {
    chopDays: 25,
    chopDebris: 40,
    price: 4_000_000,
    plantableSlots: SLOTS,
    fertility: 1.1,
    clearable: true,
    forSale: true,
    forestCover: false,
  },
  // A mass grave (GDD 3.11): cheap, because nobody wants it, and never chopped.
  // An excavation crew digs it out instead, and the soil under it is rich.
  grave: {
    chopDays: 0,
    chopDebris: 0,
    price: 3_000_000,
    plantableSlots: SLOTS,
    fertility: 1.25,
    clearable: false,
    forSale: true,
    forestCover: false,
  },
};
