/**
 * Society system (§3.7, §3.9): the macro-economic deck, the hidden integrity
 * stat, and the authority meter. Runs after the economy and before the news,
 * reading everything that happened this tick; including commands dispatched
 * since the last one, whose events wait in the same sink.
 */

import { clamp } from '@shared/math';

import { OPERATING_BAN } from '../balance/endings.ts';
import {
  ATTENTION,
  AUTHORITY,
  INTEGRITY,
  MACRO,
  MACRO_PREFIX,
  type MacroEvent,
  type MacroEventId,
} from '../balance/society.ts';
import { activeEvent } from '../fire.ts';
import { chance, nextGaussian, nextInt, pickWeighted } from '../rng.ts';
import { endRun, runOver } from '../run.ts';
import { neighbourIds, readBlock, type SimContext } from '../state.ts';
import type { BlockId, SimState } from '../types.ts';

const MACRO_IDS = Object.keys(MACRO.events) as MacroEventId[];

export function society(ctx: SimContext): void {
  if (runOver(ctx.state)) return;
  macroEconomy(ctx);
  integrity(ctx);
  authority(ctx);
}

// ── Macro economy ─────────────────────────────────────────────────────────

/** Multiplier on the TBS price's long-run mean from inflation and the temporary macro events. */
export function tbsMeanFactor(state: SimState): number {
  let factor = 1 + (state.economy.inputPriceIndex - 1) * MACRO.tbsPassThrough;
  for (const event of state.weather.activeEvents) {
    if (!event.id.startsWith(MACRO_PREFIX)) continue;
    const spec: MacroEvent | undefined =
      MACRO.events[event.id.slice(MACRO_PREFIX.length) as MacroEventId];
    if (spec?.tbsFactor !== undefined) factor *= spec.tbsFactor;
  }
  return factor;
}

function macroEconomy(ctx: SimContext): void {
  const { state, events } = ctx;
  const tick = state.tick;

  for (const event of state.weather.activeEvents) {
    if (event.id.startsWith(MACRO_PREFIX) && event.endsAt === tick) {
      events.push({ type: 'MacroEventEnded', id: event.id.slice(MACRO_PREFIX.length) });
    }
  }
  state.weather.activeEvents = state.weather.activeEvents.filter(
    (e) => !e.id.startsWith(MACRO_PREFIX) || e.endsAt > tick,
  );

  if (tick === 0 || tick % MACRO.drawEveryDays !== 0 || !chance(state.rng, MACRO.drawChance))
    return;

  const weights = MACRO_IDS.map((id) => {
    const spec: MacroEvent = MACRO.events[id];
    if (spec.days && activeEvent(state, MACRO_PREFIX + id)) return 0;
    if (spec.inputRise && state.economy.inputPriceIndex >= MACRO.maxInputIndex) return 0;
    return spec.weight;
  });
  const id = MACRO_IDS[pickWeighted(state.rng, weights)];
  if (id === undefined) return;
  const spec: MacroEvent = MACRO.events[id];

  if (spec.inputRise !== undefined) {
    state.economy.inputPriceIndex = Math.min(
      MACRO.maxInputIndex,
      state.economy.inputPriceIndex * (1 + spec.inputRise),
    );
    events.push({ type: 'InputPricesRose', index: state.economy.inputPriceIndex });
  }
  const days = spec.days
    ? spec.days.min + nextInt(state.rng, spec.days.max - spec.days.min + 1)
    : 0;
  if (spec.days)
    state.weather.activeEvents.push({
      id: MACRO_PREFIX + id,
      startedAt: tick,
      endsAt: tick + days,
    });
  events.push({ type: 'MacroEventStarted', id, days });
}

// ── Integrity ─────────────────────────────────────────────────────────────

function integrity(ctx: SimContext): void {
  const { state, events } = ctx;
  const s = state.society;
  s.integrity +=
    INTEGRITY.reversionPerDay * (INTEGRITY.baseline - s.integrity) +
    nextGaussian(state.rng) * INTEGRITY.driftSd;

  if (
    state.tick > 0 &&
    state.tick % INTEGRITY.scandalEveryDays === 0 &&
    chance(state.rng, INTEGRITY.scandalChance)
  ) {
    s.integrity += INTEGRITY.scandalJump;
    events.push({ type: 'IntegrityScandal', integrity: clamp(s.integrity, 0, 1) });
  }
  s.integrity = clamp(s.integrity, 0, 1);
}

// ── Authority (§3.9) ──────────────────────────────────────────────────────

/** How hard a noticed act lands on the meter: slower with low integrity. */
export function attentionFactor(state: SimState): number {
  return 0.5 + state.society.integrity;
}

function nextToProtected(ctx: SimContext, id: BlockId): boolean {
  for (const n of neighbourIds(ctx.world, id)) {
    if (readBlock(ctx.state, ctx.world, n).biome === 'protected') return true;
  }
  return false;
}

