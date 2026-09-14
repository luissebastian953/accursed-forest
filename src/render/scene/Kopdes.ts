/**
 * The Kopdes building (§6.3): chunky box body, oversized pitched-roof slab,
 * a flag block. Level-ups add a wing (M1b).
 */

import { Matrix4, Mesh, type Material } from 'three/webgpu';

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

export class KopdesMesh {
  readonly mesh: Mesh;

  constructor(material: Material) {
    this.mesh = new Mesh(buildKopdesGeometry(), material);
    this.mesh.visible = false;
  }

  sync(state: SimState, world: World): void {
    if (!state.kopdes) {
      this.mesh.visible = false;
      return;
    }
    const block = state.blocks.get(state.kopdes.blockId);
    const [bx, by] = world.toXY(state.kopdes.blockId);
    const half = WORLD.blockSide / 2;
    this.mesh.position.set(
      bx * WORLD.blockSide + half,
      terraceHeight(block?.elevation ?? 0),
      by * WORLD.blockSide + half,
    );
    this.mesh.visible = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
