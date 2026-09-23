import { GANODERMA, PEST_LABOUR } from '../balance/pests.ts';
import { clearSlot, plantSlot } from '../palms.ts';
import { readBlock, spend, writeBlock, type SimContext } from '../state.ts';
import { plantableSlots } from '../systems/pest.ts';
import type { Command, Rejection } from '../types.ts';

import { reject, type CommandHandler } from './handler.ts';
import { seedlingItem } from './plantBlock.ts';

type RemovePalm = Extract<Command, { type: 'RemovePalm' }>;
type TrenchPalm = Extract<Command, { type: 'TrenchPalm' }>;
type ReplantBlock = Extract<Command, { type: 'ReplantBlock' }>;

function validateSlot(ctx: SimContext, block: number, slot: number): Rejection | null {
  const { state, world } = ctx;

  if (!world.inBounds(...world.toXY(block)))
    return reject('unknownBlock', 'That block is outside the map.');

  const b = readBlock(state, world, block);

  if (!b.owned) return reject('notOwned', 'You do not own this block.');
  if (b.burning) return reject('burning', 'This block is on fire.');

  const palms = state.palms.get(block);

  if (!palms) return reject('wrongPhase', 'Nothing planted here.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= palms.plantedAt.length)
    return reject('badSlot', 'No such slot.');
  if (palms.plantedAt[slot]! < 0) return reject('badSlot', 'That slot is empty.');
  return null;
}

export const removePalm: CommandHandler<RemovePalm> = {
  validate(ctx, command) {
    const bad = validateSlot(ctx, command.block, command.slot);

    if (bad) return bad;

    if (ctx.state.economy.cash < PEST_LABOUR.removePalm) {
      return reject(
        'noCash',
        `Removing a palm costs Rp ${PEST_LABOUR.removePalm.toLocaleString('id-ID')}.`,
      );
    }

    return null;
  },
  apply(ctx, command) {
    const { state, world, events } = ctx;
    const block = writeBlock(state, world, command.block);
    const palms = state.palms.get(command.block)!;

    clearSlot(palms, command.slot);
    block.debris = Math.min(100, block.debris + GANODERMA.debrisPerRemoval);
    spend(
      state,
      PEST_LABOUR.removePalm,
      'wages',
      `remove palm: block ${command.block} slot ${command.slot}`,
    );
    events.push({ type: 'PalmRemoved', block: command.block, slot: command.slot });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};

export const trenchPalm: CommandHandler<TrenchPalm> = {
  validate(ctx, command) {
    const bad = validateSlot(ctx, command.block, command.slot);

    if (bad) return bad;

    const palms = ctx.state.palms.get(command.block)!;

    if (palms.trenched[command.slot] === 1) return reject('occupied', 'Already trenched.');

    if (ctx.state.economy.cash < PEST_LABOUR.trenchPalm) {
      return reject(
        'noCash',
        `A trench costs Rp ${PEST_LABOUR.trenchPalm.toLocaleString('id-ID')}.`,
      );
    }

    return null;
  },
  apply(ctx, command) {
    const { state, events } = ctx;
    const palms = state.palms.get(command.block)!;

    palms.trenched[command.slot] = 1;
    spend(
      state,
      PEST_LABOUR.trenchPalm,
      'wages',
      `trench: block ${command.block} slot ${command.slot}`,
    );
    events.push({ type: 'PalmTrenched', block: command.block, slot: command.slot });
    events.push({ type: 'CashChanged', cash: state.economy.cash });
  },
};

/** Empty plantable slots on a block. */
export function emptySlots(ctx: SimContext, block: number): number[] {
  const palms = ctx.state.palms.get(block);
  const b = ctx.state.blocks.get(block);

  if (!palms || !b) return [];

  const limit = plantableSlots(b);
  const out: number[] = [];

  for (let slot = 0; slot < limit; slot++) if (palms.plantedAt[slot]! < 0) out.push(slot);
  return out;
}

export const replantBlock: CommandHandler<ReplantBlock> = {
  validate(ctx, command) {
    const { state, world } = ctx;

    if (!world.inBounds(...world.toXY(command.block)))
      return reject('unknownBlock', 'That block is outside the map.');

    const block = readBlock(state, world, command.block);

    if (!block.owned) return reject('notOwned', 'You do not own this block.');
    if (block.burning) return reject('burning', 'This block is on fire.');
    if (block.phase !== 'planted' && block.phase !== 'reforesting')
      return reject('wrongPhase', 'Nothing planted here to fill in.');

    const empties = emptySlots(ctx, command.block);

    if (empties.length === 0) return reject('wrongPhase', 'No empty slots to replant.');

    const item = seedlingItem(block.species);

    if (state.inventory[item] < empties.length) {
      const label = block.species === 'forest' ? 'saplings' : 'seedlings';

      return reject(
        'noInventory',
        `Needs ${empties.length} ${label}; you have ${state.inventory[item]}. Buy them at the Workshop.`,
      );
    }

    return null;
  },
  apply(ctx, command) {
    const { state, events } = ctx;
    const block = state.blocks.get(command.block)!;
    const palms = state.palms.get(command.block)!;
    const empties = emptySlots(ctx, command.block);

    for (const slot of empties) plantSlot(palms, slot, state.tick);
    state.inventory[seedlingItem(block.species)] -= empties.length;
    events.push({ type: 'BlockReplanted', block: command.block, count: empties.length });
  },
};
