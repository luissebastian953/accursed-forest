import { describe, expect, it } from 'vitest';

import { BoxBuilder } from '@render/geometry/boxBuilder.ts';
import { MODELS, ModelKit } from '@render/models/index.ts';

/** Lay a model out at the origin many times and measure how far it really reaches. */
function reach(id: keyof typeof MODELS): { radius: number; height: number; triangles: number } {
  let radius = 0;
  let height = 0;
  let triangles = 0;
  for (let seed = 0; seed < 40; seed++) {
    const builder = new BoxBuilder();
    const kit = new ModelKit(builder).at({ x: 0, y: 0, z: 0, scale: 1, turn: seed });
    let n = seed * 7919;
    MODELS[id].build(kit, () => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    const { positions } = builder.toArrays();
    for (let i = 0; i < positions.length; i += 3) {
      radius = Math.max(radius, Math.hypot(positions[i]!, positions[i + 2]!));
      height = Math.max(height, positions[i + 1]!);
    }
    triangles = Math.max(triangles, builder.triangleCount);
  }
  return { radius, height, triangles };
}

describe('scenery models (GDD 6.3)', () => {
  for (const id of Object.keys(MODELS) as (keyof typeof MODELS)[]) {
    it(`${MODELS[id].name}: stays inside its declared radius, and is cheap`, () => {
      const r = reach(id);
      expect(r.radius, `${id} reaches ${r.radius.toFixed(2)}`).toBeLessThanOrEqual(
        MODELS[id].radius,
      );
      expect(r.height).toBeGreaterThan(0.1);
      expect(r.triangles).toBeLessThan(260);
    });
  }
});
