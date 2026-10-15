import type { SimContext } from '../state.ts';
import type { Command, Rejection, RejectionMessage, Tick } from '../types.ts';

export interface CommandHandler<C extends Command = Command> {
  validate(ctx: SimContext, command: C): Rejection | null;
  apply(ctx: SimContext, command: C): void;
}

export function reject(
  code: Rejection['code'],
  reason: string,
  message?: RejectionMessage,
): Rejection {
  return message ? { ok: false, code, reason, message } : { ok: false, code, reason };
}

/** The `{year}` and `{day}` a sentence prints for a tick, counted from one. */
export function dateVars(tick: Tick): { year: number; day: number } {
  return { year: Math.floor(tick / 360) + 1, day: (tick % 360) + 1 };
}
