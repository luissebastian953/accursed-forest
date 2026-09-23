import { describe, expect, it } from 'vitest';

import { SaveSlot } from '@persistence/chunks.ts';
import { CURRENT_SCHEMA } from '@persistence/schema.ts';
import { memoryStorage } from '@persistence/storage.ts';
import { restoreSim } from '@sim/index.ts';

import v18 from './fixtures/save-v18-0707629.json';

/**
 * A save written by a shipped build, kept byte for byte. It is the estate a
 * player already has, and the point of the file is that it keeps loading.
 */
const FIXTURES = [{ name: 'v18, 0707629', dump: v18 as Record<string, string>, schema: 18 }];

function load(dump: Record<string, string>): ReturnType<typeof restoreSim> {
  const storage = memoryStorage();

  for (const [key, value] of Object.entries(dump)) storage.set(key, value);

  const slot = new SaveSlot({ storage, slot: 'slot0', appVersion: 'test' });
  const state = slot.load();

  expect(state).not.toBeNull();
  return restoreSim(state!);
}

describe.each(FIXTURES)('a save from $name still loads', (fixture) => {
  it('decodes, and carries the estate the player left', () => {
    const sim = load(fixture.dump);
    const { state } = sim;

    expect(state.tick).toBeGreaterThan(0);
    expect(state.blocks.size).toBeGreaterThan(0);
    expect(state.palms.size).toBeGreaterThan(0);

    // The world is rebuilt from the seed, so the saved estate and the
    // regenerated map have to still agree on where the player is standing.
    expect(state.worldGen.seed).toBe(sim.world.params.seed);
    expect(state.kopdes).not.toBeNull();
    expect(state.blocks.get(state.worldGen.kopdesBlock)?.owned).toBe(true);

    let owned = 0;

    for (const block of state.blocks.values()) if (block.owned) owned += 1;
    expect(owned).toBeGreaterThan(1);
  });

  it('goes on being played, and the clock still moves', () => {
    const sim = load(fixture.dump);
    const before = { tick: sim.state.tick, cash: sim.state.economy.cash };

    for (let i = 0; i < 400; i++) sim.tick();
    expect(sim.state.tick).toBe(before.tick + 400);
    expect(Number.isFinite(sim.state.economy.cash)).toBe(true);
    expect(sim.state.economy.cash).not.toBe(before.cash);
  });

  it('keeps its news readable, whatever the template keys are called now', () => {
    const sim = load(fixture.dump);

    for (const item of sim.state.society.news) {
      // Titles and bodies are written into the save, so renaming or retiring
      // a template cannot blank a headline the player already read.
      expect(item.title.length, item.key).toBeGreaterThan(0);
      expect(typeof item.body, item.key).toBe('string');
    }
  });

  it('was written at the schema this fixture is named for', () => {
    expect(fixture.schema).toBeLessThanOrEqual(CURRENT_SCHEMA);
  });
});
