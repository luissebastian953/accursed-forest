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
  burnStarted: Set<BlockId>;
  fireSpread: { from: BlockId; to: BlockId }[];
  burnFinished: Set<BlockId>;
  extinguished: Set<BlockId>;
  palmsBurned: { block: BlockId; count: number }[];
  wildfireStarted: boolean;
  wildfireEnded: boolean;
  timber: { block: BlockId; revenue: number }[];
  sanitized: Set<BlockId>;
  irrigated: Set<BlockId>;
  drained: Set<BlockId>;
  /** Palms that turned visibly sick this tick, by block. */
  palmSick: Map<BlockId, number>;
  /** Palms that died this tick, by block and cause. */
  palmsDied: { block: BlockId; cause: 'ganoderma' | 'beetles' | 'age' }[];
  plagueStarted: Set<BlockId>;
  plagueEnded: Set<BlockId>;
  replanted: { block: BlockId; count: number }[];
}

export function digestEvents(events: readonly SimEvent[]): EventDigest {
  const d: EventDigest = {
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
    burnStarted: new Set(),
    fireSpread: [],
    burnFinished: new Set(),
    extinguished: new Set(),
    palmsBurned: [],
    wildfireStarted: false,
    wildfireEnded: false,
    timber: [],
    sanitized: new Set(),
    irrigated: new Set(),
    drained: new Set(),
    palmSick: new Map(),
    palmsDied: [],
    plagueStarted: new Set(),
    plagueEnded: new Set(),
    replanted: [],
  };

  for (const event of events) {
    switch (event.type) {
      case 'BlockChanged':
      case 'BlockCleared':
      case 'BlockBought':
        d.terrainBlocks.add(event.block);
        break;
      case 'BlockPlanted':
        d.terrainBlocks.add(event.block);
        d.palmBlocks.add(event.block);
        d.animateBlocks.add(event.block);
        break;
      case 'KopdesPlaced':
        d.terrainBlocks.add(event.block);
        d.kopdesChanged = true;
        break;
      case 'PalmStageChanged':
        d.palmBlocks.add(event.block);
        d.animateBlocks.add(event.block);
        break;
      case 'PalmDied':
        d.palmBlocks.add(event.block);
        d.palmsDied.push({ block: event.block, cause: event.cause });
        break;
      case 'PalmSick':
        d.palmBlocks.add(event.block);
        d.palmSick.set(event.block, (d.palmSick.get(event.block) ?? 0) + 1);
        break;
      case 'PalmRemoved':
      case 'PalmTrenched':
        d.palmBlocks.add(event.block);
        break;
      case 'BlockReplanted':
        d.palmBlocks.add(event.block);
        d.animateBlocks.add(event.block);
        d.replanted.push({ block: event.block, count: event.count });
        break;
      case 'TrapSet':
      case 'BlockTreated':
        break;
      case 'PlagueStarted':
        d.plagueStarted.add(event.block);
        break;
      case 'PlagueEnded':
        d.plagueEnded.add(event.block);
        break;
      case 'BlockRipe':
        d.ripeBlocks.add(event.block);
        break;
      case 'Harvested':
        d.palmBlocks.add(event.block);
        d.harvested.push({ block: event.block, kilograms: event.kilograms });
        break;
      case 'TbsSold':
        d.sold.push({ kilograms: event.kilograms, price: event.price, revenue: event.revenue });
        break;
      case 'BlockFertilized':
        d.fertilizedBlocks.add(event.block);
        break;
      case 'ItemBought':
        d.bought.push({ item: event.item, quantity: event.quantity });
        break;
      case 'KopdesUpgraded':
        d.kopdesUpgraded = event.level;
        d.kopdesChanged = true;
        break;
      case 'BurnStarted':
        d.burnStarted.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'FireSpread':
        d.fireSpread.push({ from: event.from, to: event.to });
        d.terrainBlocks.add(event.to);
        break;
      case 'BurnFinished':
        d.burnFinished.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'FireExtinguished':
        d.extinguished.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'PalmsBurned':
        d.palmsBurned.push({ block: event.block, count: event.count });
        d.palmBlocks.add(event.block);
        break;
      case 'WildfireStarted':
        d.wildfireStarted = true;
        break;
      case 'WildfireEnded':
        d.wildfireEnded = true;
        break;
      case 'TimberSold':
        d.timber.push({ block: event.block, revenue: event.revenue });
        break;
      case 'BlockSanitized':
        d.sanitized.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'BlockIrrigated':
        d.irrigated.add(event.block);
        break;
      case 'BlockDrained':
        d.drained.add(event.block);
        break;
      case 'YearPassed':
        d.yearPassed = event.year;
        break;
      case 'CashChanged':
        d.cashChanged = true;
        break;
    }
  }

  return d;
}
