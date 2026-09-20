import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { NEWS, NEWS_TEMPLATES, regionName } from '@sim/balance/news/index.ts';
import { ATTENTION, AUTHORITY, INTEGRITY, MACRO, MACRO_PREFIX } from '@sim/balance/society.ts';
import { SLOTS_PER_BLOCK } from '@sim/balance/world.ts';
import { chopCost } from '@sim/commands/chopBlock.ts';
import { settleCost } from '@sim/commands/settleInvestigation.ts';
import { EventSink, type SimEvent } from '@sim/events.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { cloneRng } from '@sim/rng.ts';
import { writeBlock } from '@sim/state.ts';
import { newsSystem, render } from '@sim/systems/news.ts';
import {
  attentionFactor,
  clearingCostFactor,
  tbsMeanFactor,
  underInvestigation,
} from '@sim/systems/society.ts';
import type { BlockId } from '@sim/types.ts';

function ownedWild(sim: Sim): BlockId[] {
  const out: BlockId[] = [];

  for (const block of sim.state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) out.push(block.id);
  }

  return out;
}

/** Run the news system alone over a hand-made set of events. */
function newsFor(sim: Sim, events: SimEvent[]) {
  const sink = new EventSink();

  for (const e of events) sink.push(e);

  const before = sim.state.society.news.length;

  newsSystem({ state: sim.state, world: sim.world, events: sink });
  return sim.state.society.news.slice(before);
}

/** Advance until an event of this type appears; returns it or null. */
function tickFor<T extends SimEvent['type']>(
  sim: Sim,
  type: T,
  limit: number,
): Extract<SimEvent, { type: T }> | null {
  for (let i = 0; i < limit; i++) {
    const hit = sim.tick().find((e) => e.type === type);

    if (hit) return hit as Extract<SimEvent, { type: T }>;
  }

  return null;
}

