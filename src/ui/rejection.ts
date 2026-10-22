import type { Rejection } from '@sim/types';

import { t } from '../i18n/index.ts';

import { formatRp } from './format.ts';

/** Why a button is greyed out, in the player's language; the sim's English when the catalog has no line. */
export function rejectionText(rejection: Rejection | null | undefined): string | null {
  if (!rejection) return null;
  if (!rejection.message) return rejection.reason;

  const vars: Record<string, string | number> = {};

  for (const [name, value] of Object.entries(rejection.message.vars ?? {})) {
    vars[name] =
      (name === 'rp' || name === 'cash') && typeof value === 'number' ? formatRp(value) : value;
  }

  // The key already carries its `rejections.` namespace: the sim names the catalog line in full.
  return t(rejection.message.key, vars);
}
