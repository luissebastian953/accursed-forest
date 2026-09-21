/** Render scales it may use, best first. 1 is one buffer pixel per CSS pixel. */
const STEPS = [2, 1.5, 1.25, 1] as const;

export interface AdaptiveOptions {
  /** The best scale this display can use, usually `min(devicePixelRatio, 2)`. */
  cap: number;
  /** Mean frame time that means the machine is struggling. 20 ms is 50 fps. */
  slowMs?: number;
  /** Mean frame time that means it has room to spare again. */
  fastMs?: number;
  /** Wall time per verdict. A slow machine must not wait for a frame count. */
  windowMs?: number;
  /** Frames a verdict needs, so one bad frame cannot decide anything. */
  minFrames?: number;
  /** Frames after which it judges early, however fast they came. */
  maxFrames?: number;
  /** Good windows in a row before it climbs, so it does not oscillate. */
  patience?: number;
}

/**
 * Keeps the frame rate by spending fewer pixels, which is what a laptop with
 * an integrated GPU runs out of first (GDD 6.4).
 */
export class AdaptiveResolution {
  private readonly steps: number[];
  private readonly slowMs: number;
  private readonly fastMs: number;
  private readonly windowMs: number;
  private readonly minFrames: number;
  private readonly maxFrames: number;
  private readonly patience: number;

  private index = 0;
  private frames = 0;
  private total = 0;
  private goodWindows = 0;
  /** Once a machine has proved slow, climbing back needs to be earned twice over. */
  private droppedEver = false;

  constructor(options: AdaptiveOptions) {
    const {
      cap,
      slowMs = 20,
      fastMs = 11,
      windowMs = 1000,
      minFrames = 5,
      maxFrames = 120,
      patience = 4,
    } = options;

    this.steps = STEPS.filter((step) => step <= cap);
    if (this.steps.length === 0) this.steps = [cap];
    this.slowMs = slowMs;
    this.fastMs = fastMs;
    this.windowMs = windowMs;
    this.minFrames = minFrames;
    this.maxFrames = maxFrames;
    this.patience = patience;
  }

  get scale(): number {
    return this.steps[this.index]!;
  }

  /**
   * At the bottom step the machine has already given up every pixel it can,
   * so the glow pass goes too: several full-screen passes and 37 MB of it.
   */
  get lean(): boolean {
    return this.index >= this.steps.length - 1 && this.steps.length > 1;
  }

  /**
   * Feed one frame. Returns the new scale when it changes, or null, so the
   * caller only touches the renderer on a verdict rather than every frame.
   */
  sample(frameMs: number): number | null {
    // A stall (a tab in the background, a long task) is not a slow machine.
    if (frameMs > 1000) return null;

    this.frames += 1;
    this.total += frameMs;

    // Judge on elapsed time, not on a frame count: at two frames a second a
    // count would take half a minute to notice the machine is drowning.
    const enough =
      this.frames >= this.maxFrames ||
      (this.total >= this.windowMs && this.frames >= this.minFrames);

    if (!enough) return null;

    const mean = this.total / this.frames;

    this.frames = 0;
    this.total = 0;

    if (mean > this.slowMs && this.index < this.steps.length - 1) {
      this.index += 1;
      this.goodWindows = 0;
      this.droppedEver = true;
      return this.scale;
    }

    if (mean < this.fastMs && this.index > 0) {
      this.goodWindows += 1;

      if (this.goodWindows >= this.patience * (this.droppedEver ? 2 : 1)) {
        this.index -= 1;
        this.goodWindows = 0;
        return this.scale;
      }

      return null;
    }

    if (mean >= this.fastMs) this.goodWindows = 0;
    return null;
  }
}
