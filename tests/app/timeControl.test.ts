import { describe, expect, it } from 'vitest';

import {
  FIRE_LOCK_SPEED,
  SPEEDS,
  speedNeedsKopdes,
  TICKS_PER_SECOND,
  TimeControl,
  TURBO_KOPDES_LEVEL,
  TURBO_SPEED,
} from '@app/timeControl';

describe('the fire lock', () => {
  it('caps the clock rather than pinning it to real time', () => {
    const time = new TimeControl();

    time.set(TURBO_SPEED);
    time.lockToRealtime(true);
    expect(time.speed).toBe(FIRE_LOCK_SPEED);
    // What the player asked for survives the lock.
    expect(time.requestedSpeed).toBe(TURBO_SPEED);
    time.lockToRealtime(false);
    expect(time.speed).toBe(TURBO_SPEED);
  });

  it('leaves a pause paused', () => {
    const time = new TimeControl();

    time.set(0);
    time.lockToRealtime(true);
    expect(time.speed).toBe(0);
    expect(time.ticksPerSecond).toBe(0);
  });
});

describe('the Kopdes gate on 50x', () => {
  it('shuts only the turbo speed, and only below the level', () => {
    for (const speed of SPEEDS) {
      expect(speedNeedsKopdes(speed, TURBO_KOPDES_LEVEL)).toBe(false);
      expect(speedNeedsKopdes(speed, 0)).toBe(speed === TURBO_SPEED);
    }
  });

  it('opens the moment the Kopdes reaches the level', () => {
    expect(speedNeedsKopdes(TURBO_SPEED, TURBO_KOPDES_LEVEL - 1)).toBe(true);
    expect(speedNeedsKopdes(TURBO_SPEED, TURBO_KOPDES_LEVEL)).toBe(false);
    expect(speedNeedsKopdes(TURBO_SPEED, TURBO_KOPDES_LEVEL + 1)).toBe(false);
  });

  it('gates a speed the clock could otherwise run', () => {
    expect(TICKS_PER_SECOND[TURBO_SPEED]).toBeGreaterThan(TICKS_PER_SECOND[FIRE_LOCK_SPEED]);
  });
});
