import { BEETLES, GANODERMA } from '../balance/pests.ts';
import { readBlock, writeBlock, type SimContext } from '../state.ts';
import type { Block, Command, ItemId, Rejection, Tick } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';

interface Treatment {
  item: ItemId;
  field: 'trapsUntil' | 'metarhiziumUntil' | 'trichodermaUntil';
  days: number;
  label: string;
  buy: string;
  /** Trichoderma only makes sense where palms stand. */
  needsPalms: boolean;
}

const TREATMENTS = {
  SetTrap: {
    item: 'pheromoneTrap',
    field: 'trapsUntil',
    days: BEETLES.trapDays,
    label: 'Traps',
    buy: 'No pheromone traps in stock; buy a kit at the Workshop.',
    needsPalms: false,
  },
  ApplyMetarhizium: {
    item: 'metarhizium',
    field: 'metarhiziumUntil',
    days: BEETLES.metarhiziumDays,
    label: 'Metarhizium',
    buy: 'No Metarhizium in stock; buy some at the Workshop.',
    needsPalms: false,
  },
  ApplyTrichoderma: {
    item: 'trichoderma',
    field: 'trichodermaUntil',
    days: GANODERMA.trichodermaDays,
    label: 'Trichoderma',
    buy: 'No Trichoderma in stock; buy some at the Workshop.',
    needsPalms: true,
  },
} satisfies Record<string, Treatment>;

type TreatmentCommand = Extract<Command, { type: keyof typeof TREATMENTS }>;

function validateTreatment(ctx: SimContext, command: TreatmentCommand): Rejection | null {
  const { state, world } = ctx;
  const t: Treatment = TREATMENTS[command.type];

  if (!world.inBounds(...world.toXY(command.block)))
    return reject('unknownBlock', 'That block is outside the map.');

  const block = readBlock(state, world, command.block);

  if (!block.owned) return reject('notOwned', 'You do not own this block.');
  if (block.burning) return reject('burning', 'This block is on fire.');
  if (t.needsPalms && !state.palms.has(command.block))
    return reject('wrongPhase', 'Nothing planted here to treat.');

  if (block[t.field] > state.tick) {
    return reject(
      'occupied',
      `${t.label} already active for ${block[t.field] - state.tick} more days.`,
    );
  }

  if (state.inventory[t.item] < 1) return reject('noInventory', t.buy);
  return null;
}

function applyTreatment(ctx: SimContext, command: TreatmentCommand): void {
  const { state, world, events } = ctx;
  const t: Treatment = TREATMENTS[command.type];
  const block: Block = writeBlock(state, world, command.block);

  state.inventory[t.item] -= 1;

  const until: Tick = state.tick + t.days;

  block[t.field] = until;
  if (command.type === 'SetTrap') events.push({ type: 'TrapSet', block: command.block });
  else
    events.push({
      type: 'BlockTreated',
      block: command.block,
      treatment: command.type === 'ApplyMetarhizium' ? 'metarhizium' : 'trichoderma',
    });
}

export const setTrap: CommandHandler<Extract<Command, { type: 'SetTrap' }>> = {
  validate: validateTreatment,
  apply: applyTreatment,
};
export const applyMetarhizium: CommandHandler<Extract<Command, { type: 'ApplyMetarhizium' }>> = {
  validate: validateTreatment,
  apply: applyTreatment,
};
export const applyTrichoderma: CommandHandler<Extract<Command, { type: 'ApplyTrichoderma' }>> = {
  validate: validateTreatment,
  apply: applyTreatment,
};
