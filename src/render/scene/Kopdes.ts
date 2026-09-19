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

/** How the building reads at each level, from a hut to a co-op with a hall. */
export type KopdesLevel = 1 | 2 | 3 | 4;

/**
 * The building grows in one direction (§6.3). A one-room shop under a single
 * fall of roof becomes a co-op: the ridge rises, the far slope reaches out
 * past the walls, and what it covers is open ground on timber posts. That
 * open hall is what the upgrades buy, so the shape says the level out loud.
 *
 * West is -x and holds the ridge; the roof falls east over the walls. Every
 * eave and post below is worked out from the two lines of the roof rather
 * than placed by hand, so the posts meet what they carry.
 */
export function buildKopdesGeometry(level: KopdesLevel = 1) {
  const b = new BoxBuilder();
  const m = new Matrix4();

  const wall = { side: Palette.KopdesWall };
  const roof = { side: Palette.KopdesRoof };
  const roofLight = { side: Palette.KopdesRoofLight };
  const timber = { side: Palette.PalmTrunk };
  const glass = { side: Palette.KopdesGlass };
  const stone = { side: Palette.Laterite };

  const THICK = 0.3;
  const OVERHANG = 0.55;
  /** How far the open hall reaches west of the walls. */
  const reachOf = (n: KopdesLevel) => (n >= 4 ? 5.6 : 4.4);

  /**
   * A roof plane laid between two points, seen side on. The box is as long as
   * the run between them plus the overhang at each end, and sits on the line
   * rather than across it.
   */
  const plane = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    depth: number,
    faces: { side: number },
    overhang = OVERHANG,
    z = 0,
  ) => {
    const run = x2 - x1;
    const rise = y2 - y1;
    const length = Math.hypot(run, rise) + overhang * 2;
    const angle = Math.atan2(rise, run);
    // Half the slab's thickness, lifted along the plane's own normal.
    const nx = (-Math.sin(angle) * THICK) / 2;
    const ny = (Math.cos(angle) * THICK) / 2;
    m.makeRotationZ(angle).setPosition((x1 + x2) / 2 + nx, (y1 + y2) / 2 + ny, z);
    b.addBox(m.clone().multiply(new Matrix4().makeScale(length, THICK, depth)), faces);
  };

  /**
   * The wall under a slope, as a staircase of boxes. Box geometry has no
   * triangles, and the steps read as a gable end from the outside.
   */
  const gableWall = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    depth: number,
    steps: number,
  ) => {
    const run = (x2 - x1) / steps;
    for (let i = 0; i < steps; i++) {
      // The tallest point of each step is its uphill edge, so that is the
      // height it takes, less a finger's width: any more and the corner of the
      // step stands proud of the roof it is meant to be holding up, or fights
      // it for the same pixels.
      const top = y1 + ((y2 - y1) * i) / steps - 0.16;
      b.addAABox(x1 + run * (i + 0.5), top / 2, 0, Math.abs(run) + 0.01, top, depth, wall);
    }
  };

  // ── The closed half ─────────────────────────────────────────────────────
  // The shop itself: the same room at every level, taller as the co-op grows.
  const depth = level >= 3 ? 4.8 : 4.2;
  const west = -2;
  const east = 3;
  const eaveEast = level >= 4 ? 3.8 : level >= 3 ? 3.3 : 2.9;
  const ridgeY = eaveEast + (level >= 4 ? 1.9 : level >= 3 ? 1.7 : 1.4);

  /** How high the main roof is at a given point across it. */
  const roofAt = (x: number) => ridgeY + ((eaveEast - ridgeY) * (x - west)) / (east - west);

  gableWall(west, ridgeY, east, eaveEast, depth, level >= 3 ? 5 : 4);
  plane(west, ridgeY, east, eaveEast, depth + 0.9, roof);

  // The door, its step, and the gable end facing the road.
  b.addAABox(1.4, 0.95, depth / 2 + 0.1, 1.1, 1.9, 0.2, timber);
  b.addAABox(1.4, 0.15, depth / 2 + 0.8, 3, 0.3, 1.4, stone);

  // ── The open hall, from level 3 ─────────────────────────────────────────
  if (level >= 3) {
    // The west slope falls the other way, out over open ground. Where it ends
    // is where the posts stand, and how tall they are follows from the line.
    const reach = reachOf(level);
    const postX = west - reach;
    const eaveWest = 2.9;
    plane(postX, eaveWest, west, ridgeY, depth + 0.9, roof);
    // The ridge cap: the two falls meet in something, not in a seam.
    b.addAABox(west, ridgeY + 0.2, 0, 1.2, 0.36, depth + 1, roofLight);

    // The floor of the hall, raised out of the mud.
    b.addAABox((postX + west) / 2, 0.16, 0, reach + 0.6, 0.32, depth + 0.4, stone);

    /** A post up to the roof line, with the beam it carries. */
    const postTo = (x: number) => {
      const t = (x - postX) / (west - postX);
      const top = eaveWest + (ridgeY - eaveWest) * t - 0.16;
      for (const z of [-depth / 2 + 0.45, depth / 2 - 0.45]) {
        b.addAABox(x, top / 2 + 0.16, z, 0.34, top, 0.34, timber);
      }
      b.addAABox(x, top + 0.1, 0, 0.26, 0.26, depth - 0.5, timber);
    };
    postTo(postX + 0.3);
    if (level >= 4) postTo((postX + west) / 2);

    // A rail along the open side, waist high, so the hall has an edge.
    b.addAABox((postX + west) / 2, 1.15, depth / 2 - 0.45, reach - 0.4, 0.2, 0.2, timber);
    b.addAABox((postX + west) / 2, 1.15, -depth / 2 + 0.45, reach - 0.4, 0.2, 0.2, timber);
  }

  // ── What each level adds ────────────────────────────────────────────────
  if (level >= 2) {
    // The annex on the road side: the scales, the sacks, the price board.
    const annexTop = 2.4;
    const annexZ = depth / 2 + 1.1;
    // At the west end of the front, under the high side of the roof, so it
    // leans against the tall wall rather than hanging off the low eave.
    const annexX = west + 1;
    b.addAABox(annexX, annexTop / 2, annexZ, 2.4, annexTop, 2.2, wall);
    plane(
      annexX - 1.3,
      annexTop + 0.45,
      annexX + 1.3,
      annexTop - 0.3,
      2.4,
      roofLight,
      0.35,
      annexZ,
    );
    b.addAABox(annexX, 1.3, annexZ + 1.15, 1, 1.5, 0.14, timber);
    // The windows go in the blank east wall, not the front: the front is the
    // door, the step and the annex, and a pane there ends up under the eave
    // or behind the annex roof.
    const wallPaneY = eaveEast - 1.15;
    if (level >= 4) {
      for (const z of [-0.9, 0.9]) {
        b.addAABox(east + 0.08, wallPaneY, z, 0.14, 0.95, 1.4, glass);
      }
    } else {
      b.addAABox(east + 0.08, wallPaneY, 0, 0.14, 0.9, 1.6, glass);
    }

    // The dormer over the counter, in the lighter red. At the top level it is
    // wide enough for the office's two windows.
    const dormerZ = -1;
    const dormerWide = level >= 4 ? 2.8 : 1.6;
    // It sits on the slope, not in it: the walls stand clear of the roof at
    // the uphill edge and are tucked under it at the downhill edge, so the
    // box is as tall as the roof falls across it, plus the part that shows.
    const dormerRun = 1.7;
    const uphill = west + (east - west) * 0.42;
    const downhill = uphill + dormerRun;
    const dormerTop = roofAt(uphill) + 0.5;
    const dormerBase = roofAt(downhill) - 0.7;
    b.addAABox(
      (uphill + downhill) / 2,
      (dormerTop + dormerBase) / 2,
      dormerZ,
      dormerRun,
      dormerTop - dormerBase,
      dormerWide,
      wall,
    );
    plane(
      uphill - 0.3,
      dormerTop + 0.25,
      downhill + 0.3,
      dormerTop - 0.1,
      dormerWide + 0.25,
      roofLight,
      0.25,
      dormerZ,
    );
    // The panes face down the slope, under the dormer's own eave.
    const paneY = dormerTop - 0.5;
    const paneX = downhill - 0.06;
    if (level >= 4) {
      for (const z of [-0.62, 0.62]) {
        b.addAABox(paneX, paneY, dormerZ + z, 0.14, 0.6, 1, glass);
      }
    } else {
      b.addAABox(paneX, paneY, dormerZ, 0.14, 0.6, 1, glass);
    }
  }

  if (level >= 4) {
    // The painted fascia under the eave, which is the co-op's green once it
    // can afford the paint.
    b.addAABox(east + 0.45, eaveEast - 0.12, 0, 0.3, 0.36, depth + 0.9, {
      side: Palette.KopdesTrim,
    });
  }

  // ── The flag, taller with every level ───────────────────────────────────
  const poleTop = 4.6 + level * 0.7;
  const poleX = east - 0.5;
  const poleZ = -depth / 2 + 0.5;
  b.addAABox(poleX, poleTop / 2, poleZ, 0.16, poleTop, 0.16, timber);
  b.addAABox(poleX + 0.55, poleTop - 0.55, poleZ, 0.95, 0.65, 0.08, { side: Palette.KopdesFlag });

  // The hall grows west, so the building would drift off its hectare as it
  // rises. Centre what was built on the block it stands on.
  const geometry = b.build();
  const spread = level >= 3 ? reachOf(level) : 0;
  geometry.translate(spread / 2 - (east + west) / 2, 0, level >= 2 ? -0.7 : 0);
  return geometry;
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
  /** The level the geometry was built for; a change rebuilds it. */
  private level: KopdesLevel = 1;

  constructor(material: Material) {
    this.mesh = new Mesh(buildKopdesGeometry(1), material);
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
    const level = Math.max(1, Math.min(4, state.kopdes.level)) as KopdesLevel;
    if (level !== this.level) {
      this.level = level;
      this.mesh.geometry.dispose();
      this.mesh.geometry = buildKopdesGeometry(level);
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
