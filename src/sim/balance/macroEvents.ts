export interface MacroEvent {
  /** How often it comes up in the draw against the rest of the deck. */
  weight: number;

  // ── Permanent ─────────────────────────────────────────────────────────
  /** A step in the input price index that never comes back down. */
  inputRise?: number;

  // ── While it runs ─────────────────────────────────────────────────────
  /** Multiplier on the TBS price's long-run mean. */
  tbsFactor?: number;
  /** Multiplier on everything the Kopdes shop sells. */
  inputFactor?: number;
  /** Multiplier on the price of land. */
  landFactor?: number;
  /** Multiplier on every wage the estate pays. */
  wageFactor?: number;
  /** Multiplier on what a harvest yields. */
  yieldFactor?: number;
  /** Multiplier on the daily chance a slope gives way. */
  landslideFactor?: number;
  /** Multiplier on how fast the authorities forget. */
  attentionDecayFactor?: number;
  /** Multiplier on the coordination fee, for a district office in a mood. */
  settleFactor?: number;
  /** Wildlife keeps away, the golden capybara with it. */
  mobsQuiet?: boolean;
  /** Paid daily while it runs, but only to an estate with a Kopdes. */
  kopdesCashPerDay?: number;
  /** Nothing else can be drawn while this one holds. */
  calm?: boolean;
  /** Forest cover on the estate softens the TBS hit, up to half of it. */
  forestSoftens?: boolean;

  // ── Once, when it lands ───────────────────────────────────────────────
  /** Added to the attention meter. */
  attention?: number;
  /** Multiplied into the attention meter: 0.5 halves what is held. */
  attentionScale?: number;
  /** Added to the hidden integrity stat. */
  integrity?: number;
  /** Fertile ash over every owned block, for this many days. */
  ashDays?: number;

  // ── When it may be drawn ──────────────────────────────────────────────
  days?: { min: number; max: number };
  /** Not before this year: the permanent ones should not land in year one. */
  fromYear?: number;
  /**
   * Only after this event has happened. A `MacroEventId`, typed loosely because the ids are
   * read back off this very table; a test holds it to real ones.
   */
  after?: string;
  /** At most once in a run. */
  once?: boolean;
  /**
   * Started by what the estate does rather than by the draw (GDD 3.7). These
   * are the consequences, and the deck never deals them at random.
   */
  triggered?: boolean;
}

