/**
 * Events a tick produces (§4.2 step 4).
 *
 * `sim/` does not emit; `tick()` returns the array and the layers above consume
 * it after the tick, syncing only what changed. Every event names the blocks it
 * touched so `render/sync.ts` can build its dirty set without diffing state.
 */

import type {
  BlockId,
  Ending,
  FireIntensity,
  GrowthStage,
  ItemId,
  MobSpecies,
  Species,
  YearSummary,
} from './types.ts';

export type SimEvent =
  | { type: 'BlockChanged'; block: BlockId }
  | { type: 'BlockPlanted'; block: BlockId; species: Species; count: number }
  | { type: 'BlockCleared'; block: BlockId }
  | { type: 'BlockBought'; block: BlockId }
  | { type: 'KopdesPlaced'; block: BlockId }
  | { type: 'PalmStageChanged'; block: BlockId; slot: number; from: GrowthStage; to: GrowthStage }
  | {
      type: 'PalmDied';
      block: BlockId;
      slot: number;
      cause: 'ganoderma' | 'beetles' | 'age' | 'flood' | 'ash';
    }
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
  | { type: 'AutoHarvestSet'; on: boolean }
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
  | { type: 'WeatherEventStarted'; id: string; days: number }
  | { type: 'WeatherEventEnded'; id: string }
  | { type: 'Landslide'; block: BlockId; below: BlockId | null; palmsLost: number }
  | { type: 'BlockFlooded'; block: BlockId }
  | { type: 'AshSettled'; blocks: number }
  | { type: 'SparkCaught'; block: BlockId }
  | { type: 'LightningStruck'; block: BlockId; ignited: boolean }
  | { type: 'CoverCropSown'; block: BlockId }
  | { type: 'ForestChopped'; block: BlockId }
  | { type: 'MacroEventStarted'; id: string; days: number }
  | { type: 'MacroEventEnded'; id: string }
  | { type: 'InputPricesRose'; index: number }
  | { type: 'IntegrityScandal'; integrity: number }
  | { type: 'LetterReceived' }
  | {
      type: 'InvestigationOpened';
      until: number;
      reason: 'attention' | 'wildfire' | 'protectedForest';
    }
  | { type: 'InvestigationSettled'; cost: number }
  | { type: 'InvestigationClosed' }
  | { type: 'Arrested'; reason: 'attention' | 'secondWildfire' }
  | { type: 'OperatingBanned'; until: number }
  | { type: 'OperatingBanLifted' }
  | { type: 'YearClosed'; summary: YearSummary }
  | { type: 'Certified'; clean: boolean; waived: ('noBurn' | 'forest')[] }
  | { type: 'RunEnded'; ending: Ending }
  | { type: 'SandboxStarted' }
  | {
      type: 'NewsPublished';
      key: string;
      lane: 'natural' | 'economic' | 'government';
      severity: 'info' | 'notice' | 'warning' | 'critical';
    }
  | { type: 'MobArrived'; id: number; species: MobSpecies; block: BlockId }
  | { type: 'MobLeft'; id: number; species: MobSpecies }
  | { type: 'HarvestStolen'; block: BlockId; kilograms: number }
  | { type: 'CashStolen'; amount: number }
  | { type: 'ThiefCaught'; block: BlockId }
  | { type: 'WorkerHired'; kind: 'sanitizer' | 'plantDoctor' | 'security'; fee: number }
  | { type: 'WorkerDismissed'; kind: 'sanitizer' | 'plantDoctor' | 'security' }
  | { type: 'YearPassed'; year: number }
  | { type: 'CashChanged'; cash: number };

export type SimEventType = SimEvent['type'];

/** Collects a tick's events. Reused across ticks to avoid per-tick allocation. */
export class EventSink {
  private events: SimEvent[] = [];

  push(event: SimEvent): void {
    this.events.push(event);
  }

  /** This tick's events so far, without taking them. Later systems read earlier ones. */
  peek(): readonly SimEvent[] {
    return this.events;
  }

  /** Hand over this tick's events and start a fresh list. */
  drain(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
