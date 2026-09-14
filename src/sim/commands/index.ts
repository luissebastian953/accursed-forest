/**
 * Command registry. One file per command (§5); the map below is the only
 * place that knows them all.
 */

import type { Command, CommandType } from '../types.ts';

import { buyBlock } from './buyBlock.ts';
import { chopBlock } from './chopBlock.ts';
import type { CommandHandler } from './handler.ts';
import { placeKopdes } from './placeKopdes.ts';
import { plantBlock } from './plantBlock.ts';

// Handlers are typed against their own command; the registry erases that so
// `dispatch` can look up by discriminant. The cast is the single unsafe point.
const registry: Partial<Record<CommandType, CommandHandler>> = {
  BuyBlock: buyBlock as CommandHandler,
  ChopBlock: chopBlock as CommandHandler,
  PlantBlock: plantBlock as CommandHandler,
  PlaceKopdes: placeKopdes as CommandHandler,
};

export function handlerFor(command: Command): CommandHandler | undefined {
  return registry[command.type];
}
