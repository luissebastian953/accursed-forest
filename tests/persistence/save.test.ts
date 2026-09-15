import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import { describe, expect, it } from 'vitest';

import { Autosave } from '@persistence/autosave.ts';
import { DirtyChunks, SaveSlot } from '@persistence/chunks.ts';
import { MIGRATIONS, migrate, type Migration, type RawSave } from '@persistence/migrations.ts';
import { CURRENT_SCHEMA, KEY_PREFIX, SaveError, chunkKeyOf } from '@persistence/schema.ts';
import { memoryStorage } from '@persistence/storage.ts';
import { BIOMES } from '@sim/balance/biomes.ts';
import { SLOTS_PER_BLOCK, WORLD } from '@sim/balance/world.ts';
import { createSim, restoreSim, type Sim } from '@sim/index.ts';
import type { BlockId, SimState } from '@sim/types.ts';

const APP = '0.1.0-test';
const NOW = (): string => '2026-09-15T00:00:00.000Z';

function slotFor(storage = memoryStorage(), slot = 'slot0', migrations?: readonly Migration[]) {
  return new SaveSlot(
    migrations
      ? { storage, slot, appVersion: APP, now: NOW, migrations }
      : { storage, slot, appVersion: APP, now: NOW },
  );
}

/** A run with something in it: Kopdes, stock, two chopped and planted blocks, a purchase, 400 days. */
function workedEstate(seed = 42): Sim {
  const sim = createSim(seed);
  const { state, world } = sim;

  expect(sim.dispatch({ type: 'PlaceKopdes', block: state.worldGen.kopdesBlock })).toEqual({
    ok: true,
  });
  expect(sim.dispatch({ type: 'BuyItem', item: 'bibit', quantity: 2 * SLOTS_PER_BLOCK })).toEqual({
    ok: true,
  });

  const wild: BlockId[] = [];
  for (const block of state.blocks.values()) {
    if (block.owned && block.phase === 'wild' && BIOMES[block.biome].clearable) wild.push(block.id);
  }
  expect(sim.dispatch({ type: 'ChopBlock', block: wild[0]! })).toEqual({ ok: true });
  expect(sim.dispatch({ type: 'ChopBlock', block: wild[1]! })).toEqual({ ok: true });

  for (let i = 0; i < 50; i++) sim.tick();
  for (const id of [wild[0]!, wild[1]!]) {
    if (state.blocks.get(id)!.phase === 'cleared') {
      expect(sim.dispatch({ type: 'PlantBlock', block: id, species: 'palm' })).toEqual({
        ok: true,
      });
    }
  }

  // Buy one neighbour so a block outside the start square is diverged too.
  outer: for (const block of [...state.blocks.values()]) {
    if (!block.owned) continue;
    const [x, y] = world.toXY(block.id);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny)) continue;
      const id = world.toId(nx, ny);
      if (!state.blocks.get(id)?.owned && world.generated(nx, ny).forSale) {
        expect(sim.dispatch({ type: 'BuyBlock', block: id })).toEqual({ ok: true });
        break outer;
      }
    }
  }

  for (let i = 0; i < 350; i++) sim.tick();
  return sim;
}

/** Rewrite every stored chunk without the schema-3 palm arrays. */
function stripPalmFields(storage: ReturnType<typeof memoryStorage>, chunkKeys: string[]): void {
  for (const chunkKey of chunkKeys) {
    const storageKey = `${KEY_PREFIX}:save:slot0:c:${chunkKey}`;
    const chunk = JSON.parse(decompressFromUTF16(storage.get(storageKey)!)!) as {
      palms: [number, Record<string, unknown>][];
    };
    for (const [, arrays] of chunk.palms) {
      delete arrays['ganodermaSince'];
      delete arrays['trenched'];
    }
    storage.map.set(storageKey, compressToUTF16(JSON.stringify(chunk)));
  }
}

