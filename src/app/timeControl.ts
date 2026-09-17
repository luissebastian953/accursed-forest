/**
 * Sim speed (§4.2, §8 panel 2): pause, 1×, 10×, 50×.
 *
 * While anything burns the speed is locked to 1×; you watch your fire
 * (§3.1.1). The lock is separate from the requested speed so releasing it
 * returns the player to what they had chosen.
 */

export type Speed = 0 | 1 | 10 | 50;

export const SPEEDS: readonly Speed[] = [0, 1, 10, 50];

/** The fastest the clock runs while anything is burning. */
export const FIRE_LOCK_SPEED = 10 satisfies Speed;

/** Skipping whole weeks is something the estate earns, not something it starts with. */
export const TURBO_SPEED = 50 satisfies Speed;

/** The Kopdes level that unlocks {@link TURBO_SPEED}. */
export const TURBO_KOPDES_LEVEL = 3;

/**
 * Whether a speed is still behind the Kopdes. The rule lives here so the
 * button, the keyboard and the loop all read it from one place.
 */
export function speedNeedsKopdes(speed: Speed, kopdesLevel: number): boolean {
  return speed >= TURBO_SPEED && kopdesLevel < TURBO_KOPDES_LEVEL;
}

/**
 * Ticks per real second at each speed. 1× is one sim day every ten seconds
 * (§4.2): long enough to watch a crew work a tree and a boar cross a block.
 * 10× is a day a second, 50× five days a second; a year in about a minute.
 */
export const TICKS_PER_SECOND: Record<Speed, number> = { 0: 0, 1: 0.1, 10: 1, 50: 5 };

export type SpeedListener = (speed: Speed, locked: boolean) => void;

export class TimeControl {
  private requested: Speed = 1;
  private lastRunning: Speed = 1;
  private realtimeLock = false;
  private readonly listeners = new Set<SpeedListener>();

  /**
   * @param rateScale multiplies every rate; `?turbo` sets 20 so the browser
   * suite can skip years in seconds. Never a gameplay setting.
   */
  constructor(private readonly rateScale = 1) {}

  /** What the player asked for, ignoring the fire lock. */
  get requestedSpeed(): Speed {
    return this.requested;
  }

  /** What the loop actually runs at. */
  get speed(): Speed {
    if (this.requested === 0) return 0;
    // Fire is worth watching, but not at a crawl: the lock caps the clock
    // rather than pinning it to real time.
    return this.realtimeLock && this.requested > FIRE_LOCK_SPEED ? FIRE_LOCK_SPEED : this.requested;
  }

  get ticksPerSecond(): number {
    return TICKS_PER_SECOND[this.speed] * this.rateScale;
  }

  /** Real seconds one sim day takes right now (Infinity while paused). */
  get secondsPerTick(): number {
    const rate = this.ticksPerSecond;
    return rate > 0 ? 1 / rate : Infinity;
  }

  get locked(): boolean {
    return this.realtimeLock;
  }

  get paused(): boolean {
    return this.requested === 0;
  }

  set(speed: Speed): void {
    if (speed === this.requested) return;
    this.requested = speed;
    if (speed !== 0) this.lastRunning = speed;
    this.emit();
  }

  togglePause(): void {
    this.set(this.requested === 0 ? this.lastRunning : 0);
  }

  lockToRealtime(on: boolean): void {
    if (on === this.realtimeLock) return;
    this.realtimeLock = on;
    this.emit();
  }

  subscribe(listener: SpeedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.speed, this.realtimeLock);
  }
}
