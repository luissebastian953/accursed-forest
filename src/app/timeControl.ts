/**
 * Sim speed (§4.2, §8 panel 2): pause · 1× · 5× · 20×.
 *
 * While anything burns the speed is locked to 1× — you watch your fire
 * (§3.1.1). The lock is separate from the requested speed so releasing it
 * returns the player to what they had chosen.
 */

export type Speed = 0 | 1 | 5 | 20;

export const SPEEDS: readonly Speed[] = [0, 1, 5, 20];

/** Ticks per real second at each speed. 1× is one sim day every 500 ms (§4.2). */
export const TICKS_PER_SECOND: Record<Speed, number> = { 0: 0, 1: 2, 5: 10, 20: 40 };

export type SpeedListener = (speed: Speed, locked: boolean) => void;

export class TimeControl {
  private requested: Speed = 1;
  private lastRunning: Speed = 1;
  private realtimeLock = false;
  private readonly listeners = new Set<SpeedListener>();

  /** What the player asked for, ignoring the fire lock. */
  get requestedSpeed(): Speed {
    return this.requested;
  }

  /** What the loop actually runs at. */
  get speed(): Speed {
    if (this.requested === 0) return 0;
    return this.realtimeLock ? 1 : this.requested;
  }

  get ticksPerSecond(): number {
    return TICKS_PER_SECOND[this.speed];
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
