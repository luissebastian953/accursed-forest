/**
 * The work site (§6.5): while a crew is chopping or burning a block, four
 * timber pillars go up at its corners with ropes strung between them — the
 * crew's scaffolding and cordon. Up when the work starts, gone when the block
 * clears or the crew walks off. A fire with no crew (lightning, a spread, a
 * wildfire) is just a fire. Purely visual; one mesh per worked block.
 */

import { Group, Matrix4, Mesh, type Material } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import { workedBlocks } from '@sim/systems/mobs';
import type { BlockId, SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** How far in from the block's edge the pillars stand, and how tall they are. */
const INSET = 1.1;
const HEIGHT = 4.2;
/** Rope heights up the pillars. */
const ROPES = [1.7, 3.6] as const;

function siteGeometry(groundAt: (dx: number, dz: number) => number) {
  const b = new BoxBuilder();
  const half = WORLD.blockSide / 2 - INSET;
  const corners: [number, number][] = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
  ];
  // Pillars, each footed on its own bit of ground, with a lashing near the top.
  for (const [x, z] of corners) {
    const y = groundAt(x, z);
    b.addAABox(x, y + HEIGHT / 2, z, 0.34, HEIGHT, 0.34, { side: Palette.PalmTrunk });
    b.addAABox(x, y + HEIGHT - 0.5, z, 0.42, 0.18, 0.42, { side: Palette.Sand });
  }
  // Ropes: a thin box from pillar to pillar at each height, sagging a touch.
  const m = new Matrix4();
  for (let i = 0; i < corners.length; i++) {
    const [x0, z0] = corners[i]!;
    const [x1, z1] = corners[(i + 1) % corners.length]!;
    const length = Math.hypot(x1 - x0, z1 - z0);
    const angle = Math.atan2(x1 - x0, z1 - z0);
    for (const rope of ROPES) {
      const y0 = groundAt(x0, z0) + rope;
      const y1 = groundAt(x1, z1) + rope;
      const tilt = Math.atan2(y1 - y0, length);
      m.makeRotationY(angle)
        .multiply(new Matrix4().makeRotationX(-tilt))
        .setPosition((x0 + x1) / 2, (y0 + y1) / 2 - 0.12, (z0 + z1) / 2);
      b.addBox(m.clone().multiply(new Matrix4().makeScale(0.09, 0.09, length)), {
        side: Palette.Sand,
      });
    }
  }
  return b.build();
}

export class WorkSite {
  readonly group = new Group();
  private readonly sites = new Map<BlockId, Mesh>();

  constructor(
    private readonly material: Material,
    /** The land under a world point, as the mesher draws it. */
    private readonly groundAt: (x: number, z: number) => number,
  ) {}

  /**
   * Put a site on every block a crew is working, and take down the rest. A
   * fire nobody ordered — lightning, a spark, a spread — gets no scaffolding.
   */
  sync(state: SimState, world: World): void {
    const working = workedBlocks(state);
    for (const [id, mesh] of this.sites) {
      if (working.has(id)) continue;
      this.group.remove(mesh);
      mesh.geometry.dispose();
      this.sites.delete(id);
    }
    const side = WORLD.blockSide;
    for (const id of working) {
      if (this.sites.has(id)) continue;
      const [bx, by] = world.toXY(id);
      const cx = bx * side + side / 2;
      const cz = by * side + side / 2;
      const mesh = new Mesh(
        siteGeometry((dx, dz) => this.groundAt(cx + dx, cz + dz)),
        this.material,
      );
      mesh.position.set(cx, 0, cz);
      this.group.add(mesh);
      this.sites.set(id, mesh);
    }
  }

  dispose(): void {
    for (const mesh of this.sites.values()) mesh.geometry.dispose();
    this.sites.clear();
  }
}
