import { uniform, vec3 } from 'three/tsl';
import { AdditiveBlending, Group, Mesh, MeshBasicNodeMaterial, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { BlockId, SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { ELEVATION_STEP, terraceHeight } from './chunkField.ts';

/** How long a bolt stays on screen. */
const BOLT_MS = 420;
/** How many bolts can be on screen at once. */
const BOLTS = 3;
const HEIGHT = 26;

/** A zigzag of boxes from the clouds to the ground. */
function boltGeometry(seed: number) {
  const b = new BoxBuilder();
  const steps = 7;
  let x = 0;
  let z = 0;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const y = HEIGHT * (1 - t);
    const h = HEIGHT / steps + 0.6;
    const jitter = Math.sin(seed * 12.9898 + i * 4.1) * 1.4 * (1 - t);
    const jitterZ = Math.cos(seed * 78.233 + i * 2.7) * 1.4 * (1 - t);

    b.addAABox(x + jitter / 2, y - h / 2, z + jitterZ / 2, 0.85, h, 0.85, { side: Palette.Water });
    x += jitter;
    z += jitterZ;
  }

  return b.build();
}

export class Lightning {
  readonly group = new Group();
  private readonly bolts: { mesh: Mesh; level: { value: number }; firedAt: number }[] = [];
  private next = 0;

  constructor() {
    for (let i = 0; i < BOLTS; i++) {
      const level = uniform(0);
      const material = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });

      material.colorNode = vec3(3.6, 4.6, 6.2).mul(level);
      material.opacityNode = level;

      const mesh = new Mesh(boltGeometry(i + 1), material);

      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.bolts.push({ mesh, level, firedAt: -1 });
    }
  }

  /** Throw a bolt at a block. */
  strike(state: SimState, world: World, block: BlockId, nowMs: number): void {
    const bolt = this.bolts[this.next % this.bolts.length]!;

    this.next += 1;

    const [bx, by] = world.toXY(block);
    const generated = world.generated(bx, by);
    const diverged = state.blocks.get(block);
    const terraced = diverged && diverged.phase !== 'wild';
    const y = terraceHeight(generated.elevation) + (terraced ? 0 : ELEVATION_STEP);
    const half = WORLD.blockSide / 2;

    bolt.mesh.position.set(bx * WORLD.blockSide + half, y, by * WORLD.blockSide + half);
    bolt.mesh.visible = true;
    bolt.firedAt = nowMs;
  }

  update(nowMs: number): void {
    for (const bolt of this.bolts) {
      if (bolt.firedAt < 0) continue;

      const t = clamp01((nowMs - bolt.firedAt) / BOLT_MS);

      if (t >= 1) {
        bolt.mesh.visible = false;
        bolt.level.value = 0;
        bolt.firedAt = -1;
        continue;
      }

      // Bright, then two flickers on the way out.
      bolt.level.value = (1 - t) * (t < 0.25 || (t > 0.4 && t < 0.55) ? 1 : 0.35);
    }
  }

  dispose(): void {
    for (const bolt of this.bolts) {
      bolt.mesh.geometry.dispose();
      (bolt.mesh.material as Material).dispose();
    }
  }
}
