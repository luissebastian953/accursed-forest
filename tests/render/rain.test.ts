import { MeshBasicMaterial } from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import type { GroundRect } from '@render/camera/MapRig.ts';
import { Rain } from '@render/scene/Rain.ts';
import { SKY } from '@sim/balance/seasons';
import { skyFor } from '@sim/systems/weather';
import type { SkyCondition } from '@sim/types';

const VIEW: GroundRect = { minX: 0, maxX: 120, minZ: 0, maxZ: 120 };

/** Run the shower for `seconds` at 60 fps and return how many drops fall. */
function run(rain: number, sky: SkyCondition, seconds = 8): number {
  const effect = new Rain(new MeshBasicMaterial());
  for (let t = 0; t < seconds; t += 1 / 60) effect.update(1 / 60, rain, sky, VIEW, true);
  const count = effect.mesh.count;
  effect.dispose();
  return count;
}

describe('rain', () => {
  it('falls only on the days the sky itself calls rain', () => {
    // A damp day the HUD calls cloudy: nothing falls, whatever the number is.
    expect(skyFor(SKY.rainAbove - 0.01)).toBe('cloudy');
    expect(run(SKY.rainAbove - 0.01, 'cloudy')).toBe(0);
    expect(run(0.3, 'cloudy')).toBe(0);
    expect(run(0, 'clear')).toBe(0);
  });

  it('shows something from the first rainy day, and thickens with the rain', () => {
    const light = run(SKY.rainAbove, 'rain');
    const heavy = run(1, 'storm');
    expect(light).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(light);
  });

  it('agrees with the sky the weather system reports', () => {
    // The two thresholds used to differ, so a cloudy day rained on screen.
    for (const rain of [0, 0.2, 0.34, 0.36, 0.44, 0.46, 0.7, 0.9, 1]) {
      const sky = skyFor(rain);
      const falls = run(rain, sky, 4) > 0;
      expect(falls, `rain ${rain} reads as ${sky}`).toBe(sky === 'rain' || sky === 'storm');
    }
  });
});
