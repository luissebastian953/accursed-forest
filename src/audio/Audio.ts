/**
 * The mixer (§6.6): one audio context, four buses, and the rules that keep a
 * fast clock from turning the estate into noise.
 *
 * Nothing is created until the player's first click, because a browser will
 * not start an audio context without a gesture. Until then every call is a
 * no-op, which also means the sim and the tests can run with no audio at all.
 */

import { LOOPS, ONE_SHOTS, type LoopHandle, type LoopId, type OneShotId } from './sounds.ts';

/** The buses. Each has its own level, so a player can keep music and lose UI. */
export type Bus = 'ui' | 'world' | 'drama' | 'music';

const BUS_OF: Record<OneShotId | LoopId, Bus> = {
  'ui-button-press': 'ui',
  'ui-button-denied': 'ui',
  'coins-burst': 'ui',
  'cash-in': 'ui',
  'cash-out': 'ui',
  'chop-stroke': 'world',
  landslide: 'drama',
  'thunder-near': 'world',
  'rain-light': 'world',
  'fire-crackle': 'world',
  'excavator-engine': 'world',
  'police-siren': 'drama',
};

/** How close together the same sound may fire, in milliseconds. */
const MIN_GAP_MS: Partial<Record<OneShotId, number>> = {
  'ui-button-press': 40,
  'chop-stroke': 90,
  'coins-burst': 120,
  'cash-in': 150,
  'cash-out': 150,
};
const DEFAULT_GAP_MS = 60;

/** At 50x the clock throws events in handfuls; this is the ceiling per frame. */
const MAX_PER_FRAME = 3;
const FRAME_MS = 16;

export interface AudioSettings {
  muted: boolean;
  /** Master, 0..1. */
  volume: number;
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buses = new Map<Bus, GainNode>();
  private readonly running = new Map<LoopId, LoopHandle>();
  private readonly lastPlayed = new Map<string, number>();
  private frameAt = 0;
  private thisFrame = 0;
  private settings: AudioSettings = { muted: false, volume: 0.7 };

  /** Whether the context is up. False until the first gesture unlocks it. */
  get ready(): boolean {
    return this.ctx !== null;
  }

  /**
   * Start the context. Call from a click handler: browsers refuse anywhere
   * else. Calling it twice is harmless.
   */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      typeof AudioContext !== 'undefined' ? AudioContext : undefined;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    master.connect(ctx.destination);
    for (const bus of ['ui', 'world', 'drama', 'music'] as const) {
      const gain = ctx.createGain();
      // The UI sits well under the world: it is chrome, not the estate.
      gain.gain.value = bus === 'ui' ? 0.45 : bus === 'music' ? 0.6 : 0.9;
      gain.connect(master);
      this.buses.set(bus, gain);
    }
    this.ctx = ctx;
    this.master = master;
  }

  setSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.master) {
      this.master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setBusLevel(bus: Bus, level: number): void {
    const gain = this.buses.get(bus);
    if (gain) gain.gain.value = Math.max(0, Math.min(1, level));
  }

  /**
   * Fire a one-shot, unless it fired a moment ago or the frame is already
   * full. Returns whether it actually played, which the tests read.
   */
  play(id: OneShotId, nowMs = performance.now()): boolean {
    const ctx = this.ctx;
    if (!ctx || this.settings.muted) return false;

    // Calls inside one frame arrive microseconds apart, never at the same
    // instant, so the frame is anything within a frame's width of the last.
    if (nowMs - this.frameAt > FRAME_MS) {
      this.frameAt = nowMs;
      this.thisFrame = 0;
    }
    if (this.thisFrame >= MAX_PER_FRAME) return false;

    const gap = MIN_GAP_MS[id] ?? DEFAULT_GAP_MS;
    const last = this.lastPlayed.get(id) ?? -Infinity;
    if (nowMs - last < gap) return false;

    const bus = this.buses.get(BUS_OF[id]);
    if (!bus) return false;
    ONE_SHOTS[id](ctx, bus, ctx.currentTime);
    this.lastPlayed.set(id, nowMs);
    this.thisFrame += 1;
    return true;
  }

  /** Start a loop if it is not already running. */
  startLoop(id: LoopId): void {
    const ctx = this.ctx;
    if (!ctx || this.running.has(id)) return;
    const bus = this.buses.get(BUS_OF[id]);
    if (!bus) return;
    this.running.set(id, LOOPS[id](ctx, bus, ctx.currentTime));
  }

  /** Stop a loop, fading it out rather than cutting it. */
  stopLoop(id: LoopId): void {
    const handle = this.running.get(id);
    if (!handle || !this.ctx) return;
    handle.stop(this.ctx.currentTime);
    this.running.delete(id);
  }

  /** Ride a loop's level, for rain getting heavier or a fire dying down. */
  setLoopLevel(id: LoopId, level: number): void {
    const handle = this.running.get(id);
    if (!handle || !this.ctx) return;
    const at = this.ctx.currentTime;
    handle.gain.gain.cancelScheduledValues(at);
    handle.gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, level)), at + 0.2);
  }

  isLooping(id: LoopId): boolean {
    return this.running.has(id);
  }

  dispose(): void {
    for (const id of [...this.running.keys()]) this.stopLoop(id);
    this.buses.clear();
    this.master = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}

export { LOOPS, ONE_SHOTS, type LoopId, type OneShotId };
