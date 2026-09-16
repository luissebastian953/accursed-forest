/**
 * Trees coming down (§6.5): when a chop finishes on forest, the block's trees
 * are gone from the chunk in one remesh. This plays what happened in between —
 * a few box trees on the block tip over, one after another, bounce, and sink
 * into the ground. Purely visual.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { BlockId } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeInQuad, easeOutBounce } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

/** How long a tree takes to hit the ground, and to sink after. */
const FALL_MS = 1400;
const SINK_MS = 1600;
/** Trees per felled block, and the stagger between them. */
const TREES = 4;
const STAGGER_MS = 260;

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

  /** Fell the trees on a block, starting now. */
  fell(world: World, block: BlockId, nowMs: number): void {
    const [bx, by] = world.toXY(block);
    const groundY = terraceHeight(world.generated(bx, by).elevation);
    const side = WORLD.blockSide;
    for (let i = 0; i < TREES; i++) {
      const mesh = new Mesh(treeGeometry(block + i), this.material);
      const angle = (i / TREES) * Math.PI * 2 + block * 0.37;
      mesh.position.set(
        bx * side + side / 2 + Math.cos(angle) * 3.2,
        groundY,
        by * side + side / 2 + Math.sin(angle) * 3.2,
      );
      mesh.rotation.y = angle + 1.2;
      this.group.add(mesh);
      this.falling.push({ mesh, startedAt: nowMs + i * STAGGER_MS, groundY });
    }
  }

  update(nowMs: number): void {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const tree = this.falling[i]!;
      const t = nowMs - tree.startedAt;
      if (t < 0) continue;
      if (t < FALL_MS) {
        // Tips slowly, then accelerates — and bounces once on the ground.
        const f = t / FALL_MS;
        const angle =
          f < 0.8 ? easeInQuad(f / 0.8) : 1 - (1 - easeOutBounce((f - 0.8) / 0.2)) * 0.08;
        tree.mesh.rotation.x = angle * (Math.PI / 2 - 0.04);
        continue;
      }
      const sink = (t - FALL_MS) / SINK_MS;
      if (sink >= 1) {
        this.group.remove(tree.mesh);
        tree.mesh.geometry.dispose();
        this.falling.splice(i, 1);
        continue;
      }
      tree.mesh.position.y = tree.groundY - sink * 1.2;
    }
  }

  dispose(): void {
    for (const tree of this.falling) tree.mesh.geometry.dispose();
    this.falling.length = 0;
  }
}
