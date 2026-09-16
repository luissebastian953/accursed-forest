/**
 * Command registry. One file per command (§5); the map below is the only
 * place that knows them all.
 */

import type { Command, CommandType } from '../types.ts';

import { burnBlock } from './burnBlock.ts';
import { buyBlock } from './buyBlock.ts';
import { buyItem } from './buyItem.ts';
import { chopBlock } from './chopBlock.ts';
import { coverCropBlock } from './coverCropBlock.ts';
import { drainBlock } from './drainBlock.ts';
import { fertilizeBlock } from './fertilizeBlock.ts';
import type { CommandHandler } from './handler.ts';
import { harvestBlock } from './harvestBlock.ts';
import { irrigateBlock } from './irrigateBlock.ts';
import { keepPlaying } from './keepPlaying.ts';
import { removePalm, replantBlock, trenchPalm } from './palmSlots.ts';
import { placeKopdes } from './placeKopdes.ts';
import { plantBlock } from './plantBlock.ts';
import { sanitizeBlock } from './sanitizeBlock.ts';
import { setAutoHarvest } from './setAutoHarvest.ts';
import { settleInvestigation } from './settleInvestigation.ts';
import { applyMetarhizium, applyTrichoderma, setTrap } from './treatments.ts';
import { upgradeKopdes } from './upgradeKopdes.ts';
import { dismissWorker, hireWorker } from './workers.ts';

// Handlers are typed against their own command; the registry erases that so
// `dispatch` can look up by discriminant. The cast is the single unsafe point.
const registry: Partial<Record<CommandType, CommandHandler>> = {
  BuyBlock: buyBlock as CommandHandler,
  ChopBlock: chopBlock as CommandHandler,
  PlantBlock: plantBlock as CommandHandler,
  PlaceKopdes: placeKopdes as CommandHandler,
  HarvestBlock: harvestBlock as CommandHandler,
  FertilizeBlock: fertilizeBlock as CommandHandler,
  UpgradeKopdes: upgradeKopdes as CommandHandler,
  BuyItem: buyItem as CommandHandler,
  BurnBlock: burnBlock as CommandHandler,
  SanitizeBlock: sanitizeBlock as CommandHandler,
  IrrigateBlock: irrigateBlock as CommandHandler,
  DrainBlock: drainBlock as CommandHandler,
  SetTrap: setTrap as CommandHandler,
  ApplyMetarhizium: applyMetarhizium as CommandHandler,
  ApplyTrichoderma: applyTrichoderma as CommandHandler,
  RemovePalm: removePalm as CommandHandler,
  TrenchPalm: trenchPalm as CommandHandler,
  ReplantBlock: replantBlock as CommandHandler,
  CoverCropBlock: coverCropBlock as CommandHandler,
  SettleInvestigation: settleInvestigation as CommandHandler,
  SetAutoHarvest: setAutoHarvest as CommandHandler,
  HireWorker: hireWorker as CommandHandler,
  DismissWorker: dismissWorker as CommandHandler,
  KeepPlaying: keepPlaying as CommandHandler,
};

export function handlerFor(command: Command): CommandHandler | undefined {
  return registry[command.type];
}
