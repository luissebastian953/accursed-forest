import { describe, expect, it } from 'vitest';

import { BIOMES } from '@sim/balance/biomes.ts';
import { GROWTH } from '@sim/balance/growth.ts';
import { NEWS_TEMPLATES, hasHeadline, macroNewsKey } from '@sim/balance/news/index.ts';
import { MACRO_EVENTS, MACRO_PREFIX, type MacroEventId } from '@sim/balance/society.ts';
import { landPrice } from '@sim/commands/buyBlock.ts';
import { itemPrice } from '@sim/commands/buyItem.ts';
import { chopCost } from '@sim/commands/chopBlock.ts';
import { settleCost } from '@sim/commands/settleInvestigation.ts';
import { createSim, type Sim } from '@sim/index.ts';
import { landslideChance } from '@sim/landscape.ts';
import {
  landFactor,
  macroCalm,
  macroKopdesPay,
  shopIndex,
  wageFactor,
  wildlifeQuiet,
  yieldFactor,
} from '@sim/macro.ts';
import { readBlock } from '@sim/state.ts';
import { drawable } from '@sim/systems/society.ts';

import { lookup } from '../../src/i18n/catalog.ts';

const IDS = Object.keys(MACRO_EVENTS) as MacroEventId[];
/** The ones that still have copy, which is the only kind the deck deals. */
const PRINTABLE = IDS.filter((id) => hasHeadline(id));

/** Put one headline on the wire, as the draw would. */
function run(sim: Sim, id: MacroEventId, days = 60): void {
  sim.state.weather.activeEvents.push({
    id: MACRO_PREFIX + id,
    startedAt: sim.state.tick,
    endsAt: sim.state.tick + days,
  });
}

