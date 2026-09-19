import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

import type { BlockId, SimState } from '@sim/types';

import { MIGRATIONS, migrate, type Migration, type RawSave } from './migrations.ts';
import {
  KEY_PREFIX,
  SaveError,
  chunkKeyOf,
  deserializeState,
  serializeState,
  type SaveChunk,
} from './schema.ts';
import type { KeyValueStorage } from './storage.ts';

export interface SaveSlotOptions {
  storage: KeyValueStorage;
  /** `slot0`, `slot1`, `year:12`, … */
  slot: string;
  appVersion: string;
  /** Injected for tests; production uses the real list. */
  migrations?: readonly Migration[];
  /** Injected so tests and the sim stay clock-free. */
  now?: () => string;
  /** Compress the manifest as well as the chunks (year snapshots). */
  compressManifest?: boolean;
}

export class SaveSlot {
  private readonly storage: KeyValueStorage;
  readonly slot: string;
  private readonly appVersion: string;
  private readonly migrations: readonly Migration[];
  private readonly now: () => string;
  private readonly compressManifest: boolean;

  constructor(options: SaveSlotOptions) {
    this.storage = options.storage;
    this.slot = options.slot;
    this.appVersion = options.appVersion;
    this.migrations = options.migrations ?? MIGRATIONS;
    this.now = options.now ?? (() => new Date().toISOString());
    this.compressManifest = options.compressManifest ?? false;
  }

  get manifestKey(): string {
    return `${KEY_PREFIX}:save:${this.slot}`;
  }

  chunkStorageKey(chunkKey: string): string {
    return `${this.manifestKey}:c:${chunkKey}`;
  }

  exists(): boolean {
    return this.storage.get(this.manifestKey) !== null;
  }

  /**
   * Write the manifest and the given chunks. `'all'` rewrites every chunk;
   * the first save, and the save after a load, must do this. Returns the
   * storage keys written, chunks first, manifest last.
   */
  save(state: SimState, dirty: ReadonlySet<string> | 'all' = 'all'): string[] {
    const { manifest, chunks } = serializeState(state, this.appVersion, this.now());
    const written: string[] = [];

    for (const [chunkKey, chunk] of chunks) {
      if (dirty !== 'all' && !dirty.has(chunkKey)) continue;

      const key = this.chunkStorageKey(chunkKey);

      this.storage.set(key, compressToUTF16(JSON.stringify(chunk)));
      written.push(key);
    }

    const json = JSON.stringify(manifest);

    this.storage.set(this.manifestKey, this.compressManifest ? compressToUTF16(json) : json);
    written.push(this.manifestKey);
    return written;
  }

  /** Read, migrate, validate and decode. Throws `SaveError`. */
  load(): SimState {
    const raw = this.readRaw();

    migrate(raw, this.migrations);
    return deserializeState(raw.manifest, raw.chunks.values());
  }

  private readRaw(): RawSave {
    const manifestText = this.storage.get(this.manifestKey);

    if (manifestText === null) throw new SaveError('missing', `no save in slot "${this.slot}"`);

    const manifestJson = manifestText.startsWith('{')
      ? manifestText
      : decompressFromUTF16(manifestText);

    if (!manifestJson) throw new SaveError('corrupt', 'manifest did not decompress');

    const manifest = parseJson(manifestJson, 'manifest');
    const listed = manifest['chunks'];

    if (!Array.isArray(listed)) throw new SaveError('corrupt', 'manifest has no chunk list');

    const chunks = new Map<string, Record<string, unknown>>();

    for (const chunkKey of listed) {
      if (typeof chunkKey !== 'string')
        throw new SaveError('corrupt', 'manifest chunk list is not strings');

      const text = this.storage.get(this.chunkStorageKey(chunkKey));

      if (text === null)
        throw new SaveError('corrupt', `manifest lists chunk ${chunkKey} but it is missing`);

      const json = decompressFromUTF16(text);

      if (!json) throw new SaveError('corrupt', `chunk ${chunkKey} did not decompress`);
      chunks.set(chunkKey, parseJson(json, `chunk ${chunkKey}`));
    }

    return { manifest, chunks };
  }

  /** Remove the manifest and every chunk key it lists (plus any strays). */
  delete(): void {
    const prefix = `${this.manifestKey}:c:`;

    for (const key of this.storage.keys()) {
      if (key === this.manifestKey || key.startsWith(prefix)) this.storage.remove(key);
    }
  }
}

function parseJson(text: string, what: string): Record<string, unknown> {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new SaveError('corrupt', `${what} is not JSON`, { cause: error });
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SaveError('corrupt', `${what} is not an object`);
  }

  return value as Record<string, unknown>;
}

/**
 * Tracks which chunks changed since the last write. `render/sync.ts` and the
 * app mark blocks from sim events; autosave takes the set when it writes.
 */
export class DirtyChunks {
  private set = new Set<string>();

  mark(width: number, block: BlockId): void {
    this.set.add(chunkKeyOf(width, block));
  }

  get size(): number {
    return this.set.size;
  }

  /** Hand over the dirty set and start clean. */
  take(): Set<string> {
    const out = this.set;

    this.set = new Set();
    return out;
  }

  /** Put a taken set back; a save that failed must not lose its dirt. */
  restore(keys: ReadonlySet<string>): void {
    for (const key of keys) this.set.add(key);
  }
}

export type { SaveChunk };
