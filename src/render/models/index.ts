import { abandonedHouse, stiltHouse, woodCabin } from './buildings/houses.ts';
import { fallenLog } from './ground/log.ts';
import { snappedBranch, spoilHeap } from './ground/spoil.ts';
import type { Model } from './kit.ts';
import { bush, floweringBush } from './plants/bush.ts';
import { cactus, tumbleweed } from './plants/desert.ts';
import { flowers } from './plants/flowers.ts';
import { grassTuft, reeds } from './plants/grass.ts';
import { boulders, cave, rockSpire } from './rocks/rocks.ts';
import { burntTree } from './trees/burntTree.ts';
import { deadTree } from './trees/deadTree.ts';
import { giantTree } from './trees/giantTree.ts';
import { pineTree } from './trees/pineTree.ts';
import { rainforestTree } from './trees/rainforestTree.ts';
import { weepingFig } from './trees/weepingFig.ts';
import { willowTree } from './trees/willowTree.ts';

export const MODELS = {
  rainforestTree,
  giantTree,
  pineTree,
  willowTree,
  weepingFig,
  deadTree,
  burntTree,
  bush,
  floweringBush,
  flowers,
  grassTuft,
  reeds,
  cactus,
  tumbleweed,
  boulders,
  rockSpire,
  cave,
  fallenLog,
  spoilHeap,
  snappedBranch,
  stiltHouse,
  woodCabin,
  abandonedHouse,
} as const satisfies Record<string, Model>;

export type ModelId = keyof typeof MODELS;

export { ModelKit, type Model, type Placement, type Rand } from './kit.ts';
