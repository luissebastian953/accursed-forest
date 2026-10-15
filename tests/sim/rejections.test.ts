import { describe, expect, it } from 'vitest';

import { createSim, type Sim } from '@sim/index.ts';
import { readBlock } from '@sim/state.ts';
import type { Block, BlockId, Command, Rejection } from '@sim/types.ts';

import enCatalog from '../../src/i18n/locales/en/rejections.json';
import idCatalog from '../../src/i18n/locales/id/rejections.json';

type Catalog = Record<string, string>;

const en: Catalog = enCatalog;
const id: Catalog = idCatalog;

/** The files that hand out rejections, as text, so the key set can be read off the source. */
const SOURCES = import.meta.glob<string>(
  ['../../src/sim/commands/*.ts', '../../src/sim/index.ts', '../../src/sim/systems/society.ts'],
  { query: '?raw', import: 'default', eager: true },
);

/** Every key the sim names, without the `rejections.` prefix the loader adds from the file name. */
function keysInSource(): Set<string> {
  const found = new Set<string>();

  for (const text of Object.values(SOURCES)) {
    for (const match of text.matchAll(/rejections\.(\w+\.\w+)/g)) found.add(match[1]!);
  }

  return found;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
}

/** What the panel will do with a variable: rupiah get the currency prefix, the rest print as is. */
function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name]!;

    if ((name === 'rp' || name === 'cash') && typeof value === 'number') {
      return `Rp ${value.toLocaleString('id-ID')}`;
    }

    return String(value);
  });
}

/** The invariant every rejection must hold, so the two languages cannot drift apart. */
function expectTranslatable(rejection: Rejection, label: string): void {
  const message = rejection.message;

  expect(message, `${label}: no message on "${rejection.reason}"`).toBeDefined();

  const key = message!.key.replace(/^rejections\./, '');
  const vars = message!.vars ?? {};

  expect(message!.key.startsWith('rejections.'), `${label}: ${message!.key}`).toBe(true);
  expect(en[key], `${label}: ${key} missing from en`).toBeDefined();
  expect(id[key], `${label}: ${key} missing from id`).toBeDefined();

  for (const name of [...placeholders(en[key]!), ...placeholders(id[key]!)]) {
    expect(vars, `${label}: {${name}} not supplied for ${key}`).toHaveProperty(name);
  }

  for (const name of Object.keys(vars)) {
    expect(typeof vars[name], `${label}: ${key} var ${name}`).not.toBe('undefined');
  }

  expect(fill(en[key]!, vars), `${label}: ${key}`).toBe(rejection.reason);
}

/** Every id on the map; `state.blocks` holds only what has been touched. */
function allIds(sim: Sim): BlockId[] {
  return Array.from({ length: sim.world.width * sim.world.height }, (_, i) => i);
}

function firstBlock(sim: Sim, pick: (b: Readonly<Block>) => boolean): BlockId {
  for (const id of allIds(sim)) {
    if (pick(readBlock(sim.state, sim.world, id))) return id;
  }

  throw new Error('no such block on the map');
}

describe('rejection catalog', () => {
  it('holds every key the sim hands out, in both languages, and nothing else', () => {
    const used = [...keysInSource()].sort();

    expect(used.length).toBeGreaterThan(80);
    expect(Object.keys(en).sort()).toEqual(used);
    expect(Object.keys(id).sort()).toEqual(used);
  });

  it('asks for the same variables in both languages', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(id[key]!).sort(), key).toEqual(placeholders(en[key]!).sort());
    }
  });

  it('never carries a raw rupiah prefix, the panel formats money', () => {
    for (const [key, text] of [...Object.entries(en), ...Object.entries(id)]) {
      expect(text, key).not.toMatch(/Rp \{/);
    }
  });
});

