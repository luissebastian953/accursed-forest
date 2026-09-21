export type ToastVerdict = 'show' | 'repeat' | 'drop';

export interface ToastPolicyOptions {
  /** Quiet between notices, so one cannot replace another before it is read. */
  minGapMs?: number;
  /** How long the same words count as the same notice happening again. */
  repeatWindowMs?: number;
}

/**
 * What to do with a notice the estate wants to raise. At 50x a day passes every
 * tenth of a second, and without this the strip blinks rather than reads.
 */
export class ToastPolicy {
  private readonly minGapMs: number;
  private readonly repeatWindowMs: number;
  private lastShownAt = -Infinity;
  private recent = new Map<string, number>();

  constructor({ minGapMs = 700, repeatWindowMs = 4500 }: ToastPolicyOptions = {}) {
    this.minGapMs = minGapMs;
    this.repeatWindowMs = repeatWindowMs;
  }

  /**
   * Nothing is dropped while the strip has room, and a warning never is:
   * `repeat` counts the same words again, `drop` spares an unread notice.
   */
  offer(
    text: string,
    kind: 'info' | 'warn' | 'error',
    now: number,
    live: number,
    room: number,
  ): ToastVerdict {
    this.forget(now);

    if (this.recent.has(text)) {
      this.recent.set(text, now);
      return 'repeat';
    }

    const crowded = live >= room;

    if (kind === 'info' && crowded && now - this.lastShownAt < this.minGapMs) return 'drop';

    this.lastShownAt = now;
    this.recent.set(text, now);
    return 'show';
  }

  /** A notice taken off the screen by hand stops counting as recent. */
  forgetText(text: string): void {
    this.recent.delete(text);
  }

  private forget(now: number): void {
    for (const [text, at] of this.recent) {
      if (now - at > this.repeatWindowMs) this.recent.delete(text);
    }
  }
}