export const MACRO_EVENTS = {
  // ── The Palace ────────────────────────────────────────────────────────
  /** "Namanya kelapa sawit ya pohon, ya kan?" */
  palmIsATree: {
    weight: 2,
    landFactor: 1.25,
    inputFactor: 1.2,
    tbsFactor: 1.08,
    attentionScale: 0.67,
    days: { min: 150, max: 240 },
  },
  twentyMillionHectares: {
    weight: 1.2,
    landFactor: 1.35,
    wageFactor: 1.15,
    days: { min: 300, max: 360 },
  },
  watchTheMills: { weight: 1.5, tbsFactor: 1.12, days: { min: 60, max: 90 } },

  // ── The ministries ────────────────────────────────────────────────────
  ministerOrdersPriceUp: { weight: 2, tbsFactor: 1.1, days: { min: 25, max: 40 } },
  biodieselMandate: { weight: 1.5, tbsFactor: 1.15, days: { min: 180, max: 270 } },
  exportLevy: { weight: 1.5, tbsFactor: 0.92, days: { min: 120, max: 200 } },
  fertiliserThroughCoop: { weight: 1.2, inputFactor: 0.9, days: { min: 120, max: 180 } },
  coopTargetsCut: { weight: 1.2, inputFactor: 1.12, days: { min: 90, max: 150 } },

  // ── Enforcement ───────────────────────────────────────────────────────
  forestTaskForce: {
    weight: 1.2,
    attention: 15,
    attentionDecayFactor: 0.5,
    days: { min: 120, max: 200 },
  },
  agrinasTakesOver: { weight: 1, landFactor: 0.8, days: { min: 150, max: 240 } },
  forestAmnesty: { weight: 0.8, settleFactor: 0.5, days: { min: 90, max: 150 } },

  // ── The weather of money ──────────────────────────────────────────────
  rupiahSlide: { weight: 3, inputRise: 0.05 },
  rupiahAt18k: {
    weight: 1.5,
    tbsFactor: 1.1,
    inputFactor: 1.15,
    days: { min: 90, max: 150 },
  },
  usTariffs: { weight: 1.2, tbsFactor: 0.88, days: { min: 90, max: 120 } },
  eudrEnforcement: {
    weight: 1,
    tbsFactor: 0.85,
    forestSoftens: true,
    days: { min: 150, max: 240 },
  },
  fertilizerSpike: { weight: 2, inputRise: 0.03 },
  millStrike: { weight: 1.5, tbsFactor: 0.85, days: { min: 10, max: 25 } },
  euRestriction: { weight: 1, tbsFactor: 0.88, days: { min: 180, max: 300 } },

  // ── The sacking of Minister Purboy ────────────────────────────────────
  thePhoneCall: {
    weight: 1.2,
    inputFactor: 1.18,
    tbsFactor: 0.94,
    days: { min: 40, max: 50 },
  },
  cabinetLaughs: {
    weight: 1,
    integrity: -0.25,
    settleFactor: 0.7,
    days: { min: 120, max: 180 },
  },
  integrityLeaves: { weight: 0.8, inputRise: 0.12, fromYear: 3, once: true },
  goneFishing: { weight: 1, calm: true, days: { min: 30, max: 30 } },
  deputyTakesChair: {
    weight: 1,
    landFactor: 0.85,
    wageFactor: 0.92,
    inputFactor: 1.1,
    days: { min: 90, max: 150 },
  },
  spouseLaments: { weight: 1, integrity: 0.25, days: { min: 120, max: 180 } },

  // ── Tech, which mostly does not matter ────────────────────────────────
  aiHype: { weight: 2, inputFactor: 1.02, days: { min: 30, max: 30 } },
  aiLayoffs: { weight: 1.5, wageFactor: 0.88, days: { min: 100, max: 140 } },
  chipInEveryAppliance: { weight: 1.2, inputRise: 0.04 },
  dataCentre: { weight: 1, landFactor: 1.1, days: { min: 120, max: 180 } },
  yieldApp: { weight: 1, yieldFactor: 1.02, days: { min: 120, max: 180 } },

  // ── The free meals programme ──────────────────────────────────────────
  fiftyThousandStudents: {
    weight: 1.2,
    tbsFactor: 0.9,
    attention: 5,
    days: { min: 40, max: 50 },
  },
  kitchensNeverInspected: { weight: 1.2, inputFactor: 1.08, days: { min: 120, max: 180 } },
  coopBecomesKitchen: {
    weight: 1.2,
    kopdesCashPerDay: 900_000,
    wageFactor: 1.1,
    days: { min: 120, max: 180 },
  },
  budgetEatsSubsidy: { weight: 0.8, inputRise: 0.09, fromYear: 3, once: true },
  blameTheChillies: { weight: 1.5, inputFactor: 1.02, days: { min: 20, max: 20 } },

  // ── Mulyonows in Osaka, and what is under it ──────────────────────────
  osakaCulvert: { weight: 1, attentionDecayFactor: 3, days: { min: 7, max: 7 }, once: true },
  endlessCastle: {
    weight: 1.5,
    attentionScale: 0.5,
    attentionDecayFactor: 3,
    days: { min: 5, max: 5 },
    once: true,
    after: 'osakaCulvert',
  },

  // ── What burning costs, which the deck never deals at random ──────────
  hazeSeason: {
    weight: 1,
    triggered: true,
    yieldFactor: 0.9,
    days: { min: 45, max: 75 },
  },
  animalsGone: {
    weight: 1,
    triggered: true,
    mobsQuiet: true,
    days: { min: 150, max: 220 },
  },
  onTheBrink: {
    weight: 1,
    triggered: true,
    attention: 8,
    tbsFactor: 0.9,
    days: { min: 120, max: 180 },
  },
  burnedCarcasses: {
    weight: 1,
    triggered: true,
    attention: 18,
    mobsQuiet: true,
    days: { min: 60, max: 90 },
  },

  // ── Nature ────────────────────────────────────────────────────────────
  krakatoaLeaves: {
    weight: 0.6,
    ashDays: 180,
    landslideFactor: 2,
    tbsFactor: 1.14,
    days: { min: 30, max: 30 },
    once: true,
  },
} as const satisfies Record<string, MacroEvent>;

export type MacroEventId = keyof typeof MACRO_EVENTS;