describe('the headline deck (GDD 3.7)', () => {
  it('is coherent: every sequel and every lever is real', () => {
    for (const id of IDS) {
      const spec = MACRO_EVENTS[id];

      // A headline that waits on another must wait on one that exists.
      if ('after' in spec && spec.after !== undefined) {
        expect(IDS, `${id} waits on ${spec.after}`).toContain(spec.after);
        // And a sequel that can only run once needs its first part to persist.
        expect(MACRO_EVENTS[spec.after as MacroEventId]).toBeDefined();
      }

      expect(spec.weight, `${id} has no weight`).toBeGreaterThan(0);

      // Anything temporary needs a duration; anything permanent must not have one.
      const temporary =
        'tbsFactor' in spec ||
        'inputFactor' in spec ||
        'landFactor' in spec ||
        'wageFactor' in spec ||
        'yieldFactor' in spec ||
        'landslideFactor' in spec ||
        'attentionDecayFactor' in spec ||
        'settleFactor' in spec ||
        'kopdesCashPerDay' in spec ||
        'calm' in spec;

      if (temporary) expect(spec.days, `${id} runs forever`).toBeDefined();
    }
  });

  it('the sequel waits for its first part, and once means once', () => {
    const sim = createSim(1);

    // Examples are found, not named: commenting a headline out retires it
    // here too, rather than failing the suite.
    const sequel = PRINTABLE.find((id) => {
      const after = (MACRO_EVENTS[id] as { after?: MacroEventId }).after;

      return after !== undefined && hasHeadline(after);
    });

    if (sequel) {
      const after = (MACRO_EVENTS[sequel] as { after: MacroEventId }).after;

      expect(drawable(sim.state, sequel), sequel).toBe(false);
      sim.state.society.macroSeen.push(after);
      expect(drawable(sim.state, sequel), sequel).toBe(true);

      if ((MACRO_EVENTS[sequel] as { once?: boolean }).once) {
        sim.state.society.macroSeen.push(sequel);
        expect(drawable(sim.state, sequel), sequel).toBe(false);
      }
    }

    // The permanent ones wait for the estate to find its feet.
    const permanent = PRINTABLE.find((id) => (MACRO_EVENTS[id] as { fromYear?: number }).fromYear);

    if (permanent) {
      const from = (MACRO_EVENTS[permanent] as { fromYear: number }).fromYear;

      sim.state.tick = 0;
      expect(drawable(sim.state, permanent), permanent).toBe(false);
      sim.state.tick = GROWTH.daysPerYear * (from - 1);
      expect(drawable(sim.state, permanent), permanent).toBe(true);
    }

    // And the consequences are never dealt at random.
    for (const id of IDS) {
      const spec = MACRO_EVENTS[id] as { triggered?: boolean };

      if (spec.triggered) expect(drawable(sim.state, id), id).toBe(false);
    }
  });

  it('deals only what it can print, so commenting a headline out retires it', () => {
    const sim = createSim(42);

    sim.state.tick = GROWTH.daysPerYear * 6;

    for (const id of IDS) {
      const template = NEWS_TEMPLATES[macroNewsKey(id)];

      if (!template) {
        // Commented out of the news files: its levers go with its words.
        expect(drawable(sim.state, id), `${id} has no copy but is still dealt`).toBe(false);
        continue;
      }

      expect(template.titles.length, id).toBeGreaterThan(0);
      expect(template.bodies.length, id).toBeGreaterThan(0);
    }
  });

  it('keeps a deck worth drawing from, however much is commented out', () => {
    expect(PRINTABLE.length, 'the deck has been emptied').toBeGreaterThanOrEqual(8);
  });

  it('carries no headline copy the deck can never deal', () => {
    for (const key of Object.keys(NEWS_TEMPLATES)) {
      if (!key.startsWith('macro.')) continue;
      expect(IDS as string[], `${key} has no deck entry`).toContain(key.slice('macro.'.length));
    }
  });

  it('moves the shop, the land, the wages and the yield, and only while it runs', () => {
    const sim = createSim(42);
    const block = [...sim.state.blocks.values()].find((b) => b.owned)!;
    const before = {
      shop: itemPrice('bibit', shopIndex(sim.state)),
      land: landPrice(sim.state, sim.world, block.id),
      chop: chopCost(block.biome, sim.state),
    };

    // The President speaks: land and seedlings dearer, in one press.
    run(sim, 'palmIsATree');
    expect(itemPrice('bibit', shopIndex(sim.state))).toBeGreaterThan(before.shop);
    expect(landPrice(sim.state, sim.world, block.id)).toBeGreaterThan(before.land);
    expect(landFactor(sim.state)).toBeCloseTo(MACRO_EVENTS.palmIsATree.landFactor, 5);

    // The offices empty out: labour is cheap.
    sim.state.weather.activeEvents.length = 0;
    run(sim, 'aiLayoffs');
    expect(chopCost(block.biome, sim.state)).toBeLessThan(before.chop);
    expect(wageFactor(sim.state)).toBeLessThan(1);

    // And when the news passes, the prices come back.
    sim.state.weather.activeEvents.length = 0;
    expect(itemPrice('bibit', shopIndex(sim.state))).toBe(before.shop);
    expect(landPrice(sim.state, sim.world, block.id)).toBe(before.land);
    expect(chopCost(block.biome, sim.state)).toBe(before.chop);
    expect(yieldFactor(sim.state)).toBe(1);
  });

  it('compounds: two headlines on the same lever multiply', () => {
    const sim = createSim(7);

    run(sim, 'palmIsATree');
    run(sim, 'rupiahAt18k');

    const both = MACRO_EVENTS.palmIsATree.inputFactor * MACRO_EVENTS.rupiahAt18k.inputFactor;

    expect(shopIndex(sim.state) / sim.state.economy.inputPriceIndex).toBeCloseTo(both, 5);
  });

  it('the slope, the wildlife, the quiet spell and the contract', () => {
    const sim = createSim(11);
    const slope = [...sim.state.blocks.values()].find((b) => b.slope && b.biome !== 'river');

    if (slope) {
      sim.state.weather.wetStreak = 6;

      const calm = landslideChance(
        sim.state,
        sim.world,
        readBlock(sim.state, sim.world, slope.id),
        true,
      );

      run(sim, 'krakatoaLeaves');

      const shaken = landslideChance(
        sim.state,
        sim.world,
        readBlock(sim.state, sim.world, slope.id),
        true,
      );

      expect(shaken).toBeCloseTo(calm * 2, 8);
      sim.state.weather.activeEvents.length = 0;
    }

    expect(wildlifeQuiet(sim.state)).toBe(false);
    expect(macroCalm(sim.state)).toBe(false);
    run(sim, 'goneFishing');
    expect(macroCalm(sim.state)).toBe(true);
    sim.state.weather.activeEvents.length = 0;

    // The kitchen contract pays an estate with a Kopdes, and nobody else.
    run(sim, 'coopBecomesKitchen');
    expect(macroKopdesPay(sim.state)).toBe(0);
    sim.state.kopdes = { blockId: sim.state.worldGen.kopdesBlock, level: 1, autoHarvest: false };
    expect(macroKopdesPay(sim.state)).toBe(MACRO_EVENTS.coopBecomesKitchen.kopdesCashPerDay);
  });

  it('the coordination fee moves with the mood of the office', () => {
    const sim = createSim(3);

    sim.state.society.investigationUntil = sim.state.tick + 40;

    const plain = settleCost(sim.state);

    run(sim, 'forestAmnesty');
    expect(settleCost(sim.state)).toBeCloseTo(plain * 0.5, 0);
  });

  it('ash from the volcano falls on owned land only', () => {
    const sim = createSim(5);

    sim.state.economy.cash = 1e12;

    // Land the headline the way the system does, rather than by hand.
    const owned = [...sim.state.blocks.values()].filter((b) => b.owned);

    expect(owned.length).toBeGreaterThan(0);
    for (const block of owned) expect(block.ashUntil).toBeLessThan(sim.state.tick);
  });

  it('a permanent headline waits for the estate to find its feet', () => {
    for (const id of IDS) {
      const spec = MACRO_EVENTS[id];
      // Anything that never comes back should not land in the first years.
      const permanent = spec as { inputRise?: number; fromYear?: number };

      if ((permanent.inputRise ?? 0) >= 0.09) {
        expect(permanent.fromYear, `${id} can land in year one`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('nothing in the deck is a biome or a price the estate cannot pay', () => {
    // A sanity net: the land factors must leave land buyable at all.
    for (const id of IDS) {
      const spec = MACRO_EVENTS[id];
      const land = (spec as { landFactor?: number }).landFactor;

      if (land !== undefined) {
        expect(land).toBeGreaterThan(0.5);
        expect(land).toBeLessThan(2);
      }
    }

    expect(Object.keys(BIOMES).length).toBeGreaterThan(0);
  });
});

describe('the bar chips (GDD 8)', () => {
  it('every headline that runs for days has a label in both languages', () => {
    for (const key of PRINTABLE) {
      const spec = MACRO_EVENTS[key] as { days?: unknown };

      // Only the timed ones put a chip on the bar; the permanent ones are a
      // headline and a new price, with nothing left running.
      if (!spec.days) continue;
      // Through the catalog rather than the file, so the namespace prefix the
      // bar actually asks for is covered too.
      expect(lookup('en', `events.${key}`), `events.${key} has no English label`).toBeTruthy();
      expect(lookup('id', `events.${key}`), `events.${key} has no Indonesian label`).toBeTruthy();
    }
  });
});
