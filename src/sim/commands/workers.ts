/**
 * HireWorker / DismissWorker: the Kopdes puts people on the payroll. A hired
 * worker is a mob that stays until dismissed, is paid every day, and finds
 * its own jobs — debris for the sanitizer, sick palms for the plant doctor,
 * ripe blocks and thieves for the guard.
 */

import { WORKERS } from '../balance/mobs.ts';
import { spend } from '../state.ts';
import type { Command, Mob } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

type HireWorker = Extract<Command, { type: 'HireWorker' }>;
type DismissWorker = Extract<Command, { type: 'DismissWorker' }>;

export const hireWorker: CommandHandler<HireWorker> = {
  validate(ctx, command) {
    const { state } = ctx;
    const spec = WORKERS[command.kind];
    if (!state.kopdes)
      return reject('noKopdes', 'Build a Kopdes first — that is where workers report.');
    if (state.mobs.some((m) => m.hired && m.species === command.kind)) {
      return reject('occupied', `You already employ a ${spec.label.toLowerCase()}.`);
    }
    if (state.economy.cash < spec.hireFee) {
      return reject('noCash', `Hiring costs Rp ${spec.hireFee.toLocaleString('id-ID')} up front.`);
    }
    return null;
  },

  apply(ctx, command) {
    const { state, world, events } = ctx;
    const spec = WORKERS[command.kind];
    spend(state, spec.hireFee, 'wages', `hire: ${spec.label}`);
    const [bx, by] = world.toXY(state.kopdes!.blockId);
    const mob: Mob = {
      id: state.nextMobId++,
      species: command.kind,
      x: bx + 0.5,
      z: by + 0.9,
      tx: bx + 0.5,
      tz: by + 0.9,
      intent: 'idle',
      target: null,
      born: state.tick,
      until: Infinity,
      phase: (state.nextMobId % 13) / 13,
      standing: false,
      hired: true,
      intentUntil: state.tick,
      ax: bx + 0.5,
      az: by + 0.9,
      heading: 0,
    };
    state.mobs.push(mob);
    events.push({
      type: 'MobArrived',
      id: mob.id,
      species: mob.species,
      block: state.kopdes!.blockId,
    });
    events.push({ type: 'WorkerHired', kind: command.kind, fee: spec.hireFee });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};

export const dismissWorker: CommandHandler<DismissWorker> = {
  validate(ctx, command) {
    if (!ctx.state.mobs.some((m) => m.hired && m.species === command.kind)) {
      return reject('wrongPhase', 'Nobody of that kind is on the payroll.');
    }
    return null;
  },

  apply(ctx, command) {
    const { state, events } = ctx;
    for (const mob of state.mobs) {
      if (mob.hired && mob.species === command.kind) {
        events.push({ type: 'MobLeft', id: mob.id, species: mob.species });
      }
    }
    state.mobs = state.mobs.filter((m) => !(m.hired && m.species === command.kind));
    events.push({ type: 'WorkerDismissed', kind: command.kind });
  },
};