function fingerprint(state: SimState): string {
  const blocks = [...state.blocks.entries()].sort(([a], [b]) => a - b);
  const palms = [...state.palms.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, p]) => [
      id,
      Array.from(p.plantedAt),
      Array.from(p.growth),
      Array.from(p.health),
      Array.from(p.ganoderma),
      Array.from(p.yieldAcc),
    ]);
  const { active: _active, version: _version, ...rest } = state;
  return JSON.stringify({ ...rest, blocks, palms });
}

describe('save round-trip (§7)', () => {
  it('load(save(state)) is the same state', () => {
    const sim = workedEstate();
    const slot = slotFor();

    slot.save(sim.state);
    const loaded = slot.load();

    expect(fingerprint(loaded)).toBe(fingerprint(sim.state));
  });

  it('a restored sim continues identically — the RNG position survives the trip', () => {
    const sim = workedEstate();
    const slot = slotFor();
    slot.save(sim.state);

    const restored = restoreSim(slot.load());
    for (let i = 0; i < 300; i++) {
      sim.tick();
      restored.tick();
    }
    expect(fingerprint(restored.state)).toBe(fingerprint(sim.state));
  });

  it('stores only diverged blocks, never the world', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    slotFor(storage).save(sim.state);

    let total = 0;
    for (const value of storage.map.values()) total += value.length * 2; // UTF-16 bytes
    // A 60-odd block estate with two planted blocks: well under 100 KB.
    expect(total).toBeLessThan(100_000);

    const manifest = JSON.parse(storage.get(`${KEY_PREFIX}:save:slot0`)!) as { chunks: string[] };
    const expectedChunks = new Set(
      [...sim.state.blocks.keys()].map((id) => chunkKeyOf(sim.state.width, id)),
    );
    expect(new Set(manifest.chunks)).toEqual(expectedChunks);
    expect(manifest.chunks.length).toBeLessThan((WORLD.width / WORLD.chunkSide) ** 2 / 4);
  });

  it('uses the documented key layout', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    slotFor(storage, 'slot1').save(sim.state);

    const keys = storage.keys();
    expect(keys).toContain('accursed-forest:save:slot1');
    expect(keys.filter((k) => /^accursed-forest:save:slot1:c:\d+:\d+$/.test(k)).length).toBe(
      keys.length - 1,
    );
  });

  it('exists / delete', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    expect(slot.exists()).toBe(false);
    slot.save(sim.state);
    expect(slot.exists()).toBe(true);
    slot.delete();
    expect(slot.exists()).toBe(false);
    expect(storage.keys()).toEqual([]);
  });

  it('two slots do not interfere', () => {
    const storage = memoryStorage();
    const a = workedEstate(1);
    const b = workedEstate(2);
    slotFor(storage, 'slot0').save(a.state);
    slotFor(storage, 'slot1').save(b.state);
    expect(fingerprint(slotFor(storage, 'slot0').load())).toBe(fingerprint(a.state));
    expect(fingerprint(slotFor(storage, 'slot1').load())).toBe(fingerprint(b.state));
  });
});

describe('dirty chunks (§7)', () => {
  it('a partial save rewrites only the dirty chunks plus the manifest', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);

    const full = slot.save(sim.state);
    expect(full.length).toBeGreaterThan(2);
    storage.writes.length = 0;

    const dirty = new DirtyChunks();
    const someBlock = [...sim.state.palms.keys()][0]!;
    dirty.mark(sim.state.width, someBlock);
    const written = slot.save(sim.state, dirty.take());

    expect(written).toEqual([
      slot.chunkStorageKey(chunkKeyOf(sim.state.width, someBlock)),
      slot.manifestKey,
    ]);
    expect(storage.writes).toEqual(written);
  });

  it('an empty dirty set writes just the manifest', () => {
    const sim = workedEstate();
    const slot = slotFor();
    slot.save(sim.state);
    expect(slot.save(sim.state, new Set())).toEqual([slot.manifestKey]);
  });

  it('marking the same chunk twice is one entry; take() empties; restore() puts back', () => {
    const dirty = new DirtyChunks();
    dirty.mark(64, 0);
    dirty.mark(64, 1); // same 4x4 chunk
    dirty.mark(64, 64 * 8); // a different chunk
    expect(dirty.size).toBe(2);
    const taken = dirty.take();
    expect(dirty.size).toBe(0);
    dirty.restore(taken);
    expect(dirty.size).toBe(2);
  });
});

