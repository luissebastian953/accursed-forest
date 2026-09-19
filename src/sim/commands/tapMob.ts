import { BABI_NGEPET, SHINY } from '../balance/mobs.ts';
import { earn, type SimContext } from '../state.ts';
import { startle } from '../systems/mobs.ts';
import type { Command, Mob, Rejection } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type TapMob = Extract<Command, { type: 'TapMob' }>;

function find(ctx: SimContext, id: number) {
  return ctx.state.mobs.find((mob) => mob.id === id);
}

/** Whether a mob is standing on land the player owns. */
function onTheEstate(ctx: SimContext, mob: Mob): boolean {
  const { state, world } = ctx;
  const x = Math.floor(mob.x);
  const y = Math.floor(mob.z);

  if (!world.inBounds(x, y)) return false;
  return state.blocks.get(world.toId(x, y))?.owned ?? false;
}

/** What a mob is worth to whoever spots it, or null if it is just an animal. */
function worth(ctx: SimContext, mob: Mob): { amount: number; note: string } | null {
  if (mob.shiny) return { amount: SHINY.reward, note: 'golden capybara' };

  if (mob.species === 'babiNgepet') {
    // Upright at the Kopdes it is carrying the takings; on four legs on your
    // land it is only what the stories say turns up before a theft.
    if (mob.standing) return { amount: BABI_NGEPET.caughtDrop, note: 'babi ngepet, startled' };

    if (onTheEstate(ctx, mob)) {
      return { amount: BABI_NGEPET.spottedDrop, note: 'babi ngepet, spotted' };
    }
  }

  return null;
}

export const tapMob: CommandHandler<TapMob> = {
  validate(ctx, command): Rejection | null {
    const mob = find(ctx, command.mob);

    if (!mob) return reject('wrongPhase', 'It has already gone.');
    if (!worth(ctx, mob)) return reject('wrongPhase', 'Nothing comes of it.');
    return null;
  },

  apply(ctx, command): void {
    const { state, events } = ctx;
    const mob = find(ctx, command.mob);
    const prize = mob && worth(ctx, mob);

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
