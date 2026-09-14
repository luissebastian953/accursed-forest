/**
 * The game loop (§4.2 step 3): fixed-step sim ticks on a wall-clock
 * accumulator, and a render callback every animation frame regardless of
 * tick rate. This is the one place wall-clock time lives (§4.3).
 *
 * The accumulator is capped: after a long stall (a hidden tab, a debugger
 * pause) the loop runs at most `maxTicksPerFrame` ticks and drops the rest,
 * rather than freezing the page to catch up on thousands of sim days.
 */

export interface GameLoopOptions {
  /** Current tick rate; read every frame so speed changes apply at once. */
  ticksPerSecond: () => number;
  tick: () => void;
  /** Called once per frame after any ticks, with seconds since the last frame. */
  frame: (dtSeconds: number, nowMs: number) => void;
  /** Ticks allowed per frame before the backlog is dropped. */
  maxTicksPerFrame?: number;
  /** Injected for tests. Defaults to `performance.now` and rAF. */
  now?: () => number;
  requestFrame?: (callback: (nowMs: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export class GameLoop {
  private readonly ticksPerSecond: () => number;
  private readonly tick: () => void;
  private readonly frame: (dtSeconds: number, nowMs: number) => void;
  private readonly maxTicksPerFrame: number;
  private readonly now: () => number;
  private readonly requestFrame: (callback: (nowMs: number) => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  private accumulatorMs = 0;
  private lastFrameMs: number | null = null;
  private lastRate = 0;
  private handle: number | null = null;

  constructor(options: GameLoopOptions) {
    this.ticksPerSecond = options.ticksPerSecond;
    this.tick = options.tick;
    this.frame = options.frame;
    this.maxTicksPerFrame = options.maxTicksPerFrame ?? 6;
    this.now = options.now ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((cb) => requestAnimationFrame(cb));
    this.cancelFrame = options.cancelFrame ?? ((h) => cancelAnimationFrame(h));
  }

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.lastFrameMs = null;
    this.accumulatorMs = 0;
    const onFrame = (nowMs: number): void => {
      // Schedule first: a frame that throws (a render or UI bug) must never
      // stop the simulation. The exception still reaches the console.
      this.handle = this.requestFrame(onFrame);
      this.step(nowMs);
    };
    this.handle = this.requestFrame(onFrame);
  }

  stop(): void {
    if (this.handle === null) return;
    this.cancelFrame(this.handle);
    this.handle = null;
  }

  /**
   * Advance to `nowMs`: run the ticks the elapsed time has earned, then one
   * frame. Public so tests can drive the loop without an animation frame.
   * Returns the number of ticks run.
   */
  step(nowMs: number = this.now()): number {
    const dtMs = this.lastFrameMs === null ? 0 : Math.max(0, nowMs - this.lastFrameMs);
    this.lastFrameMs = nowMs;

    const rate = this.ticksPerSecond();
    // A speed change must not release a burst of ticks earned at the old rate.
    if (rate !== this.lastRate) {
      this.accumulatorMs = 0;
      this.lastRate = rate;
    }

    let ticks = 0;
    if (rate > 0) {
      const intervalMs = 1000 / rate;
      this.accumulatorMs = Math.min(this.accumulatorMs + dtMs, intervalMs * this.maxTicksPerFrame);
      while (this.accumulatorMs >= intervalMs && ticks < this.maxTicksPerFrame) {
        this.tick();
        this.accumulatorMs -= intervalMs;
        ticks += 1;
      }
    } else {
      this.accumulatorMs = 0;
    }

    this.frame(dtMs / 1000, nowMs);
    return ticks;
  }
}
