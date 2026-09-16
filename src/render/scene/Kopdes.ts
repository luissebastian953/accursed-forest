/**
 * The Kopdes building (§6.3): chunky box body, oversized pitched-roof slab,
 * a flag block. Level-ups add a wing (M1b). Hiring a security guard puts a
 * small post hut on the corner of the block, where the guard waits between
 * patrols.
 */

import { Matrix4, Mesh, type Material } from 'three/webgpu';

import { WORKER_JOBS } from '@sim/balance/mobs';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

export function buildKopdesGeometry() {
  const b = new BoxBuilder();
  const m = new Matrix4();

  // Body.
  b.addAABox(0, 1.4, 0, 6, 2.8, 4.4, { side: Palette.KopdesWall });
  // Roof: two slabs meeting at a ridge.
  const pitch = 0.55;
  m.makeRotationZ(pitch).setPosition(-1.55, 3.55, 0);
  b.addBox(m.clone().multiply(new Matrix4().makeScale(3.8, 0.3, 5.2)), {
    side: Palette.KopdesRoof,
  });
  m.makeRotationZ(-pitch).setPosition(1.55, 3.55, 0);
  b.addBox(m.clone().multiply(new Matrix4().makeScale(3.8, 0.3, 5.2)), {
    side: Palette.KopdesRoof,
  });
  // Door and porch step.
  b.addAABox(0, 0.9, 2.25, 1.1, 1.8, 0.2, { side: Palette.PalmTrunk });
  b.addAABox(0, 0.15, 2.9, 3, 0.3, 1.2, { side: Palette.Laterite });
  // Flag.
  b.addAABox(2.6, 3.6, 1.6, 0.14, 4.2, 0.14, { side: Palette.PalmTrunk });
  b.addAABox(3.1, 5.3, 1.6, 0.9, 0.6, 0.08, { side: Palette.KopdesFlag });

  return b.build();
}

/** The guard post: a hut the size of a phone box, a hi-vis roof, a lamp on a pole. */
export function buildGuardPostGeometry() {
  const b = new BoxBuilder();
  b.addAABox(0, 0.1, 0, 2.4, 0.2, 2.4, { side: Palette.Laterite });
  b.addAABox(0, 1.2, 0, 1.6, 2, 1.6, { side: Palette.KopdesWall });
  // Window band and door.
  b.addAABox(0, 1.55, 0.82, 1.1, 0.5, 0.06, { side: Palette.Cave });
  b.addAABox(0.45, 0.95, -0.82, 0.6, 1.5, 0.06, { side: Palette.PalmTrunk });
  // Roof slab and a stripe.
  b.addAABox(0, 2.35, 0, 2.2, 0.3, 2.2, { side: Palette.HiVis });
  b.addAABox(0, 2.55, 0, 1.2, 0.12, 1.2, { side: Palette.ClothSecurity });
  // Lamp.
  b.addAABox(1.4, 1.6, 1.4, 0.12, 3.2, 0.12, { side: Palette.Steel });
  b.addAABox(1.4, 3.3, 1.4, 0.4, 0.3, 0.4, { side: Palette.FlowerYellow });
  return b.build();
}

export class KopdesMesh {
  readonly mesh: Mesh;
  readonly post: Mesh;

  constructor(material: Material) {
    this.mesh = new Mesh(buildKopdesGeometry(), material);
    this.mesh.visible = false;
    this.post = new Mesh(buildGuardPostGeometry(), material);
    this.post.visible = false;
  }

  sync(state: SimState, world: World): void {
    if (!state.kopdes) {
      this.mesh.visible = false;
      this.post.visible = false;
      return;
    }
    const block = state.blocks.get(state.kopdes.blockId);
    const [bx, by] = world.toXY(state.kopdes.blockId);
    const side = WORLD.blockSide;
    const half = side / 2;
    const y = terraceHeight(block?.elevation ?? 0);
    this.mesh.position.set(bx * side + half, y, by * side + half);
    this.mesh.visible = true;
    // The post stands where the guard idles, a little further out so the two do not overlap.
    const { dx, dz } = WORKER_JOBS.guardPost;
    this.post.position.set(
      bx * side + half + (dx + 0.06) * side,
      y,
      by * side + half + (dz - 0.06) * side,
    );
    this.post.visible = state.mobs.some((m) => m.hired && m.species === 'security');
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.post.geometry.dispose();
  }
}
