/**
 * Fire on burning blocks (§6.4 "Fire": emissive faceted shapes and a little
 * smoke). Boxes, like everything else: a handful of flame slabs per block
 * scaled by intensity, a smoke block above each, all in one merged mesh that
 * flickers as a whole. Rebuilt only when the set of burning blocks changes.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

const FLAMES: Record<number, number> = { 1: 5, 2: 9, 3: 14 };

function hash01(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

export class Fires {
  readonly group = new Group();
  private readonly mesh: Mesh;
  private key = '';

  constructor(material: Material) {
    this.mesh = new Mesh(new BoxBuilder().build(), material);
    this.mesh.visible = false;
    this.group.add(this.mesh);
  }

  sync(state: SimState, world: World): void {
    const burning: { id: number; intensity: number }[] = [];
    for (const block of state.blocks.values()) {
      if (block.burning) burning.push({ id: block.id, intensity: block.fireIntensity });
    }
    burning.sort((a, b) => a.id - b.id);
    const key = burning.map((b) => `${b.id}:${b.intensity}`).join(',');
    if (key === this.key) return;
    this.key = key;

    if (burning.length === 0) {
      this.mesh.visible = false;
      return;
    }

    const b = new BoxBuilder();
    const s = WORLD.blockSide;
    for (const { id, intensity } of burning) {
      const [bx, by] = world.toXY(id);
      const base = terraceHeight(world.generated(bx, by).elevation) + 0.6;
      const count = FLAMES[intensity] ?? FLAMES[1]!;
      for (let i = 0; i < count; i++) {
        const fx = bx * s + 1 + hash01(id, i) * (s - 2);
        const fz = by * s + 1 + hash01(i, id) * (s - 2);
        const h = 0.8 + hash01(id + i, 7) * 0.9 * intensity * 0.5;
        b.addAABox(fx, base + h / 2, fz, 0.55, h, 0.55, { side: Palette.Fire });
        b.addAABox(fx + 0.1, base + h + 0.7, fz - 0.1, 0.8, 0.5, 0.8, { side: Palette.Smoke });
      }
    }

    this.mesh.geometry.dispose();
    this.mesh.geometry = b.build();
    this.mesh.visible = true;
  }

  /** A gentle whole-mesh flicker; the sim is untouched by it. */
  update(nowMs: number): void {
    if (!this.mesh.visible) return;
    this.mesh.scale.y = 1 + 0.08 * Math.sin(nowMs * 0.013) + 0.04 * Math.sin(nowMs * 0.031);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
