/**
 * Spotting the golden capybara (§POC): a rare one turns up among the others
 * and is worth something to whoever notices it and clicks on it before it
 * wanders off. It is the one command aimed at a mob rather than a block.
 */

import { SHINY } from '../balance/mobs.ts';
import { earn, type SimContext } from '../state.ts';
import type { Command, Rejection } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type TapMob = Extract<Command, { type: 'TapMob' }>;

function find(ctx: SimContext, id: number) {
  return ctx.state.mobs.find((mob) => mob.id === id);
}

export const tapMob: CommandHandler<TapMob> = {
  validate(ctx, command): Rejection | null {
    const mob = find(ctx, command.mob);
    if (!mob) return reject('wrongPhase', 'It has already gone.');
    if (!mob.shiny) return reject('wrongPhase', 'Nothing comes of it.');
    return null;
  },

  apply(ctx, command): void {
    const { state, events } = ctx;
    const mob = find(ctx, command.mob);
    if (!mob) return;
    earn(state, SHINY.reward, 'sale', 'golden capybara');
    events.push({ type: 'MobTapped', id: mob.id, species: mob.species, amount: SHINY.reward });
    // It has been seen, and it is off.
    state.mobs.splice(state.mobs.indexOf(mob), 1);
    events.push({ type: 'MobLeft', id: mob.id, species: mob.species });
  },
};