describe('failure modes (§7)', () => {
  it('a missing slot is a clear error', () => {
    const slot = slotFor();
    expect(() => slot.load()).toThrow(SaveError);
    try {
      slot.load();
    } catch (error) {
      expect((error as SaveError).code).toBe('missing');
    }
  });

  it('refuses a save from a newer schema instead of half-reading it', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    slot.save(sim.state);

    const manifest = JSON.parse(storage.get(slot.manifestKey)!) as { schema: number };
    manifest.schema = CURRENT_SCHEMA + 5;
    storage.map.set(slot.manifestKey, JSON.stringify(manifest));

    try {
      slot.load();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SaveError);
      expect((error as SaveError).code).toBe('newerSchema');
      expect((error as SaveError).message).toMatch(/newer version/);
    }
  });

  it('a corrupt chunk fails loudly', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    slot.save(sim.state);

    const chunkKey = storage.keys().find((k) => k.includes(':c:'))!;
    storage.map.set(chunkKey, 'not compressed json at all');
    expect(() => slot.load()).toThrow(SaveError);
  });

  it('a chunk that fails validation fails loudly, naming the problem', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    slot.save(sim.state);

    const manifest = JSON.parse(storage.get(slot.manifestKey)!) as {
      head: { economy: { cash: unknown } };
    };
    manifest.head.economy.cash = 'lots';
    storage.map.set(slot.manifestKey, JSON.stringify(manifest));

    try {
      slot.load();
      expect.unreachable();
    } catch (error) {
      expect((error as SaveError).code).toBe('corrupt');
      expect((error as SaveError).message).toMatch(/manifest/);
    }
  });

  it('a manifest that lists a chunk that is gone is corrupt, not silently smaller', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    slot.save(sim.state);
    const chunkKey = storage.keys().find((k) => k.includes(':c:'))!;
    storage.remove(chunkKey);
    expect(() => slot.load()).toThrow(/missing/);
  });
});