describe('every rejection names its catalog entry', () => {
  const sim = createSim(42);
  const wild = firstBlock(sim, (b) => b.owned && b.phase === 'wild');
  const foreign = firstBlock(sim, (b) => !b.owned);
  const outside: BlockId = 1_000_000_000;

  const refused: Command[] = [
    { type: 'BuyItem', item: 'bibit', quantity: 1 },
    { type: 'UpgradeKopdes' },
    { type: 'HarvestBlock', block: wild },
    { type: 'BuyBlock', block: wild },
    { type: 'ChopBlock', block: outside },
    { type: 'PlantBlock', block: wild, species: 'palm' },
    { type: 'FertilizeBlock', block: wild },
    { type: 'SetAutoHarvest', on: true },
    { type: 'HireWorker', kind: 'sanitizer' },
    { type: 'DismissWorker', kind: 'security' },
    { type: 'TapMob', mob: -1 },
    { type: 'SettleInvestigation' },
    { type: 'KeepPlaying' },
    { type: 'RemovePalm', block: wild, slot: 0 },
    { type: 'TrenchPalm', block: wild, slot: 0 },
    { type: 'ReplantBlock', block: wild },
    { type: 'ClearPlantation', block: wild },
    { type: 'CoverCropBlock', block: wild },
    { type: 'ExcavateBlock', block: wild },
    { type: 'ApplyTrichoderma', block: wild },
    { type: 'SetTrap', block: wild },
    { type: 'BurnBlock', block: foreign, intensity: 1 },
    { type: 'PlaceKopdes', block: wild },
    { type: 'ReforestBlock', block: foreign },
    { type: 'SanitizeBlock', block: foreign },
    { type: 'IrrigateBlock', block: foreign },
    { type: 'DrainBlock', block: foreign },
  ];

  it('on the plain refusals of a fresh estate', () => {
    for (const command of refused) {
      const rejection = sim.validate(command);

      expect(rejection, command.type).not.toBeNull();
      expectTranslatable(rejection!, command.type);
    }
  });

  it('with the key the sentence belongs to', () => {
    expect(sim.validate({ type: 'BuyItem', item: 'bibit', quantity: 1 })?.message?.key).toBe(
      'rejections.shop.noKopdes',
    );
    expect(sim.validate({ type: 'BuyBlock', block: wild })?.message?.key).toBe(
      'rejections.buy.alreadyOwned',
    );
    expect(sim.validate({ type: 'ChopBlock', block: outside })?.message?.key).toBe(
      'rejections.block.outsideMap',
    );
    expect(sim.validate({ type: 'BurnBlock', block: foreign, intensity: 1 })?.message?.key).toBe(
      'rejections.block.notOwned',
    );
    expect(sim.validate({ type: 'KeepPlaying' })?.message?.key).toBe('rejections.run.over');
  });

  it('with a date as year and day numbers', () => {
    const until = sim.state.tick + 400;

    sim.state.society.operatingBanUntil = until;

    const rejection = sim.validate({ type: 'ChopBlock', block: wild })!;

    expectTranslatable(rejection, 'ChopBlock under ban');
    expect(rejection.message).toEqual({
      key: 'rejections.ban.operating',
      vars: { year: Math.floor(until / 360) + 1, day: (until % 360) + 1 },
    });

    sim.state.society.investigationUntil = until;
    sim.state.society.operatingBanUntil = 0;

    const investigated = sim.validate({ type: 'BurnBlock', block: wild, intensity: 1 })!;

    expectTranslatable(investigated, 'BurnBlock under investigation');
    expect(investigated.message?.key).toBe('rejections.ban.investigation');
    sim.state.society.investigationUntil = 0;
  });

  it('with money as a raw number the panel formats', () => {
    const cash = sim.state.economy.cash;

    sim.state.economy.cash = 0;

    const chop = sim.validate({ type: 'ChopBlock', block: wild })!;

    expectTranslatable(chop, 'ChopBlock without cash');
    expect(chop.message?.key).toBe('rejections.chop.crewCost');
    expect(typeof chop.message?.vars?.rp).toBe('number');

    let bought: Rejection | null = null;

    for (const block of allIds(sim)) {
      const attempt = sim.validate({ type: 'BuyBlock', block });

      if (attempt?.code === 'noCash') {
        bought = attempt;
        break;
      }
    }

    expect(bought, 'a for-sale neighbour the estate cannot afford').not.toBeNull();
    expectTranslatable(bought!, 'BuyBlock without cash');
    expect(bought!.message?.vars).toEqual({ rp: expect.any(Number), cash: 0 });
    sim.state.economy.cash = cash;
  });

  it('on the refusals the sim itself makes before a handler runs', () => {
    const wildBlock = sim.state.blocks.get(wild)!;
    const landslideAt = wildBlock.landslideAt;

    wildBlock.landslideAt = sim.state.tick;

    const spoiled = sim.validate({ type: 'ChopBlock', block: wild })!;

    expectTranslatable(spoiled, 'ChopBlock on spoil');
    expect(spoiled.message?.key).toBe('rejections.dig.spoilFirst');
    wildBlock.landslideAt = landslideAt;
  });
});
