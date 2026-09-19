import { MeshBasicMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { Coins } from '@render/scene/Coins.ts';

function make(): Coins {
  return new Coins(new MeshBasicMaterial());
}

/** Run the effect for `seconds` at 60 fps. */
function run(coins: Coins, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) coins.update(1 / 60);
}

describe('gold coins', () => {
  it('throws a burst up and lands it back where it came from', () => {
    const coins = make();

    coins.burst(10, 4, -6, 12);
    expect(coins.count).toBe(12);

    // Up first: every coin is above the ground it was thrown from.
    run(coins, 0.2);

    const matrix = coins.mesh.instanceMatrix.array;
    let highest = -Infinity;

    for (let i = 0; i < coins.count; i++) highest = Math.max(highest, matrix[i * 16 + 13]!);
    expect(highest).toBeGreaterThan(4);

    // ...then down: nothing ends up under the ground it landed on.
    run(coins, 1);

    let lowest = Infinity;

    for (let i = 0; i < coins.count; i++) lowest = Math.min(lowest, matrix[i * 16 + 13]!);
    expect(lowest).toBeGreaterThanOrEqual(4);
  });

  it('clears itself up: a burst is gone a second and a half later', () => {
    const coins = make();

    coins.burst(0, 0, 0, 10);
    run(coins, 1.4);
    expect(coins.count).toBeGreaterThan(0);
    run(coins, 0.5);
    expect(coins.count).toBe(0);
    expect(coins.mesh.count).toBe(0);
  });

  it('spreads out from the point it was thrown at, and never off the map', () => {
    const coins = make();

    coins.burst(100, 2, 50, 16);
    run(coins, 1.2);

    const matrix = coins.mesh.instanceMatrix.array;
    let spread = 0;

    for (let i = 0; i < coins.count; i++) {
      const dx = matrix[i * 16 + 12]! - 100;
      const dz = matrix[i * 16 + 14]! - 50;

      spread = Math.max(spread, Math.hypot(dx, dz));
    }

    expect(spread).toBeGreaterThan(0.5);
    expect(spread).toBeLessThan(8);
  });

  it('takes a burst bigger than its pool without breaking', () => {
    const coins = make();

    for (let i = 0; i < 40; i++) coins.burst(0, 0, 0, 12);
    expect(coins.count).toBeLessThanOrEqual(160);
    run(coins, 0.1);
    expect(coins.mesh.count).toBe(coins.count);
    coins.clear();
    expect(coins.count).toBe(0);
  });
});
