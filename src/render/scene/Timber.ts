/**
 * Trees coming down (§6.5): while a forest block is being chopped, its trees
 * go one at a time — each quarter of the job fells another — and the last
 * one drops when the block clears and the chunk remeshes. A tree tips slowly
 * at first, gathers speed, hits the ground with a shudder, lies a moment, and
 * settles into the earth. Purely visual.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { BlockId } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeInCubic, easeOutBounce } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

/** How long a tree takes to hit the ground, to lie there, and to sink after. */
const FALL_MS = 2200;
const REST_MS = 1400;
const SINK_MS = 2600;
/** Trees a forest block gives up over a chop. */
export const TREES_PER_BLOCK = 4;

interface Falling {
  mesh: Mesh;
  startedAt: number;
  groundY: number;
}

function treeGeometry(seed: number) {
  const b = new BoxBuilder();
  const scale = 0.85 + ((seed * 7) % 5) * 0.08;
  b.addAABox(0, 1.3 * scale, 0, 0.36, 2.6 * scale, 0.36, { side: Palette.Bark });
  b.addAABox(0, 3 * scale, 0, 2.6 * scale, 1 * scale, 2.4 * scale, { side: Palette.Canopy });
  b.addAABox(0.2, 3.8 * scale, -0.2, 1.7 * scale, 0.8 * scale, 1.6 * scale, {
    side: Palette.CanopyLight,
  });
  return b.build();
}

export class Timber {
  readonly group = new Group();
  private readonly falling: Falling[] = [];

  constructor(private readonly material: Material) {}

  /**
   * Fell tree `index` (0-based) of a block, starting now. The trees stand
   * round the block's middle, so successive calls work round the clearing.
   */
  fell(world: World, block: BlockId, nowMs: number, index = 0): void {
    const [bx, by] = world.toXY(block);
    const groundY = terraceHeight(world.generated(bx, by).elevation);
    const side = WORLD.blockSide;
    const mesh = new Mesh(treeGeometry(block + index), this.material);
    const angle = (index / TREES_PER_BLOCK) * Math.PI * 2 + block * 0.37;
    mesh.position.set(
      bx * side + side / 2 + Math.cos(angle) * 3.2,
      groundY,
      by * side + side / 2 + Math.sin(angle) * 3.2,
    );
    // Yaw first, then the tip: the tree falls the way it faces, away from the crew.
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = angle + 1.2 + ((block * 13 + index * 7) % 10) * 0.1;
    this.group.add(mesh);
    this.falling.push({ mesh, startedAt: nowMs, groundY });
  }

  /** Fell every tree of a block at once (a chop that finished off-screen, or a burn). */
  fellAll(world: World, block: BlockId, nowMs: number, from = 0): void {
    for (let i = from; i < TREES_PER_BLOCK; i++)
      this.fell(world, block, nowMs + (i - from) * 420, i);
  }

  update(nowMs: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const tree = this.falling[i]!;
      const t = nowMs - tree.startedAt;
      if (t < 0) continue;
      if (t < FALL_MS) {
        // A slow lean, then the drop, then one shudder on the ground.
        const f = t / FALL_MS;
        const angle =
          f < 0.78 ? easeInCubic(f / 0.78) : 1 - (1 - easeOutBounce((f - 0.78) / 0.22)) * 0.06;
        tree.mesh.rotation.x = angle * (Math.PI / 2 - 0.05);
        continue;
      }
      if (t < FALL_MS + REST_MS) continue;
      const sink = (t - FALL_MS - REST_MS) / SINK_MS;
      if (sink >= 1) {
        this.group.remove(tree.mesh);
        tree.mesh.geometry.dispose();
        this.falling.splice(i, 1);
        continue;
      }
      tree.mesh.position.y = tree.groundY - sink * sink * 1.4;
    }
  }

  dispose(): void {
    for (const tree of this.falling) tree.mesh.geometry.dispose();
    this.falling.length = 0;
  }
}