describe('migrations (§7)', () => {
  const raw = (schema: number): RawSave => ({ manifest: { schema }, chunks: new Map() });

  it('runs every step from the file schema to the target, in order', () => {
    const order: number[] = [];
    const steps: Migration[] = [
      {
        from: 2,
        up: (s) => {
          order.push(2);
          s.manifest['b'] = true;
        },
      },
      {
        from: 1,
        up: (s) => {
          order.push(1);
          s.manifest['a'] = true;
        },
      },
    ];
    const save = raw(1);
    migrate(save, steps, 3);
    expect(order).toEqual([1, 2]);
    expect(save.manifest).toEqual({ schema: 3, a: true, b: true });
  });

  it('is a no-op at the current schema', () => {
    const save = raw(CURRENT_SCHEMA);
    migrate(save);
    expect(save.manifest['schema']).toBe(CURRENT_SCHEMA);
  });

  it('a gap in the chain is an error, not a skipped step', () => {
    const steps: Migration[] = [{ from: 2, up: () => {} }];
    expect(() => migrate(raw(1), steps, 3)).toThrow(/no migration from schema 1/);
  });

  it('a newer schema is refused before any step runs', () => {
    let ran = false;
    const steps: Migration[] = [
      {
        from: 1,
        up: () => {
          ran = true;
        },
      },
    ];
    expect(() => migrate(raw(5), steps, 2)).toThrow(SaveError);
    expect(ran).toBe(false);
  });

  it('a save slot applies its migrations on load: a v1 save opens in the current build', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    slotFor(storage).save(sim.state);

    // Rewind to what M1a wrote: no sales fields, no pest arrays, schema 1.
    const key = `${KEY_PREFIX}:save:slot0`;
    const manifest = JSON.parse(storage.get(key)!) as {
      schema: number;
      head: { economy: Record<string, unknown> };
      chunks: string[];
    };
    manifest.schema = 1;
    delete manifest.head.economy['tbsPriceHistory'];
    delete manifest.head.economy['tbsPending'];
    delete manifest.head.economy['soldKgTotal'];
    storage.map.set(key, JSON.stringify(manifest));
    stripPalmFields(storage, manifest.chunks);

    const loaded = slotFor(storage).load();
    expect(loaded.economy.tbsPending).toBe(0);
    expect(loaded.economy.soldKgTotal).toBe(0);
    expect(loaded.economy.tbsPriceHistory).toEqual([loaded.economy.tbsPrice]);
    for (const palms of loaded.palms.values()) {
      expect(palms.ganodermaSince.length).toBe(SLOTS_PER_BLOCK);
      expect(palms.ganodermaSince.every((v) => v === -1)).toBe(true);
      expect(palms.trenched.every((v) => v === 0)).toBe(true);
    }
    // Everything the v1 save did carry survives untouched.
    expect(loaded.economy.cash).toBe(sim.state.economy.cash);
    expect(loaded.tick).toBe(sim.state.tick);
    expect(loaded.palms.size).toBe(sim.state.palms.size);
  });

  it('a v2 save (M1b/M1c) opens in the current build with clean palms', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    slotFor(storage).save(sim.state);
    const key = `${KEY_PREFIX}:save:slot0`;
    const manifest = JSON.parse(storage.get(key)!) as { schema: number; chunks: string[] };
    manifest.schema = 2;
    storage.map.set(key, JSON.stringify(manifest));
    stripPalmFields(storage, manifest.chunks);

    const loaded = slotFor(storage).load();
    expect(loaded.palms.size).toBe(sim.state.palms.size);
    for (const [id, palms] of loaded.palms) {
      expect(Array.from(palms.growth)).toEqual(Array.from(sim.state.palms.get(id)!.growth));
      expect(palms.ganodermaSince.every((v) => v === -1)).toBe(true);
    }
  });

  it('a v3 save (M1d/M1e) opens in the current build with an empty letter count', () => {
    const sim = workedEstate();
    for (let i = 0; i < 200; i++) sim.tick();
    const storage = memoryStorage();
    slotFor(storage).save(sim.state);
    const key = `${KEY_PREFIX}:save:slot0`;
    const manifest = JSON.parse(storage.get(key)!) as {
      schema: number;
      head: { society: { lettersReceived?: number; news: { key?: string }[] } };
    };
    manifest.schema = 3;
    delete manifest.head.society.lettersReceived;
    for (const item of manifest.head.society.news) delete item.key;
    storage.map.set(key, JSON.stringify(manifest));

    const loaded = slotFor(storage).load();
    expect(loaded.society.lettersReceived).toBe(0);
    expect(loaded.society.news.length).toBe(sim.state.society.news.length);
    expect(loaded.society.news.every((n) => n.key === 'legacy')).toBe(true);
  });

  it('a v4 save (M1f) opens with its books rebuilt from the ledger and the news', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    slotFor(storage).save(sim.state);
    const key = `${KEY_PREFIX}:save:slot0`;
    const manifest = JSON.parse(storage.get(key)!) as {
      schema: number;
      head: {
        society: Record<string, unknown>;
        run: Record<string, unknown>;
        economy: { ledger: { kind: string; note?: string }[] };
      };
    };
    manifest.schema = 4;
    delete manifest.head.society['operatingBanUntil'];
    manifest.head.run = { startedAt: 0, yearSnapshots: [], insolventFor: 0 };
    for (const entry of manifest.head.economy.ledger)
      if (entry.kind === 'capital') entry.kind = 'purchase';
    storage.map.set(key, JSON.stringify(manifest));

    const loaded = slotFor(storage).load();
    expect(loaded.society.operatingBanUntil).toBe(-1);
    expect(loaded.run.sandbox).toBe(false);
    expect(loaded.run.lastBurnAt).toBe(-1);
    expect('yearSnapshots' in loaded.run).toBe(false);
    // Land and the Kopdes go back to being capital, and do not count against profit.
    expect(loaded.economy.ledger.map((e) => e.kind)).toEqual(
      sim.state.economy.ledger.map((e) => e.kind),
    );
    expect(loaded.run.yearProfit + loaded.run.profitTotal).toBe(
      sim.state.economy.ledger
        .filter((e) => e.kind !== 'capital')
        .reduce((a, e) => a + e.amount, 0),
    );
  });

  it('a snapshot slot compresses its manifest and still loads', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const plain = slotFor(storage, 'slot0');
    const snapshot = new SaveSlot({
      storage,
      slot: 'year:2',
      appVersion: APP,
      now: NOW,
      compressManifest: true,
    });
    plain.save(sim.state);
    snapshot.save(sim.state);

    const plainText = storage.get(plain.manifestKey)!;
    const packed = storage.get(snapshot.manifestKey)!;
    expect(plainText.startsWith('{')).toBe(true);
    expect(packed.length).toBeLessThan(plainText.length / 3);
    expect(fingerprint(snapshot.load())).toBe(fingerprint(sim.state));
  });

  it('an ended run survives the trip: ending, chronicle, year summaries', () => {
    const sim = workedEstate();
    for (let i = 0; i < 400; i++) sim.tick();
    sim.state.economy.cash = -1;
    for (let i = 0; i < 100 && !sim.state.run.ending; i++) sim.tick();
    expect(sim.state.run.ending).toBe('bankrupt');
    expect(sim.state.run.years.length).toBeGreaterThan(0);

    const slot = slotFor();
    slot.save(sim.state);
    expect(fingerprint(slot.load())).toBe(fingerprint(sim.state));
  });

  it('the real migration list covers every schema from 1 to current', () => {
    const covered = new Set(MIGRATIONS.map((m) => m.from));
    for (let schema = 1; schema < CURRENT_SCHEMA; schema++) expect(covered.has(schema)).toBe(true);
  });
});

