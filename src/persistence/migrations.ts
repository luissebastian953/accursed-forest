/**
 * Save migrations (§7): an ordered list of `schema N → N+1` steps applied to
 * the raw JSON before it is validated and decoded. A save from a newer schema
 * than this build knows is refused with a clear error, never half-read.
 */

import { encodeTypedArray } from '@shared/base64';
import { SLOTS_PER_BLOCK } from '@sim/balance/world';

import { CURRENT_SCHEMA, SaveError } from './schema.ts';

export interface RawSave {
  manifest: Record<string, unknown>;
  chunks: Map<string, Record<string, unknown>>;
}

export interface Migration {
  /** The schema this step upgrades from; it produces `from + 1`. */
  from: number;
  up(save: RawSave): void;
}

/** Append here whenever `CURRENT_SCHEMA` is bumped. */
export const MIGRATIONS: readonly Migration[] = [
  {
    // M1b: the economy learned to sell. A v1 save has never sold anything.
    from: 1,
    up(save) {
      const head = save.manifest['head'] as { economy?: Record<string, unknown> } | undefined;
      const economy = head?.economy;
      if (!economy) throw new SaveError('corrupt', 'v1 manifest has no economy');
      economy['tbsPriceHistory'] ??= [economy['tbsPrice']];
      economy['tbsPending'] ??= 0;
      economy['soldKgTotal'] ??= 0;
    },
  },
  {
    // M1d: pests. A v2 palm has never been infected and has no trenches.
    from: 2,
    up(save) {
      const cleanSince = encodeTypedArray(new Int32Array(SLOTS_PER_BLOCK).fill(-1));
      const noTrench = encodeTypedArray(new Uint8Array(SLOTS_PER_BLOCK));
      for (const chunk of save.chunks.values()) {
        const palms = chunk['palms'];
        if (!Array.isArray(palms)) continue;
        for (const entry of palms) {
          if (!Array.isArray(entry) || entry.length < 2) continue;
          const arrays = entry[1] as Record<string, unknown>;
          arrays['ganodermaSince'] ??= cleanSince;
          arrays['trenched'] ??= noTrench;
        }
      }
    },
  },
];

/**
 * Bring `save` up to `target` in place. Exposed with injectable steps so the
 * chain itself can be tested without a real schema bump.
 */
export function migrate(
  save: RawSave,
  migrations: readonly Migration[] = MIGRATIONS,
  target: number = CURRENT_SCHEMA,
): void {
  const found = save.manifest['schema'];
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 1) {
    throw new SaveError('corrupt', `manifest has no valid schema number (got ${String(found)})`);
  }
  if (found > target) {
    throw new SaveError(
      'newerSchema',
      `this save was written by a newer version (schema ${found}; this build reads up to ${target})`,
    );
  }

  let schema = found;
  while (schema < target) {
    const step = migrations.find((m) => m.from === schema);
    if (!step) {
      throw new SaveError('corrupt', `no migration from schema ${schema} to ${schema + 1}`);
    }
    step.up(save);
    schema += 1;
    save.manifest['schema'] = schema;
  }
}
