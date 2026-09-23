import { rebuildActiveSet } from './activeSet.ts';
import { ECONOMY } from './balance/prices.ts';
import { SPOIL_FIRST } from './commands/excavateBlock.ts';
import { handlerFor } from './commands/index.ts';
import { EventSink, type SimEvent } from './events.ts';
import { runOver } from './run.ts';
import { createInitialState, type SimContext } from './state.ts';
import { economy } from './systems/economy.ts';
import { endings } from './systems/endings.ts';
import { growth } from './systems/growth.ts';
import { harvest } from './systems/harvest.ts';
import { mobs } from './systems/mobs.ts';
import { newsSystem } from './systems/news.ts';
import { pest } from './systems/pest.ts';
import { society } from './systems/society.ts';
import { terrain } from './systems/terrain.ts';
import { weather } from './systems/weather.ts';
import { worldEvents } from './systems/worldEvents.ts';
import type { Command, DispatchResult, Rejection, SimState } from './types.ts';
import { createWorld, type World } from './worldgen/index.ts';

export interface Sim {
  readonly state: SimState;
  readonly world: World;
  /** Why a command would be refused right now, or null if it would go through. */
  validate(command: Command): Rejection | null;
  dispatch(command: Command): DispatchResult;
  /** Advance one day. Returns the events that happened, oldest first. */
  tick(): SimEvent[];
}

export interface SimOptions {
  width?: number;
  height?: number;
  /** What the player called this estate; '' leaves it unnamed. */
  name?: string;
}

export function createSim(seed: number, options: SimOptions = {}): Sim {
  const world = createWorld(seed, options.width, options.height);

  return new SimImpl(createInitialState(world, options.name ?? ''), world);
}

/** Rebuild a `Sim` around state that came out of a save. */
export function restoreSim(state: SimState): Sim {
  const world = createWorld(state.worldGen.seed, state.worldGen.width, state.worldGen.height);

  return new SimImpl(state, world);
}

class SimImpl implements Sim {
  private readonly ctx: SimContext;

  constructor(
    readonly state: SimState,
    readonly world: World,
  ) {
    this.ctx = { state, world, events: new EventSink() };
  }

  validate(command: Command): Rejection | null {
    if (runOver(this.state) && command.type !== 'KeepPlaying') {
      return { ok: false, code: 'gameOver', reason: 'The run is over.' };
    }

    // Spoil stops everything but the digger, and saying so once here is what
    // keeps a command added later from quietly working on a buried hectare.
    if ('block' in command && command.type !== 'ExcavateBlock') {
      const block = this.state.blocks.get(command.block);

      if (block && block.landslideAt >= 0) {
        return { ok: false, code: 'wrongPhase', reason: SPOIL_FIRST };
      }
    }

    const handler = handlerFor(command);

    if (!handler) {
      return { ok: false, code: 'notImplemented', reason: `${command.type} is not available yet.` };
    }

    return handler.validate(this.ctx, command);
  }

  dispatch(command: Command): DispatchResult {
    const rejection = this.validate(command);

    if (rejection) return rejection;

    // validate() already proved the handler exists.
    handlerFor(command)!.apply(this.ctx, command);

    const log = this.state.commandLog;

    log.push({ tick: this.state.tick, command });
    if (log.length > ECONOMY.commandLogCap) log.splice(0, log.length - ECONOMY.commandLogCap);

    return { ok: true };
  }

  tick(): SimEvent[] {
    const { state, world } = this.ctx;

    if (runOver(state)) return this.ctx.events.drain();
    state.tick += 1;
    rebuildActiveSet(state, world);

    weather(this.ctx);
    worldEvents(this.ctx);
    terrain(this.ctx);
    growth(this.ctx);
    pest(this.ctx);
    harvest(this.ctx);
    economy(this.ctx);
    mobs(this.ctx);
    society(this.ctx);
    endings(this.ctx);
    newsSystem(this.ctx);

    return this.ctx.events.drain();
  }
}

export type { SimEvent } from './events.ts';
export type {
  Block,
  BlockId,
  Command,
  DispatchResult,
  GrowthStage,
  PalmArrays,
  Rejection,
  SimState,
} from './types.ts';
export { estateCodeFor, seedFromEstateCode } from './worldgen/index.ts';