describe('news templates (GDD 3.7)', () => {
  it('every template renders with no slot left unfilled and has at least one phrasing', () => {
    const sim = createSim(42);
    const vars = {
      n: 12,
      days: 9,
      pct: '1.07',
      price: 'Rp 2.700',
      block: 'block 3, 4',
      until: 'Year 3, day 1',
      cost: 'Rp 75.000.000',
    };

    for (const [key, t] of Object.entries(NEWS_TEMPLATES)) {
      expect(t.titles.length, key).toBeGreaterThan(0);
      expect(t.bodies.length, key).toBeGreaterThan(0);

      for (const text of [...t.titles, ...t.bodies, ...t.effects]) {
        expect(render(text, sim.state, vars), `${key}: ${text}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('names a fictional kabupaten fixed by the seed', () => {
    expect(regionName(42)).toMatch(/^Kabupaten \w+ \w+$/);
    expect(regionName(42)).toBe(regionName(42));
  });

  /**
   * Every name in the deck must be one of the invented cast, and none may be a
   * real person's. The register invites exactly that mistake.
   */
  it('names only its own invented cast, never a real person', () => {
    const CAST = [
      'Prerows',
      'BehLOL',
      'Purboy',
      'Amrun',
      'Rajuli',
      'Nazarra',
      'Mulyonows',
      'Tanjidoor',
    ];
    const REAL =
      /\b(Prabowo|Subianto|Jokowi|Joko|Widodo|Mulyono|Bahlil|Lahadalia|Purbaya|Sadewa|Amran|Sulaiman|Raja Juli|Antoni|Suahasil|Nazara|Kibutsuji|Muzan|Tanjiro|Kamado)\b/;

    for (const [key, t] of Object.entries(NEWS_TEMPLATES)) {
      for (const text of [...t.titles, ...t.bodies]) {
        expect(text, `${key} names a real person`).not.toMatch(REAL);

        // A title followed by a name is fine only for the cast.
        const named = text.match(/\b(?:President|Minister|Governor|General|Pak|Bu) ([A-Z]\w+)/);

        if (named) expect(CAST, `${key} names ${named[1]}`).toContain(named[1]);
      }
    }
  });
});

describe('news system (GDD 3.7)', () => {
  const cases: [string, SimEvent[], string][] = [
    ['wildfire', [{ type: 'WildfireStarted' }], 'wildfire.start'],
    ['haze', [{ type: 'WeatherEventStarted', id: 'haze', days: 20 }], 'haze.start'],
    ['ash', [{ type: 'WeatherEventStarted', id: 'ash', days: 5 }], 'ash.start'],
    ['flood elsewhere', [{ type: 'WeatherEventStarted', id: 'flood', days: 8 }], 'flood.regional'],
    ['drought', [{ type: 'WeatherEventStarted', id: 'drought', days: 0 }], 'drought.start'],
    ['drought ends', [{ type: 'WeatherEventEnded', id: 'drought' }], 'drought.end'],
    ['landslide', [{ type: 'Landslide', block: 0, below: null, palmsLost: 144 }], 'landslide'],
    ['plague', [{ type: 'PlagueStarted', block: 0 }], 'plague.start'],
    ['macro', [{ type: 'MacroEventStarted', id: 'millStrike', days: 14 }], 'macro.millStrike'],
    ['scandal', [{ type: 'IntegrityScandal', integrity: 0.6 }], 'gov.scandal'],
    ['letter', [{ type: 'LetterReceived' }], 'authority.letter'],
    [
      'investigation',
      [{ type: 'InvestigationOpened', until: 900, reason: 'wildfire' }],
      'authority.investigation.wildfire',
    ],
    ['settled', [{ type: 'InvestigationSettled', cost: 75_000_000 }], 'authority.settled'],
    ['closed', [{ type: 'InvestigationClosed' }], 'authority.closed'],
    ['arrest', [{ type: 'Arrested', reason: 'attention' }], 'authority.arrested'],
  ];

  it.each(cases)('%s makes a headline', (_label, events, key) => {
    const sim = createSim(42);

    sim.state.tick = 400;

    const items = newsFor(sim, events);
    const item = items.find((i) => i.key === key);

    expect(item, key).toBeDefined();
    expect(item!.title.length).toBeGreaterThan(10);
    expect(item!.lane).toBe(NEWS_TEMPLATES[key]!.lane);
  });

  it('many events of one kind in a tick make one headline', () => {
    const sim = createSim(42);

    sim.state.tick = 400;

    const items = newsFor(sim, [
      { type: 'Landslide', block: 1, below: null, palmsLost: 10 },
      { type: 'Landslide', block: 2, below: null, palmsLost: 20 },
      { type: 'Landslide', block: 3, below: null, palmsLost: 30 },
    ]);
    const slides = items.filter((i) => i.key === 'landslide');

    expect(slides.length).toBe(1);
    expect(slides[0]!.blocks).toEqual([1, 2, 3]);
  });

  it('honours the cooldown', () => {
    const sim = createSim(42);

    sim.state.tick = 400;
    expect(
      newsFor(sim, [{ type: 'LetterReceived' }]).some((i) => i.key === 'authority.letter'),
    ).toBe(true);
    sim.state.tick = 410;
    expect(
      newsFor(sim, [{ type: 'LetterReceived' }]).some((i) => i.key === 'authority.letter'),
    ).toBe(false);
    sim.state.tick = 400 + NEWS_TEMPLATES['authority.letter']!.cooldownDays + 1;
    expect(
      newsFor(sim, [{ type: 'LetterReceived' }]).some((i) => i.key === 'authority.letter'),
    ).toBe(true);
  });

  it("your own wildfire's smoke is not a separate haze story", () => {
    const sim = createSim(42);

    sim.state.tick = 400;

    const items = newsFor(sim, [
      { type: 'WildfireStarted' },
      { type: 'WeatherEventStarted', id: 'haze', days: 20 },
    ]);

    expect(items.some((i) => i.key === 'wildfire.start')).toBe(true);
    expect(items.some((i) => i.key === 'haze.start')).toBe(false);
  });

  it("the words of the news never touch the simulation's random stream", () => {
    const sim = createSim(42);

    sim.state.tick = 400;

    const before = cloneRng(sim.state.rng);

    newsFor(
      sim,
      cases.flatMap(([, events]) => events),
    );
    expect(sim.state.rng).toEqual(before);
  });

  it('keeps at most the cap', () => {
    const sim = createSim(42);

    for (let i = 0; i < NEWS.cap + 50; i++) {
      sim.state.tick = 1000 + i * 1000;
      newsFor(sim, [{ type: 'Arrested', reason: 'attention' }]);
    }

    expect(sim.state.society.news.length).toBe(NEWS.cap);
  });

  it('a long run publishes a steady, deterministic feed across all three lanes', () => {
    const run = (): string[] => {
      const sim = createSim(1234);

      for (let i = 0; i < 12 * GROWTH.daysPerYear; i++) sim.tick();
      return sim.state.society.news.map((n) => `${n.tick}:${n.key}:${n.title}`);
    };
    const a = run();

    expect(a).toEqual(run());

    const sim = createSim(1234);

    for (let i = 0; i < 12 * GROWTH.daysPerYear; i++) sim.tick();

    const lanes = new Set(sim.state.society.news.map((n) => n.lane));

    expect(lanes.has('natural')).toBe(true);
    expect(lanes.has('economic')).toBe(true);
    expect(sim.state.society.news.length).toBeGreaterThan(12);
  });
});

describe('integrity (GDD 3.7)', () => {
  it('stays in 0..1, drifts back toward its baseline, and scandals push it up for a while', () => {
    let scandals = 0;

    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = createSim(seed);

      for (let i = 0; i < 25 * GROWTH.daysPerYear; i++) {
        const before = sim.state.society.integrity;
        const events = sim.tick();
        const after = sim.state.society.integrity;

        expect(after).toBeGreaterThanOrEqual(0);
        expect(after).toBeLessThanOrEqual(1);

        if (events.some((e) => e.type === 'IntegrityScandal')) {
          scandals += 1;
          expect(after).toBeGreaterThan(Math.min(1, before + INTEGRITY.scandalJump) - 0.05);
        }
      }
    }

    expect(scandals).toBeGreaterThan(3);
  });
});

describe('macro economy (GDD 3.7)', () => {
  it('inflation ratchets the input index up, never past the cap, and lifts TBS by half as much', () => {
    const sim = createSim(9);
    let last = sim.state.economy.inputPriceIndex;

    for (let i = 0; i < 25 * GROWTH.daysPerYear; i++) {
      sim.tick();

      const index = sim.state.economy.inputPriceIndex;

      expect(index).toBeGreaterThanOrEqual(last);
      expect(index).toBeLessThanOrEqual(MACRO.maxInputIndex + 1e-9);
      last = index;
    }

    expect(last).toBeGreaterThan(1.05);
    // With no temporary events running the TBS factor is exactly the pass-through.
    sim.state.weather.activeEvents = sim.state.weather.activeEvents.filter(
      (e) => !e.id.startsWith(MACRO_PREFIX),
    );
    expect(tbsMeanFactor(sim.state)).toBeCloseTo(1 + (last - 1) * MACRO.tbsPassThrough, 9);
  });

  it('a temporary event moves the TBS mean while it runs and ends with an announcement', () => {
    const sim = createSim(9);
    const base = tbsMeanFactor(sim.state);

    sim.state.weather.activeEvents.push({
      id: `${MACRO_PREFIX}millStrike`,
      startedAt: sim.state.tick,
      endsAt: sim.state.tick + 3,
    });
    expect(tbsMeanFactor(sim.state)).toBeCloseTo(base * MACRO.events.millStrike.tbsFactor, 9);

    const ended = tickFor(sim, 'MacroEventEnded', 5);

    expect(ended?.id).toBe('millStrike');
    expect(tbsMeanFactor(sim.state)).toBeCloseTo(base, 9);
  });

  it('shop prices follow the index', () => {
    const sim = createSim(9);

    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.state.economy.inputPriceIndex = 1.5;

    const cash = sim.state.economy.cash;

    sim.dispatch({ type: 'BuyItem', item: 'fertilizer', quantity: 1 });
    expect(cash - sim.state.economy.cash).toBe(Math.round(1_250_000 * 1.5));
  });
});

describe('authority (GDD 3.9)', () => {
  function quiet(sim: Sim): void {
    // Freeze integrity at its baseline so the numbers are exact.
    sim.state.society.integrity = INTEGRITY.baseline;
  }

  it('a medium burn raises attention by its weight times the integrity factor', () => {
    const sim = createSim(42);

    while (sim.state.weather.dayOfYear < 130) sim.tick();
    quiet(sim);

    const factor = attentionFactor(sim.state);

    sim.dispatch({ type: 'BurnBlock', block: ownedWild(sim)[0]!, intensity: 2 });

    const before = sim.state.society.attention;

    sim.tick();

    const gained = sim.state.society.attention - before;

    expect(gained).toBeGreaterThan(ATTENTION.burn[2] * factor * 0.8);
    expect(gained).toBeLessThan(ATTENTION.burn[2] * 1.6);
  });

  it('low integrity makes the meter climb slower than high', () => {
    const low = createSim(42);
    const high = createSim(42);

    low.state.society.integrity = 0.1;
    high.state.society.integrity = 0.9;
    expect(attentionFactor(low.state)).toBeLessThan(attentionFactor(high.state));
  });

  it('chopping forest is noticed when the block clears; quiet days forget; planting forest pulls it down', () => {
    const sim = createSim(1);
    const forest = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.biome === 'forest' && b.phase === 'wild',
    )!;

    sim.dispatch({ type: 'ChopBlock', block: forest.id });
    expect(tickFor(sim, 'ForestChopped', 60)).not.toBeNull();

    const after = sim.state.society.attention;

    expect(after).toBeGreaterThan(0);

    sim.state.society.attention = 50;
    sim.tick();
    expect(sim.state.society.attention).toBeLessThan(50);

    sim.state.economy.cash = 1e9;
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.dispatch({ type: 'BuyItem', item: 'forestSapling', quantity: SLOTS_PER_BLOCK });

    const beforePlant = sim.state.society.attention;

    expect(sim.dispatch({ type: 'PlantBlock', block: forest.id, species: 'forest' })).toEqual({
      ok: true,
    });
    sim.tick();
    expect(sim.state.society.attention).toBeLessThan(beforePlant - ATTENTION.reforestPlant * 0.9);
  });

  it('open land takes saplings with no crew, and the Ministry halves what it holds', () => {
    const sim = createSim(11);
    // Grass or scrub the player already owns: nothing stands on it to clear.
    const open = [...sim.state.blocks.values()].find(
      (b) => b.owned && b.phase === 'wild' && BIOMES[b.biome].openLand === true,
    );

    expect(open).toBeDefined();

    const id = open!.id;

    sim.state.economy.cash = 1e9;
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    sim.dispatch({ type: 'BuyItem', item: 'forestSapling', quantity: SLOTS_PER_BLOCK });

    // Palms still want the land prepared; saplings do not.
    expect(sim.dispatch({ type: 'PlantBlock', block: id, species: 'palm' })).toMatchObject({
      ok: false,
      code: 'wrongPhase',
    });

    const s = sim.state.society;

    s.attention = 60;
    s.operatingBanUntil = sim.state.tick + 100;
    s.investigationUntil = sim.state.tick + 40;
    s.warningLevel = 1;

    expect(sim.dispatch({ type: 'PlantBlock', block: id, species: 'forest' })).toEqual({
      ok: true,
    });
    expect(sim.state.blocks.get(id)!.phase).toBe('reforesting');
    expect(s.attention).toBeCloseTo(30, 5);
    expect(s.operatingBanUntil - sim.state.tick).toBe(50);
    expect(s.investigationUntil - sim.state.tick).toBe(20);
    // 30 is over the line that clears a letter, so the letter stands.
    expect(s.warningLevel).toBe(1);
  });

  it('an empty meter closes the case: no suspicion, no police', () => {
    const sim = createSim(7);
    const s = sim.state.society;

    s.attention = ATTENTION.decayPerDay / 2;
    s.warningLevel = 2;
    s.investigationUntil = sim.state.tick + 50;

    expect(tickFor(sim, 'InvestigationDropped', 3)).not.toBeNull();
    expect(s.attention).toBe(0);
    expect(underInvestigation(sim.state)).toBe(false);

    // A suspension is a sentence with a date, and is not dropped with it.
    s.attention = ATTENTION.decayPerDay / 2;
    s.operatingBanUntil = sim.state.tick + 40;
    sim.tick();
    expect(s.operatingBanUntil).toBeGreaterThan(sim.state.tick);
  });

  it('Warning 1: the letter at 40 makes clearing cost half again, and lifts below 25', () => {
    const sim = createSim(42);
    const biome = sim.state.blocks.get(ownedWild(sim)[0]!)!.biome;
    const base = chopCost(biome, sim.state);

    sim.state.society.attention = AUTHORITY.letterAt + 1;
    expect(tickFor(sim, 'LetterReceived', 2)).not.toBeNull();
    expect(sim.state.society.warningLevel).toBe(1);
    expect(sim.state.society.lettersReceived).toBe(1);
    expect(clearingCostFactor(sim.state)).toBe(AUTHORITY.letterChopCostFactor);
    expect(chopCost(biome, sim.state)).toBe(Math.round(base * AUTHORITY.letterChopCostFactor));

    sim.state.society.attention = AUTHORITY.letterClearsBelow - 5;
    sim.tick();
    expect(sim.state.society.warningLevel).toBe(0);
    expect(chopCost(biome, sim.state)).toBe(base);
  });

  it('Warning 2: at 70 the police ban chopping and burning for six months; the harvest carries on', () => {
    const sim = createSim(42);

    sim.state.society.attention = AUTHORITY.investigationAt + 1;

    const opened = tickFor(sim, 'InvestigationOpened', 2);

    expect(opened?.reason).toBe('attention');
    expect(underInvestigation(sim.state)).toBe(true);
    expect(sim.state.society.warningLevel).toBe(2);

    const block = ownedWild(sim)[0]!;
    const chop = sim.validate({ type: 'ChopBlock', block });

    expect(chop).toMatchObject({ code: 'banned' });
    expect(chop!.reason).toMatch(/police investigation/);
    expect(sim.validate({ type: 'BurnBlock', block, intensity: 1 })).toMatchObject({
      code: 'banned',
    });
    // Buying stock is not clearing.
    sim.dispatch({ type: 'PlaceKopdes', block: sim.state.worldGen.kopdesBlock });
    expect(sim.validate({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toBeNull();

    sim.state.society.attention = 10;
    sim.state.tick = sim.state.society.investigationUntil;
    expect(tickFor(sim, 'InvestigationClosed', 3)).not.toBeNull();
    expect(underInvestigation(sim.state)).toBe(false);
    expect(sim.validate({ type: 'ChopBlock', block })).toBeNull();
  });

  it('a case that runs its course closes for good: the old attention does not reopen it', () => {
    const sim = createSim(42);

    // Well over the police line, and nothing done about it for the whole case.
    sim.state.society.attention = 90;
    tickFor(sim, 'InvestigationOpened', 2);

    const until = sim.state.society.investigationUntil;
    const reopened: unknown[] = [];
    let closed = false;

    while (sim.state.tick <= until + 5) {
      const events = sim.tick();

      if (events.some((e) => e.type === 'InvestigationClosed')) closed = true;
      reopened.push(...events.filter((e) => e.type === 'InvestigationOpened'));
    }

    expect(closed).toBe(true);
    expect(reopened).toEqual([]);
    expect(underInvestigation(sim.state)).toBe(false);
    expect(sim.state.society.attention).toBeLessThanOrEqual(AUTHORITY.investigationClosesAt);
    // The file stays open: the letter stands.
    expect(sim.state.society.warningLevel).toBe(1);

    // A new offence that climbs back over the line brings them back.
    sim.state.society.attention = AUTHORITY.investigationAt + 1;
    expect(tickFor(sim, 'InvestigationOpened', 2)?.reason).toBe('attention');
  });

  it('any wildfire brings the police at once; a second one while they are here is an arrest', () => {
    const sim = createSim(42);

    while (sim.state.weather.dayOfYear < 130) sim.tick();

    const [a, b] = ownedWild(sim);

    sim.dispatch({ type: 'BurnBlock', block: a!, intensity: 2 });
    sim.dispatch({ type: 'BurnBlock', block: b!, intensity: 2 }); // tips the wildfire

    const opened = tickFor(sim, 'InvestigationOpened', 2);

    expect(opened?.reason).toBe('wildfire');

    // Let that fire end, then deliver a second wildfire the way the fire system would.
    for (let i = 0; i < 400 && sim.state.weather.activeEvents.some((e) => e.id === 'wildfire'); i++)
      sim.tick();
    (sim as unknown as { ctx: { events: EventSink } }).ctx.events.push({ type: 'WildfireStarted' });

    const arrested = tickFor(sim, 'Arrested', 2);

    expect(arrested?.reason).toBe('secondWildfire');
    expect(sim.state.run.ending).toBe('arrested');
    expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 1 })).toMatchObject({
      code: 'gameOver',
    });
  });

  it('attention at 100 is an arrest', () => {
    const sim = createSim(42);

    sim.state.society.attention = AUTHORITY.arrestAt;
    expect(tickFor(sim, 'Arrested', 2)?.reason).toBe('attention');
    expect(sim.state.run.ending).toBe('arrested');
    expect(sim.state.run.endedAt).toBe(sim.state.tick);
  });

  it('burning next to protected forest goes straight to the police', () => {
    const sim = createSim(42);

    while (sim.state.weather.dayOfYear < 130) sim.tick();

    const block = ownedWild(sim)[0]!;
    const [x, y] = sim.world.toXY(block);
    const neighbour = writeBlock(sim.state, sim.world, sim.world.toId(x + 1, y));

    neighbour.biome = 'protected';
    sim.dispatch({ type: 'BurnBlock', block, intensity: 1 });
    expect(tickFor(sim, 'InvestigationOpened', 2)?.reason).toBe('protectedForest');
  });

  it('settling works only while integrity is low, costs dearly, and says what it was', () => {
    const sim = createSim(42);

    sim.state.society.attention = AUTHORITY.investigationAt + 1;
    tickFor(sim, 'InvestigationOpened', 2);
    sim.state.economy.cash = 1e9;

    sim.state.society.integrity = 0.8;
    expect(sim.validate({ type: 'SettleInvestigation' })).toMatchObject({ code: 'wrongPhase' });

    sim.state.society.integrity = 0.2;

    const cost = settleCost(sim.state);
    const cash = sim.state.economy.cash;

    expect(sim.dispatch({ type: 'SettleInvestigation' })).toEqual({ ok: true });
    expect(cash - sim.state.economy.cash).toBe(cost);
    expect(underInvestigation(sim.state)).toBe(false);
    expect(sim.state.society.attention).toBe(AUTHORITY.settleAttention);
    sim.tick();
    expect(
      sim.state.society.news.some(
        (n) => n.key === 'authority.settled' && n.body.includes('coordination fee'),
      ),
    ).toBe(true);
    expect(sim.validate({ type: 'SettleInvestigation' })).toMatchObject({ code: 'wrongPhase' });
  });

  it('a careful grower never hears from the district office', () => {
    // Chop four forest blocks over two years and nothing else: no letter.
    const sim = createSim(1);
    const forest = [...sim.state.blocks.values()]
      .filter((b) => b.owned && b.biome === 'forest' && b.phase === 'wild')
      .slice(0, 4);

    for (const b of forest) {
      sim.dispatch({ type: 'ChopBlock', block: b.id });
      for (let i = 0; i < 180; i++) sim.tick();
    }

    expect(sim.state.society.lettersReceived).toBe(0);
  });
});
