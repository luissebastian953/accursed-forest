/**
 * Key-value storage adapter (§7).
 *
 * Everything persistence writes goes through this interface, so moving from
 * `localStorage` to IndexedDB is a new adapter, not a change to callers.
 * `QuotaError` is the one failure the game must handle visibly: the HUD shows a
 * warning and offers an export rather than losing the save silently.
 */

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** All keys, in no particular order. */
  keys(): string[];
}

export class QuotaError extends Error {
  override readonly name = 'QuotaError';

  constructor(key: string, cause: unknown) {
    super(`storage quota exceeded writing "${key}"`, { cause });
  }
}

function isQuotaException(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/** Wraps `window.localStorage` (or any Web Storage object). */
export function localStorageAdapter(backing: Storage = window.localStorage): KeyValueStorage {
  return {
    get: (key) => backing.getItem(key),
    set(key, value) {
      try {
        backing.setItem(key, value);
      } catch (error) {
        if (isQuotaException(error)) throw new QuotaError(key, error);
        throw error;
      }
    },
    remove: (key) => backing.removeItem(key),
    keys() {
      const out: string[] = [];
      for (let i = 0; i < backing.length; i++) {
        const key = backing.key(i);
        if (key !== null) out.push(key);
      }
      return out;
    },
  };
}

export interface MemoryStorage extends KeyValueStorage {
  /** Every `set` call so far, in order; tests assert on what was written. */
  readonly writes: string[];
  /** Simulate a full disk: every `set` after this throws `QuotaError`. */
  failWrites: boolean;
  /** Raw view for tampering in tests. */
  readonly map: Map<string, string>;
}

/** In-memory adapter for tests and for a browser with storage disabled. */
export function memoryStorage(): MemoryStorage {
  const map = new Map<string, string>();
  const writes: string[] = [];
  const storage: MemoryStorage = {
    map,
    writes,
    failWrites: false,
    get: (key) => map.get(key) ?? null,
    set(key, value) {
      if (storage.failWrites) throw new QuotaError(key, undefined);
      map.set(key, value);
      writes.push(key);
    },
    remove: (key) => {
      map.delete(key);
    },
    keys: () => [...map.keys()],
  };
  return storage;
}
