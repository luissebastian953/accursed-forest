import { CHRONICLE } from './balance/endings.ts';
import type { ChronicleEntry, Ending, SimState } from './types.ts';

/** Over and not continued in sandbox: the world stops and commands are refused. */
export function runOver(state: SimState): boolean {
  return state.run.ending !== undefined && !state.run.sandbox;
}

/** The four endings that are a win (GDD 3.8), sandbox or not. */
const WINS: ReadonlySet<Ending> = new Set<Ending>(['clean', 'dirty', 'reboisasi', 'redemption']);

/**
 * Whether the estate has already won, including after `KeepPlaying`, which is
 * the only state in which a won run still takes commands.
 */
export function hasWon(state: SimState): boolean {
  return state.run.ending !== undefined && WINS.has(state.run.ending);
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
