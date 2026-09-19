import type { SimContext } from '../state.ts';
import type { Command, Rejection } from '../types.ts';

export interface CommandHandler<C extends Command = Command> {
  validate(ctx: SimContext, command: C): Rejection | null;
  apply(ctx: SimContext, command: C): void;
}

export function reject(code: Rejection['code'], reason: string): Rejection {
  return { ok: false, code, reason };
}
