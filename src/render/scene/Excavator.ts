/**
 * The excavator (§3.6.2): the machine that comes with the crew when a
 * landslide is dug out. It crawls onto the block, swings its boom into the
 * spoil, lifts, turns to dump, and goes back for more, for as long as the
 * crew is on the block.
 *
 * One machine at a time, like the motorcade: the estate never has two slides
 * being dug at once often enough to be worth the parts.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeOutCubic } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** How long the machine takes to crawl in, and from how far out. */
const DRIVE_MS = 2600;
const DRIVE_FROM = 26;
/** One dig: down into the spoil, up with it, round to the pile, and back. */
const CYCLE_MS = 3400;

function trackGeometry(): BoxBuilder {
  const b = new BoxBuilder();
  // Tracks, then the deck they carry.
  for (const z of [-0.95, 0.95]) {
    b.addAABox(0, 0.32, z, 4.2, 0.64, 0.7, { side: Palette.Charcoal });
  }
  b.addAABox(0, 0.78, 0, 3.6, 0.32, 2.2, { side: Palette.Steel });
  return b;
}

function houseGeometry(): BoxBuilder {
  const b = new BoxBuilder();
  // The cab and the counterweight behind it, in the machine's yellow.
  b.addAABox(0.35, 1.5, 0, 1.7, 1.3, 1.7, { side: Palette.HiVis });
  b.addAABox(-1.1, 1.25, 0, 1.2, 0.85, 1.9, { side: Palette.Charcoal });
  b.addAABox(0.75, 1.62, 0, 0.9, 0.8, 1.4, { side: Palette.Water });
  return b;
}

function boomGeometry(): BoxBuilder {
  const b = new BoxBuilder();
  // Boom out from the house pivot; the arm and bucket hang off its end.
  b.addAABox(1.5, 0, 0, 3.4, 0.42, 0.42, { side: Palette.HiVis });
  return b;
}

function armGeometry(): BoxBuilder {
  const b = new BoxBuilder();
  b.addAABox(0.9, 0, 0, 2.2, 0.34, 0.34, { side: Palette.HiVis });
  b.addAABox(2, -0.35, 0, 0.9, 0.8, 1, { side: Palette.Steel });
  return b;
}

export class Excavator {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly house = new Group();
  private readonly boom = new Group();
  private readonly arm = new Group();
  private readonly meshes: Mesh[] = [];
  private parkedX = 0;
  private parkedZ = 0;
  private startX = 0;
  private arrivedAt = -1;

  constructor(
    material: Material,
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    const add = (parent: Group, builder: BoxBuilder): Mesh => {
      const mesh = new Mesh(builder.build(), material);
      parent.add(mesh);
      this.meshes.push(mesh);
      return mesh;
    };

    add(this.body, trackGeometry());
    add(this.house, houseGeometry());
    add(this.boom, boomGeometry());
    add(this.arm, armGeometry());

    this.boom.add(this.arm);
    this.arm.position.set(3.1, 0, 0);
    this.house.add(this.boom);
    this.boom.position.set(0.6, 1.5, 0);
    this.house.position.set(0, 0.94, 0);
    this.body.add(this.house);
    this.group.add(this.body);
    this.group.visible = false;
  }

  /** Put the machine on whichever block is being dug out, or take it away. */
  sync(state: SimState, world: World, nowMs: number): void {
    let site: number | null = null;
    for (const block of state.blocks.values()) {
      if (block.excavateUntil > state.tick) {
        site = block.id;
        break;
      }
    }
    if (site === null) {
      this.group.visible = false;
      this.arrivedAt = -1;
      return;
    }

    const [bx, by] = world.toXY(site);
    const side = WORLD.blockSide;
    // Parked off-centre, so the crew has the middle of the block to work.
    const cx = bx * side + side * 0.32;
    const cz = by * side + side * 0.62;
    if (this.arrivedAt < 0 || this.parkedX !== cx || this.parkedZ !== cz) {
      this.arrivedAt = nowMs;
      this.parkedX = cx;
      this.parkedZ = cz;
      this.startX = cx - DRIVE_FROM;
    }
    this.group.visible = true;
  }

  update(nowMs: number): void {
    if (!this.group.visible || this.arrivedAt < 0) return;
    const since = nowMs - this.arrivedAt;
    const drive = easeOutCubic(clamp01(since / DRIVE_MS));
    const x = this.startX + (this.parkedX - this.startX) * drive;
    this.body.position.set(x, this.groundAt(x, this.parkedZ), this.parkedZ);
    // Crawling in, it faces the way it is going; parked, it faces the spoil.
    this.body.rotation.y = (1 - drive) * -0.35;

    if (drive < 1) {
      this.house.rotation.y = 0;
      this.boom.rotation.z = -0.5;
      this.arm.rotation.z = 0.9;
      return;
    }

    // The dig: reach out and down, close on a load, swing it round, drop it.
    const t = ((since - DRIVE_MS) % CYCLE_MS) / CYCLE_MS;
    const reach = Math.sin(t * Math.PI * 2);
    const swing = t < 0.5 ? 0 : Math.sin((t - 0.5) * Math.PI * 2);
    this.boom.rotation.z = -0.5 + reach * 0.42;
    this.arm.rotation.z = 0.9 - reach * 0.75;
    this.house.rotation.y = swing * 0.9;
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose();
    this.meshes.length = 0;
  }
}
