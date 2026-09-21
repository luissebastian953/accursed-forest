import { describe, expect, it } from 'vitest';

import { AdaptiveResolution } from '@render/quality.ts';

/** Feed frames of one length until it changes the scale, or give up. */
function untilVerdict(q: AdaptiveResolution, frameMs: number, limit = 2000): number | null {
  for (let i = 0; i < limit; i++) {
    const scale = q.sample(frameMs);

    if (scale !== null) return scale;
  }

  return null;
}

describe('adaptive resolution (GDD 6.4)', () => {
  it('starts at what the display can do and says nothing while frames are fine', () => {
    const q = new AdaptiveResolution({ cap: 2 });

    expect(q.scale).toBe(2);
    expect(untilVerdict(q, 8)).toBeNull();
    expect(q.scale).toBe(2);
  });

  it('spends fewer pixels when frames run long, one step at a time', () => {
    const q = new AdaptiveResolution({ cap: 2 });

    expect(untilVerdict(q, 30)).toBe(1.5);
    expect(untilVerdict(q, 30)).toBe(1.25);
    expect(untilVerdict(q, 30)).toBe(1);
    // The floor holds: it never asks for less than one buffer pixel per pixel.
    expect(untilVerdict(q, 30)).toBeNull();
    expect(q.scale).toBe(1);
  });

  it('notices a drowning machine in seconds, not in frames', () => {
    const q = new AdaptiveResolution({ cap: 2 });
    let frames = 0;

    // Two frames a second: a frame-counted window would take half a minute.
    while (q.sample(500) === null && frames < 100) frames += 1;
    expect(frames).toBeLessThan(10);
    expect(q.scale).toBe(1.5);
  });

  it('climbs back when the machine proves it has room, but makes it earn it', () => {
    const q = new AdaptiveResolution({ cap: 2, patience: 2 });

    expect(untilVerdict(q, 30)).toBe(1.5);
    // Having dropped once, patience doubles before it spends pixels again.
    expect(untilVerdict(q, 6)).toBe(2);
  });

  it('a stall is not a slow machine', () => {
    const q = new AdaptiveResolution({ cap: 2 });

    // A backgrounded tab hands back enormous frames; they must not count.
    expect(untilVerdict(q, 5000)).toBeNull();
    expect(q.scale).toBe(2);
  });

  it('goes lean only at the bottom, where the glow pass is worth giving up', () => {
    const q = new AdaptiveResolution({ cap: 2 });

    expect(q.lean).toBe(false);
    untilVerdict(q, 30);
    expect(q.lean).toBe(false);
    untilVerdict(q, 30);
    untilVerdict(q, 30);
    expect(q.scale).toBe(1);
    expect(q.lean).toBe(true);
  });

  it('a display with one step to give has nothing to go lean with', () => {
    const q = new AdaptiveResolution({ cap: 1 });

    expect(q.lean).toBe(false);
    untilVerdict(q, 40);
    expect(q.lean).toBe(false);
  });

  it('never offers a scale the display cannot use', () => {
    const q = new AdaptiveResolution({ cap: 1 });

    expect(q.scale).toBe(1);
    expect(untilVerdict(q, 40)).toBeNull();

    const low = new AdaptiveResolution({ cap: 1.5 });

    expect(low.scale).toBe(1.5);
    expect(untilVerdict(low, 40)).toBe(1.25);
  });
});
