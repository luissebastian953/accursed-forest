/**
 * Save migrations (§7): an ordered list of `schema N → N+1` steps applied to
 * the raw JSON before it is validated and decoded. A save from a newer schema
 * than this build knows is refused with a clear error, never half-read.
 */

import { encodeTypedArray } from '@shared/base64';
import { ECONOMY } from '@sim/balance/prices';
import { SLOTS_PER_BLOCK } from '@sim/balance/world';
import { skyFor } from '@sim/systems/weather';

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
  {
    // M1f: news and authority. No v3 save ever published a headline or received a letter.
    from: 3,
    up(save) {
      const head = save.manifest['head'] as { society?: Record<string, unknown> } | undefined;
      const society = head?.society;
      if (!society) throw new SaveError('corrupt', 'v3 manifest has no society');
      society['lettersReceived'] ??= 0;
      const news = society['news'];
      if (Array.isArray(news)) {
        for (const item of news) {
          if (item && typeof item === 'object')
            (item as Record<string, unknown>)['key'] ??= 'legacy';
        }
      }
    },
  },
  {
    // M1g: endings. Rebuild what the books can from what a v4 save kept: the
    // ledger (capped, so profit is a floor), the command log's last burn, and
    // the warnings in the news for the chronicle.
    from: 4,
    up(save) {
      const head = save.manifest['head'] as
        | {
            tick?: number;
            society?: Record<string, unknown>;
            run?: Record<string, unknown>;
            economy?: Record<string, unknown>;
            commandLog?: { tick: number; command: { type: string } }[];
          }
        | undefined;
      const run = head?.run;
      const society = head?.society;
      if (!head || !run || !society) throw new SaveError('corrupt', 'v4 manifest has no run');

      const tick = head.tick ?? 0;
      const yearStart = tick - (tick % 360);
      let yearProfit = 0;
      let profitTotal = 0;
      const ledger = (head.economy?.['ledger'] ?? []) as {
        tick: number;
        kind: string;
        amount: number;
      }[];
      for (const entry of ledger) {
        if (
          entry.kind === 'purchase' &&
          /^(land|Kopdes|irrigation|drainage)/.test(String((entry as { note?: string }).note ?? ''))
        ) {
          entry.kind = 'capital';
          continue;
        }
        if (entry.tick > yearStart) yearProfit += entry.amount;
        else profitTotal += entry.amount;
      }
      const burns = (head.commandLog ?? []).filter((r) => r.command.type === 'BurnBlock');
      const news = (society['news'] ?? []) as {
        tick: number;
        lane: string;
        severity: string;
        title: string;
      }[];
      const cash = Number(head.economy?.['cash'] ?? 0);

      delete run['yearSnapshots'];
      Object.assign(run, {
        insolventFor: run['insolventFor'] ?? 0,
        yearProfit,
        profitTotal,
        lastBurnAt: burns.at(-1)?.tick ?? -1,
        stats: {
          burns: burns.length,
          blocksBurned: burns.length,
          neighbourBlocksBurned: 0,
          palmsLost: 0,
          disasters: 0,
          forestChopped: 0,
          forestPlanted: 0,
          settled: 0,
          lowestCash: Math.min(cash, ECONOMY.startingCash),
        },
        years: [],
        chronicle: news
          .filter((n) => n.severity === 'warning' || n.severity === 'critical')
          .map((n) => ({ tick: n.tick, lane: n.lane, severity: n.severity, title: n.title })),
        sandbox: false,
      });
      society['operatingBanUntil'] ??= -1;
    },
  },
  {
    // M1 balance pass: the Kopdes crew can pick for you; an old one did not.
    from: 5,
    up(save) {
      const head = save.manifest['head'] as { kopdes?: Record<string, unknown> | null } | undefined;
      if (head?.kopdes) head.kopdes['autoHarvest'] ??= false;
    },
  },
  {
    // M1 weather pass: the sky follows from the day's rain, so an old save
    // can be read off its own weather.
    from: 6,
    up(save) {
      const head = save.manifest['head'] as { weather?: Record<string, unknown> } | undefined;
      const weather = head?.weather;
      if (!weather) throw new SaveError('corrupt', 'v6 manifest has no weather');
      weather['sky'] ??= skyFor(Number(weather['rain'] ?? 0));
    },
  },
  {
    // Mobs: an old estate has nobody on it yet.
    from: 7,
    up(save) {
      const head = save.manifest['head'] as Record<string, unknown> | undefined;
      if (!head) throw new SaveError('corrupt', 'v7 manifest has no head');
      head['mobs'] ??= [];
      head['nextMobId'] ??= 1;
    },
  },
  {
    // Weather spells: an old sky is re-read tomorrow.
    from: 8,
    up(save) {
      const head = save.manifest['head'] as { weather?: Record<string, unknown> } | undefined;
      if (!head?.weather) throw new SaveError('corrupt', 'v8 manifest has no weather');
      head.weather['skyUntil'] ??= 0;
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
