/**
 * The run's own bookkeeping (§3.8): whether it is over, how it ended, and the
 * chronicle the epilogue replays.
 */

import { CHRONICLE } from './balance/endings.ts';
import type { ChronicleEntry, Ending, SimState } from './types.ts';

/** Over and not continued in sandbox: the world stops and commands are refused. */
export function runOver(state: SimState): boolean {
  return state.run.ending !== undefined && !state.run.sandbox;
}

export function endRun(state: SimState, ending: Ending): void {
  state.run.endedAt = state.tick;
  state.run.ending = ending;
}

/**
 * Add a line to the chronicle. Over the cap the oldest line that is not
 * critical goes first, so the turning points of a long run survive.
 */
export function chronicle(state: SimState, entry: Omit<ChronicleEntry, 'tick'>): void {
  const list = state.run.chronicle;
  list.push({ tick: state.tick, lane: entry.lane, severity: entry.severity, title: entry.title });
  if (list.length <= CHRONICLE.cap) return;
  const drop = list.findIndex((e) => e.severity !== 'critical');
  list.splice(drop >= 0 ? drop : 0, 1);
}
