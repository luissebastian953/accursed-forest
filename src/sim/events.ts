/**
 * Events a tick produces (§4.2 step 4).
 *
 * `sim/` does not emit — `tick()` returns the array and the layers above consume
 * it after the tick, syncing only what changed. Every event names the blocks it
 * touched so `render/sync.ts` can build its dirty set without diffing state.
 */

import type { BlockId, FireIntensity, GrowthStage, ItemId, Species } from './types.ts';

export type SimEvent =
  | { type: 'BlockChanged'; block: BlockId }
  | { type: 'BlockPlanted'; block: BlockId; species: Species; count: number }
  | { type: 'BlockCleared'; block: BlockId }
  | { type: 'BlockBought'; block: BlockId }
  | { type: 'KopdesPlaced'; block: BlockId }
  | { type: 'PalmStageChanged'; block: BlockId; slot: number; from: GrowthStage; to: GrowthStage }
  | { type: 'PalmDied'; block: BlockId; slot: number; cause: 'ganoderma' | 'beetles' | 'age' }
  | { type: 'PalmSick'; block: BlockId; slot: number }
  | { type: 'PalmRemoved'; block: BlockId; slot: number }
  | { type: 'PalmTrenched'; block: BlockId; slot: number }
  | { type: 'BlockReplanted'; block: BlockId; count: number }
  | { type: 'TrapSet'; block: BlockId }
  | { type: 'BlockTreated'; block: BlockId; treatment: 'metarhizium' | 'trichoderma' }
  | { type: 'PlagueStarted'; block: BlockId }
  | { type: 'PlagueEnded'; block: BlockId }
  | { type: 'BlockRipe'; block: BlockId }
  | { type: 'Harvested'; block: BlockId; kilograms: number }
  | { type: 'TbsSold'; kilograms: number; price: number; revenue: number }
  | { type: 'BlockFertilized'; block: BlockId }
  | { type: 'ItemBought'; item: ItemId; quantity: number }
  | { type: 'KopdesUpgraded'; level: number }
  | { type: 'BurnStarted'; block: BlockId; intensity: FireIntensity }
  | { type: 'FireSpread'; from: BlockId; to: BlockId }
  | { type: 'BurnFinished'; block: BlockId }
  | { type: 'FireExtinguished'; block: BlockId }
  | { type: 'PalmsBurned'; block: BlockId; count: number }
  | { type: 'WildfireStarted' }
  | { type: 'WildfireEnded' }
  | { type: 'TimberSold'; block: BlockId; revenue: number }
  | { type: 'BlockSanitized'; block: BlockId; debris: number }
  | { type: 'BlockIrrigated'; block: BlockId }
  | { type: 'BlockDrained'; block: BlockId }
  | { type: 'YearPassed'; year: number }
  | { type: 'CashChanged'; cash: number };

export type SimEventType = SimEvent['type'];

/** Collects a tick's events. Reused across ticks to avoid per-tick allocation. */
export class EventSink {
  private events: SimEvent[] = [];

  push(event: SimEvent): void {
    this.events.push(event);
  }

  /** Hand over this tick's events and start a fresh list. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
