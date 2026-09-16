/**
 * From a tick's events to what the scene needs to redo (§4.2 step 5).
 *
 * A pure classifier: the app feeds the digest to the chunk manager, the palm
 * meshes, the persistence dirty set and the HUD. Keeping it here means the
 * event → visual mapping (§6.5 "event wiring") has one home.
 */

import type { SimEvent } from '@sim/events';
import type { BlockId, Ending, ItemId, YearSummary } from '@sim/types';

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
  palmsDied: { block: BlockId; cause: 'ganoderma' | 'beetles' | 'age' | 'flood' | 'ash' }[];
  plagueStarted: Set<BlockId>;
  plagueEnded: Set<BlockId>;
  replanted: { block: BlockId; count: number }[];
  weatherStarted: { id: string; days: number }[];
  weatherEnded: string[];
  landslides: { block: BlockId; below: BlockId | null; palmsLost: number }[];
  flooded: Set<BlockId>;
  ashSettled: boolean;
  sparks: Set<BlockId>;
  /** Bolts that landed this tick, and whether they set anything alight. */
  lightning: { block: BlockId; ignited: boolean }[];
  letter: boolean;
  investigationOpened: boolean;
  investigationEnded: boolean;
  arrested: boolean;
  operatingBanned: boolean;
  operatingBanLifted: boolean;
  /** The year that closed this tick, for the year-end card and the snapshot. */
  yearClosed: YearSummary | null;
  certified: { clean: boolean } | null;
  runEnded: Ending | null;
  news: { key: string; lane: string; severity: string }[];
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
    weatherStarted: [],
    weatherEnded: [],
    landslides: [],
    flooded: new Set(),
    ashSettled: false,
    sparks: new Set(),
    lightning: [],
    letter: false,
    investigationOpened: false,
    investigationEnded: false,
    arrested: false,
    operatingBanned: false,
    operatingBanLifted: false,
    yearClosed: null,
    certified: null,
    runEnded: null,
    news: [],
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
      case 'WeatherEventStarted':
        d.weatherStarted.push({ id: event.id, days: event.days });
        break;
      case 'WeatherEventEnded':
        d.weatherEnded.push(event.id);
        break;
      case 'Landslide':
        d.landslides.push({ block: event.block, below: event.below, palmsLost: event.palmsLost });
        d.palmBlocks.add(event.block);
        d.terrainBlocks.add(event.block);
        if (event.below !== null) d.terrainBlocks.add(event.below);
        break;
      case 'BlockFlooded':
        d.flooded.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'AshSettled':
        d.ashSettled = true;
        break;
      case 'LightningStruck':
        d.lightning.push({ block: event.block, ignited: event.ignited });
        if (event.ignited) {
          d.burnStarted.add(event.block);
          d.terrainBlocks.add(event.block);
        }
        break;
      case 'SparkCaught':
        d.sparks.add(event.block);
        d.burnStarted.add(event.block);
        d.terrainBlocks.add(event.block);
        break;
      case 'LetterReceived':
        d.letter = true;
        break;
      case 'InvestigationOpened':
        d.investigationOpened = true;
        break;
      case 'InvestigationSettled':
      case 'InvestigationClosed':
        d.investigationEnded = true;
        break;
      case 'Arrested':
        d.arrested = true;
        d.runEnded = 'arrested';
        break;
      case 'OperatingBanned':
        d.operatingBanned = true;
        break;
      case 'OperatingBanLifted':
        d.operatingBanLifted = true;
        break;
      case 'YearClosed':
        d.yearClosed = event.summary;
        break;
      case 'Certified':
        d.certified = { clean: event.clean };
        break;
      case 'RunEnded':
        d.runEnded = event.ending;
        break;
      case 'NewsPublished':
        d.news.push({ key: event.key, lane: event.lane, severity: event.severity });
        break;
      case 'CoverCropSown':
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
