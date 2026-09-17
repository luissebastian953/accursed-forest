/**
 * Catching something at it (§POC): the golden capybara that turns up among
 * the others, and the babi ngepet on the day it stands up at the Kopdes.
 * Both are worth something to whoever spots them and clicks before they are
 * gone; the capybara simply goes, the pig drops its takings and bolts. It is
 * the one command aimed at a mob rather than a block.
 */

import { BABI_NGEPET, SHINY } from '../balance/mobs.ts';
import { earn, type SimContext } from '../state.ts';
import { startle } from '../systems/mobs.ts';
import type { Command, Mob, Rejection } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type TapMob = Extract<Command, { type: 'TapMob' }>;

function find(ctx: SimContext, id: number) {
  return ctx.state.mobs.find((mob) => mob.id === id);
}

/** What a mob is worth to whoever spots it, or null if it is just an animal. */
function worth(mob: Mob): { amount: number; note: string } | null {
  if (mob.shiny) return { amount: SHINY.reward, note: 'golden capybara' };
  if (mob.species === 'babiNgepet' && mob.standing) {
    return { amount: BABI_NGEPET.caughtDrop, note: 'babi ngepet, startled' };
  }
  return null;
}

export const tapMob: CommandHandler<TapMob> = {
  validate(ctx, command): Rejection | null {
    const mob = find(ctx, command.mob);
    if (!mob) return reject('wrongPhase', 'It has already gone.');
    if (!worth(mob)) return reject('wrongPhase', 'Nothing comes of it.');
    return null;
  },

  apply(ctx, command): void {
    const { state, events } = ctx;
    const mob = find(ctx, command.mob);
    const prize = mob && worth(mob);
    if (!mob || !prize) return;
    earn(state, prize.amount, 'sale', prize.note);
    events.push({ type: 'MobTapped', id: mob.id, species: mob.species, amount: prize.amount });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
    if (mob.species === 'babiNgepet') {
      // It drops the coins and runs; it is not caught, only startled.
      startle(ctx, mob);
      return;
    }
    // The capybara is simply not there any more.
    state.mobs.splice(state.mobs.indexOf(mob), 1);
    events.push({ type: 'MobLeft', id: mob.id, species: mob.species });
  },
};
