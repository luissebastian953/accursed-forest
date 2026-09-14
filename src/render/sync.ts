/**
 * From a tick's events to what the scene needs to redo (§4.2 step 5).
 *
 * A pure classifier: the app feeds the digest to the chunk manager, the palm
 * meshes, the persistence dirty set and the HUD. Keeping it here means the
 * event → visual mapping (§6.5 "event wiring") has one home.
 */

import type { SimEvent } from '@sim/events';
import type { BlockId, ItemId } from '@sim/types';

export interface EventDigest {
  /** Blocks whose terrain look changed: rebuild their chunks. */
  terrainBlocks: Set<BlockId>;
  /** Blocks whose palms changed: rebuild instances. */
  palmBlocks: Set<BlockId>;
  /** Palm blocks that should pop in rather than appear. */
  animateBlocks: Set<BlockId>;
  cashChanged: boolean;
  kopdesChanged: boolean;
  yearPassed: number | null;
  harvested: { block: BlockId; kilograms: number }[];
  ripeBlocks: Set<BlockId>;
  sold: { kilograms: number; price: number; revenue: number }[];
  kopdesUpgraded: number | null;
  fertilizedBlocks: Set<BlockId>;
  bought: { item: ItemId; quantity: number }[];
}

export function digestEvents(events: readonly SimEvent[]): EventDigest {
  const digest: EventDigest = {
    terrainBlocks: new Set(),
    palmBlocks: new Set(),
    animateBlocks: new Set(),
    cashChanged: false,
    kopdesChanged: false,
    yearPassed: null,
    harvested: [],
    ripeBlocks: new Set(),
    sold: [],
    kopdesUpgraded: null,
    fertilizedBlocks: new Set(),
    bought: [],
  };

  for (const event of events) {
    switch (event.type) {
      case 'BlockChanged':
      case 'BlockCleared':
      case 'BlockBought':
        digest.terrainBlocks.add(event.block);
        break;
      case 'BlockPlanted':
        digest.terrainBlocks.add(event.block);
        digest.palmBlocks.add(event.block);
        digest.animateBlocks.add(event.block);
        break;
      case 'KopdesPlaced':
        digest.terrainBlocks.add(event.block);
        digest.kopdesChanged = true;
        break;
      case 'PalmStageChanged':
        digest.palmBlocks.add(event.block);
        digest.animateBlocks.add(event.block);
        break;
      case 'PalmDied':
        digest.palmBlocks.add(event.block);
        break;
      case 'BlockRipe':
        digest.ripeBlocks.add(event.block);
        break;
      case 'Harvested':
        digest.palmBlocks.add(event.block);
        digest.harvested.push({ block: event.block, kilograms: event.kilograms });
        break;
      case 'TbsSold':
        digest.sold.push({
          kilograms: event.kilograms,
          price: event.price,
          revenue: event.revenue,
        });
        break;
      case 'BlockFertilized':
        digest.fertilizedBlocks.add(event.block);
        break;
      case 'ItemBought':
        digest.bought.push({ item: event.item, quantity: event.quantity });
        break;
      case 'KopdesUpgraded':
        digest.kopdesUpgraded = event.level;
        digest.kopdesChanged = true;
        break;
      case 'YearPassed':
        digest.yearPassed = event.year;
        break;
      case 'CashChanged':
        digest.cashChanged = true;
        break;
    }
  }

  return digest;
}
