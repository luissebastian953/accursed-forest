import { describe, expect, it } from 'vitest';

import { GameLoop } from '@app/loop.ts';
import { TICKS_PER_SECOND, TimeControl } from '@app/timeControl.ts';

function harness(rate: () => number, maxTicksPerFrame?: number) {
  let ticks = 0;
  const frames: number[] = [];
  const loop = new GameLoop(
    maxTicksPerFrame === undefined
      ? {
          ticksPerSecond: rate,
          tick: () => {
            ticks += 1;
          },
          frame: (dt) => frames.push(dt),
          now: () => 0,
          requestFrame: () => 1,
          cancelFrame: () => {},
        }
      : {
          ticksPerSecond: rate,
          tick: () => {
            ticks += 1;
          },
          frame: (dt) => frames.push(dt),
          maxTicksPerFrame,
          now: () => 0,
          requestFrame: () => 1,
          cancelFrame: () => {},
        },
  );
  return { loop, ticks: () => ticks, frames };
}

describe('game loop (§4.2)', () => {
  it('runs 1× as one tick every 500 ms', () => {
    const h = harness(() => TICKS_PER_SECOND[1]);
    h.loop.step(0);
    // 63 frames of 16 ms = 1008 ms: two 500 ms ticks, with 8 ms left over.
    for (let t = 16; t <= 1008; t += 16) h.loop.step(t);
    expect(h.ticks()).toBe(2);
  });

  it('runs 20× as 40 ticks per second at a 60 Hz frame rate', () => {
    const h = harness(() => TICKS_PER_SECOND[20]);
    h.loop.step(0);
    for (let t = 1000 / 60; t <= 1000; t += 1000 / 60) h.loop.step(t);
    expect(h.ticks()).toBeGreaterThanOrEqual(39);
    expect(h.ticks()).toBeLessThanOrEqual(40);
  });

  it('renders a frame every step, ticks or not', () => {
    const h = harness(() => 0);
    h.loop.step(0);
    h.loop.step(16);
    h.loop.step(32);
    expect(h.frames.length).toBe(3);
    expect(h.ticks()).toBe(0);
  });

  it('drops the backlog after a stall instead of catching up', () => {
    const h = harness(() => TICKS_PER_SECOND[20], 6);
    h.loop.step(0);
    h.loop.step(5000); // five seconds hidden: would be 200 ticks
    expect(h.ticks()).toBe(6);
    // and the excess is gone, not queued
    h.loop.step(5016);
    expect(h.ticks()).toBeLessThanOrEqual(7);
  });

  it('a speed change does not release a burst earned at the old rate', () => {
    let rate = TICKS_PER_SECOND[1];
    const h = harness(() => rate);
    h.loop.step(0);
    h.loop.step(400); // 80% of the way to a 1× tick
    rate = TICKS_PER_SECOND[20];
    h.loop.step(401); // 1 ms at 20×: not enough for a tick
    expect(h.ticks()).toBe(0);
  });

  it('pausing resets the accumulator', () => {
    let rate = TICKS_PER_SECOND[1];
    const h = harness(() => rate);
    h.loop.step(0);
    h.loop.step(499);
    rate = 0;
    h.loop.step(600);
    rate = TICKS_PER_SECOND[1];
    h.loop.step(700);
    expect(h.ticks()).toBe(0);
  });

  it('start/stop drive the frame scheduler', () => {
    const scheduled: ((t: number) => void)[] = [];
    let cancelled = 0;
    let ticks = 0;
    const loop = new GameLoop({
      ticksPerSecond: () => 2,
      tick: () => {
        ticks += 1;
      },
      frame: () => {},
      now: () => 0,
      requestFrame: (cb) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      cancelFrame: () => {
        cancelled += 1;
      },
    });

    loop.start();
    expect(loop.running).toBe(true);
    scheduled.shift()!(0);
    scheduled.shift()!(600);
    expect(ticks).toBe(1);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(cancelled).toBe(1);
  });
});

describe('game loop resilience', () => {
  it('a frame that throws does not stop the loop', () => {
    const scheduled: ((t: number) => void)[] = [];
    let frames = 0;
    const loop = new GameLoop({
      ticksPerSecond: () => 0,
      tick: () => {},
      frame: () => {
        frames += 1;
        if (frames === 1) throw new Error('render bug');
      },
      now: () => 0,
      requestFrame: (cb) => {
        scheduled.push(cb);
        return scheduled.length;
      },
      cancelFrame: () => {},
    });

    loop.start();
    expect(() => scheduled.shift()!(0)).toThrow('render bug');
    // The next frame was already requested before the throwing one ran.
    expect(scheduled.length).toBe(1);
    scheduled.shift()!(16);
    expect(frames).toBe(2);
    expect(loop.running).toBe(true);
  });
});

describe('time control (§3.1.1, §8)', () => {
  it('defaults to 1× and reports ticks per second', () => {
    const tc = new TimeControl();
    expect(tc.speed).toBe(1);
    expect(tc.ticksPerSecond).toBe(2);
  });

  it('toggles pause back to the last running speed', () => {
    const tc = new TimeControl();
    tc.set(20);
    tc.togglePause();
    expect(tc.speed).toBe(0);
    expect(tc.paused).toBe(true);
    tc.togglePause();
    expect(tc.speed).toBe(20);
  });

  it('the fire lock caps the speed at 5× without forgetting the request', () => {
    const tc = new TimeControl();
    tc.set(20);
    tc.lockToRealtime(true);
    expect(tc.speed).toBe(5);
    expect(tc.requestedSpeed).toBe(20);
    expect(tc.locked).toBe(true);
    tc.lockToRealtime(false);
    expect(tc.speed).toBe(20);
  });

  it('the fire lock does not unpause', () => {
    const tc = new TimeControl();
    tc.set(0);
    tc.lockToRealtime(true);
    expect(tc.speed).toBe(0);
  });

  it('notifies subscribers on every effective change, and unsubscribes cleanly', () => {
    const tc = new TimeControl();
    const seen: [number, boolean][] = [];
    const off = tc.subscribe((s, l) => seen.push([s, l]));
    tc.set(5);
    tc.set(5); // no-op
    tc.lockToRealtime(true);
    off();
    tc.set(20);
    expect(seen).toEqual([
      [5, false],
      [5, true],
    ]);
  });
});
