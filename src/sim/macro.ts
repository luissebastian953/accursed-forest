import {
  MACRO_EVENTS,
  MACRO_PREFIX,
  type MacroEvent,
  type MacroEventId,
} from './balance/society.ts';
import type { SimState } from './types.ts';

/** The spec behind an active event's id, or undefined if it is not one of ours. */
function specOf(id: string): MacroEvent | undefined {
  if (!id.startsWith(MACRO_PREFIX)) return undefined;
  return (MACRO_EVENTS as Record<string, MacroEvent>)[id.slice(MACRO_PREFIX.length)];
}

/** Every headline running today. */
export function runningMacro(state: SimState): MacroEvent[] {
  const out: MacroEvent[] = [];
  for (const event of state.weather.activeEvents) {
    const spec = specOf(event.id);
    if (spec) out.push(spec);
  }
  return out;
}

/** Whether a particular headline is running. */
export function macroRunning(state: SimState, id: MacroEventId): boolean {
  return state.weather.activeEvents.some((e) => e.id === MACRO_PREFIX + id);
}

/** The product of one multiplier across every running headline. */
function factor(
  state: SimState,
  lever:
    | 'inputFactor'
    | 'landFactor'
    | 'wageFactor'
    | 'yieldFactor'
    | 'landslideFactor'
    | 'attentionDecayFactor'
    | 'settleFactor',
): number {
  let out = 1;
  for (const spec of runningMacro(state)) out *= spec[lever] ?? 1;
  return out;
}

/** Shop prices: the sticky index, times whatever the news is doing today. */
export function shopIndex(state: SimState): number {
  return state.economy.inputPriceIndex * factor(state, 'inputFactor');
}

/** Land, wages, yield, slope risk: each read in one place. */
export function landFactor(state: SimState): number {
  return factor(state, 'landFactor');
}
export function wageFactor(state: SimState): number {
  return factor(state, 'wageFactor');
}
export function yieldFactor(state: SimState): number {
  return factor(state, 'yieldFactor');
}
export function landslideFactor(state: SimState): number {
  return factor(state, 'landslideFactor');
}
export function attentionDecayFactor(state: SimState): number {
  return factor(state, 'attentionDecayFactor');
}
export function settleFactor(state: SimState): number {
  return factor(state, 'settleFactor');
}

/** Whether the wildlife is staying away. */
export function wildlifeQuiet(state: SimState): boolean {
  return runningMacro(state).some((spec) => spec.mobsQuiet === true);
}

/** Whether the country is holding its breath and nothing new can be drawn. */
export function macroCalm(state: SimState): boolean {
  return runningMacro(state).some((spec) => spec.calm === true);
}

/** What the day's contracts pay an estate with a Kopdes. */
export function macroKopdesPay(state: SimState): number {
  if (!state.kopdes) return 0;
  let out = 0;
  for (const spec of runningMacro(state)) out += spec.kopdesCashPerDay ?? 0;
  return out;
}

/**
 * Whether any running headline is softened by forest cover, and by how much.
 * Half the hit at full cover, nothing at none.
 */
export function forestSoftening(state: SimState): boolean {
  return runningMacro(state).some((spec) => spec.forestSoftens === true);
}
