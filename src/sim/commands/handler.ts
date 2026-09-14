/**
 * The shape every command file exports (§4.2). `validate` returns a typed
 * `Rejection` the UI shows verbatim, or `null` to proceed; `apply` may assume
 * validation passed.
 */

import type { SimContext } from '../state.ts';
import type { Command, Rejection } from '../types.ts';

export interface CommandHandler<C extends Command = Command> {
  validate(ctx: SimContext, command: C): Rejection | null;
  apply(ctx: SimContext, command: C): void;
}

export function reject(code: Rejection['code'], reason: string): Rejection {
  return { ok: false, code, reason };
}