function authority(ctx: SimContext): void {
  const { state, world, events } = ctx;
  const s = state.society;
  const factor = attentionFactor(state);
  let raise = 0;
  let openFor: 'wildfire' | 'protectedForest' | null = null;
  let secondWildfire = false;
  let burned = false;

  for (const event of events.peek()) {
    switch (event.type) {
      case 'ForestChopped':
        raise += ATTENTION.chopForest;
        break;
      case 'BurnStarted':
        raise += ATTENTION.burn[event.intensity];
        burned = true;
        if (nextToProtected(ctx, event.block)) openFor ??= 'protectedForest';
        break;
      case 'FireSpread': {
        const target = readBlock(state, world, event.to);
        if (!target.owned) raise += ATTENTION.fireIntoUnowned;
        if (target.biome === 'protected') openFor ??= 'protectedForest';
        break;
      }
      case 'WildfireStarted':
        if (s.investigationUntil > state.tick) secondWildfire = true;
        else openFor = 'wildfire';
        break;
      case 'BlockPlanted':
        if (event.species === 'forest') s.attention -= ATTENTION.reforestPlant;
        break;
      default:
        break;
    }
  }

  let reforesting = 0;
  for (const block of state.blocks.values())
    if (block.owned && block.phase === 'reforesting') reforesting += 1;

  s.attention += raise * factor;
  s.attention = clamp(s.attention, 0, ATTENTION.max);

  // ── Arrest ─────────────────────────────────────────────────────────────
  if (secondWildfire || s.attention >= AUTHORITY.arrestAt) {
    endRun(state, 'arrested');
    events.push({ type: 'Arrested', reason: secondWildfire ? 'secondWildfire' : 'attention' });
    return;
  }

  // ── The enforcement roll (§3.8) ────────────────────────────────────────
  if (s.operatingBanUntil === state.tick) events.push({ type: 'OperatingBanLifted' });
  // Only an honest office rolls, so the ban is rare and a scandal headline
  // always came first. The roll draws from the stream only when it can land.
  if (
    burned &&
    !operatingBanned(state) &&
    s.integrity >= OPERATING_BAN.minIntegrity &&
    chance(state.rng, OPERATING_BAN.chance)
  ) {
    s.operatingBanUntil = state.tick + OPERATING_BAN.days;
    events.push({ type: 'OperatingBanned', until: s.operatingBanUntil });
  }

  // ── Warning 2: police at the gate ──────────────────────────────────────
  const investigating = s.investigationUntil > state.tick;
  // A case that has run its course closes before anything can open another,
  // so the old offence cannot reopen it; a new one the same day still can.
  if (s.warningLevel === 2 && !investigating) {
    s.attention = Math.min(s.attention, AUTHORITY.investigationClosesAt);
    s.warningLevel = s.attention >= AUTHORITY.letterClearsBelow ? 1 : 0;
    events.push({ type: 'InvestigationClosed' });
  }
  if (!investigating && (openFor !== null || s.attention >= AUTHORITY.investigationAt)) {
    s.investigationUntil = state.tick + AUTHORITY.investigationDays;
    s.warningLevel = 2;
    s.lettersReceived += 1;
    s.attention = Math.max(s.attention, AUTHORITY.investigationAt);
    events.push({
      type: 'InvestigationOpened',
      until: s.investigationUntil,
      reason: openFor ?? 'attention',
    });
    return;
  }

  // ── Warning 1: the letter ──────────────────────────────────────────────
  if (s.warningLevel === 0 && s.attention >= AUTHORITY.letterAt) {
    s.warningLevel = 1;
    s.lettersReceived += 1;
    events.push({ type: 'LetterReceived' });
  } else if (s.warningLevel === 1 && s.attention < AUTHORITY.letterClearsBelow) {
    s.warningLevel = 0;
  }

  // Quiet days forget; after the checks, so a meter sitting at a threshold still trips it.
  s.attention -= ATTENTION.decayPerDay + reforesting * ATTENTION.reforestTricklePerBlock;
  s.attention = clamp(s.attention, 0, ATTENTION.max);
}

/** Is chopping and burning banned right now? */
export function underInvestigation(state: SimState): boolean {
  return state.society.investigationUntil > state.tick;
}

/** Is the whole estate shut by an operating ban? */
export function operatingBanned(state: SimState): boolean {
  return state.society.operatingBanUntil > state.tick;
}

export function operatingBanReason(state: SimState): string {
  const until = state.society.operatingBanUntil;
  return `Operating licence suspended; no clearing, palm planting or harvest until year ${Math.floor(until / 360) + 1}, day ${(until % 360) + 1}.`;
}

/** Clearing costs while a letter or investigation stands (§3.9). */
export function clearingCostFactor(state: SimState): number {
  return state.society.warningLevel >= 1 ? AUTHORITY.letterChopCostFactor : 1;
}