describe('autosave (§7)', () => {
  it('saves every N ticks, fully the first time and dirty-only after', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    const dirty = new DirtyChunks();
    const saved: string[][] = [];
    const autosave = new Autosave({
      slot,
      getState: () => sim.state,
      dirty,
      everyTicks: 30,
      onSaved: (k) => saved.push(k),
    });

    autosave.onTick(29);
    expect(saved).toEqual([]);

    autosave.onTick(30);
    expect(saved.length).toBe(1);
    expect(saved[0]!.length).toBeGreaterThan(2); // full write

    const someBlock = [...sim.state.palms.keys()][0]!;
    dirty.mark(sim.state.width, someBlock);
    autosave.onTick(60);
    expect(saved.length).toBe(2);
    expect(saved[1]).toEqual([
      slot.chunkStorageKey(chunkKeyOf(sim.state.width, someBlock)),
      slot.manifestKey,
    ]);
    expect(dirty.size).toBe(0);
  });

  it('does not save at tick 0', () => {
    const sim = createSim(1);
    const saved: string[][] = [];
    const autosave = new Autosave({
      slot: slotFor(),
      getState: () => sim.state,
      dirty: new DirtyChunks(),
      onSaved: (k) => saved.push(k),
    });
    autosave.onTick(0);
    expect(saved).toEqual([]);
  });

  it('a failed write reports the error and keeps the dirty set for next time', () => {
    const sim = workedEstate();
    const storage = memoryStorage();
    const slot = slotFor(storage);
    const dirty = new DirtyChunks();
    const errors: unknown[] = [];
    const autosave = new Autosave({
      slot,
      getState: () => sim.state,
      dirty,
      onError: (e) => errors.push(e),
    });

    expect(autosave.saveNow()).toBe(true);

    dirty.mark(sim.state.width, [...sim.state.palms.keys()][0]!);
    storage.failWrites = true;
    expect(autosave.saveNow()).toBe(false);
    expect(errors.length).toBe(1);
    expect((errors[0] as Error).name).toBe('QuotaError');
    expect(dirty.size).toBe(1);

    storage.failWrites = false;
    expect(autosave.saveNow()).toBe(true);
    expect(dirty.size).toBe(0);
  });
});
