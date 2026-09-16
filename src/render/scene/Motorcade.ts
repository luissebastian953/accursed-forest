/**
 * The presidential motorcade (§3.8, §6.5): when the estate certifies, a long
 * black car with two flags on the bonnet comes up the road between two white
 * escorts and stops in front of the Kopdes porch. The President steps out,
 * walks to the door, and tells you your palms will do the country a favour;
 * the epilogue card opens once he is there. Only for the win — nobody comes
 * for a bankruptcy. Purely visual, and driven by the App's clock, not the
 * sim's: the sim has already ended.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeInOutQuad, easeOutCubic } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** The cars drive up, a beat for the door, then the walk to the porch. */
export const DRIVE_MS = 2600;
const DOOR_MS = 500;
const WALK_MS = 1900;
/** From the first sight of the cars to the President at the door. */
export const MOTORCADE_MS = DRIVE_MS + DOOR_MS + WALK_MS;
/** How far off the road the cars start, world units. */
const FROM_X = 34;

/** The limousine: long, black, chrome trim, two flags on the bonnet. */
function limoGeometry() {
  const b = new BoxBuilder();
  b.addAABox(0, 0.5, 0, 4.4, 0.7, 1.3, { side: Palette.Charcoal });
  b.addAABox(-0.3, 1.1, 0, 2.2, 0.55, 1.15, { side: Palette.Charcoal });
  // Windows and the chrome line.
  b.addAABox(-0.3, 1.15, 0, 2.0, 0.3, 1.2, { side: Palette.Steel });
  b.addAABox(0, 0.32, 0, 4.5, 0.08, 1.34, { side: Palette.Steel });
  for (const x of [-2.2, 2.2]) b.addAABox(x, 0.45, 0, 0.12, 0.3, 1.3, { side: Palette.Steel });
  // Wheels.
  for (const x of [-1.5, 1.5]) {
    for (const z of [-0.65, 0.65]) b.addAABox(x, 0.22, z, 0.5, 0.44, 0.14, { side: Palette.Rock });
  }
  // Two flags on the bonnet: red over white.
  for (const z of [-0.45, 0.45]) {
    b.addAABox(1.9, 1.1, z, 0.05, 0.6, 0.05, { side: Palette.Steel });
    b.addAABox(1.9, 1.32, z + 0.12, 0.03, 0.14, 0.24, { side: Palette.KopdesFlag });
    b.addAABox(1.9, 1.18, z + 0.12, 0.03, 0.14, 0.24, { side: Palette.Sand });
  }
  return b.build();
}

/** An escort: white, a blue lamp on the roof. */
function escortGeometry() {
  const b = new BoxBuilder();
  b.addAABox(0, 0.45, 0, 2.4, 0.6, 1.2, { side: Palette.Sand });
  b.addAABox(-0.1, 1.0, 0, 1.3, 0.5, 1.1, { side: Palette.Steel });
  b.addAABox(-0.1, 1.33, 0, 0.5, 0.16, 0.5, { side: Palette.Water });
  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.6, 0.6]) b.addAABox(x, 0.2, z, 0.45, 0.4, 0.12, { side: Palette.Charcoal });
  }
  return b.build();
}

/** The President from the hips up: black suit, a peci, a red-and-white sash. */
function presidentGeometry() {
  const b = new BoxBuilder();
  const h = 1.8;
  const leg = h * 0.42;
  const torso = h * 0.34;
  const head = h * 0.17;
  const w = h * 0.3;
  b.addAABox(0, leg + torso / 2, 0, w, torso, w * 0.6, { side: Palette.Charcoal });
  b.addAABox(0, leg + torso / 2 + 0.02, w * 0.31, w * 0.22, torso * 0.9, 0.03, {
    side: Palette.KopdesFlag,
  });
  b.addAABox(0, leg + torso / 2 - torso * 0.2, w * 0.31, w * 0.22, torso * 0.18, 0.03, {
    side: Palette.Sand,
  });
  b.addAABox(0, leg + torso + head / 2, 0, head, head, head, { side: Palette.Skin });
  b.addAABox(0, leg + torso + head + 0.06, 0, head * 0.95, 0.14, head * 0.95, {
    side: Palette.Charcoal,
  });
  for (const side of [-1, 1]) {
    b.addAABox(side * (w / 2 + h * 0.03), leg + torso * 0.5, 0, h * 0.09, h * 0.3, h * 0.09, {
      side: Palette.Charcoal,
    });
  }
  return b.build();
}

/** One leg, hung from the hip so it can swing. */
function legGeometry() {
  const h = 1.8;
  return new BoxBuilder()
    .addAABox(0, -h * 0.21, 0, h * 0.1, h * 0.42, h * 0.11, { side: Palette.Charcoal })
    .build();
}

export class Motorcade {
  readonly group = new Group();
  private readonly limo: Mesh;
  private readonly escorts: Mesh[] = [];
  private readonly president = new Group();
  private readonly legs: Mesh[] = [];
  private startedAt = -1;
  /** Where the cars stop and where the President walks, in world units. */
  private parkX = 0;
  private parkZ = 0;
  private doorX = 0;
  private doorZ = 0;

  constructor(
    material: Material,
    /** The land under a world point; the cars ride it in and the President walks it. */
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    this.limo = new Mesh(limoGeometry(), material);
    this.group.add(this.limo);
    for (let i = 0; i < 2; i++) {
      const escort = new Mesh(escortGeometry(), material);
      this.escorts.push(escort);
      this.group.add(escort);
    }
    this.president.add(new Mesh(presidentGeometry(), material));
    for (const side of [-1, 1]) {
      const leg = new Mesh(legGeometry(), material);
      leg.position.set(side * 1.8 * 0.3 * 0.24, 1.8 * 0.42, 0);
      this.legs.push(leg);
      this.president.add(leg);
    }
    this.group.add(this.president);
    this.group.visible = false;
  }

  /** Is the motorcade on screen, parked or arriving? */
  get present(): boolean {
    return this.group.visible;
  }

  private place(state: SimState, world: World): boolean {
    if (!state.kopdes) return false;
    const [bx, by] = world.toXY(state.kopdes.blockId);
    const side = WORLD.blockSide;
    const cx = bx * side + side / 2;
    const cz = by * side + side / 2;
    // In front of the porch (the door faces +z), nose toward the road.
    this.parkX = cx + 0.4;
    this.parkZ = cz + 5.3;
    this.doorX = cx;
    this.doorZ = cz + 3.35;
    return true;
  }

  /** Start the arrival now: cars off to the west, President still inside. */
  arrive(state: SimState, world: World, nowMs: number): void {
    if (!this.place(state, world)) return;
    this.startedAt = nowMs;
    this.group.visible = true;
    this.president.visible = false;
    this.update(nowMs);
  }

  /** Show the parked motorcade for a run that has already been won, or hide it. */
  sync(state: SimState, world: World): void {
    const won = state.run.ending === 'clean' || state.run.ending === 'dirty';
    if (!won || !this.place(state, world)) {
      this.group.visible = false;
      this.startedAt = -1;
      return;
    }
    this.startedAt = -1;
    this.group.visible = true;
    this.pose(1, 1);
  }

  /** Cars at `drive` of the way in, the President `walk` of the way to the door. */
  private pose(drive: number, walk: number): void {
    const x = this.parkX - FROM_X * (1 - drive);
    this.limo.position.set(x, this.groundAt(x, this.parkZ), this.parkZ);
    this.escorts[0]!.position.set(x + 5.4, this.groundAt(x + 5.4, this.parkZ), this.parkZ);
    this.escorts[1]!.position.set(x - 5.4, this.groundAt(x - 5.4, this.parkZ), this.parkZ);
    if (walk <= 0) {
      this.president.visible = false;
      return;
    }
    this.president.visible = true;
    const fromX = this.parkX - 0.6;
    const fromZ = this.parkZ - 1.1;
    const w = easeInOutQuad(walk);
    const px = fromX + (this.doorX - fromX) * w;
    const pz = fromZ + (this.doorZ - fromZ) * w;
    this.president.position.set(
      px,
      this.groundAt(px, pz) + (walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 6)) * 0.05 : 0),
      pz,
    );
    this.president.rotation.y = Math.atan2(this.doorX - fromX, this.doorZ - fromZ);
    const swing = walk < 1 ? Math.sin(walk * Math.PI * 6) * 0.55 : 0;
    this.legs[0]!.rotation.x = swing;
    this.legs[1]!.rotation.x = -swing;
  }

  update(nowMs: number): void {
    if (this.startedAt < 0) return;
    const elapsed = nowMs - this.startedAt;
    const drive = easeOutCubic(clamp01(elapsed / DRIVE_MS));
    const walk = clamp01((elapsed - DRIVE_MS - DOOR_MS) / WALK_MS);
    this.pose(drive, walk);
    if (elapsed >= MOTORCADE_MS) this.startedAt = -1;
  }

  dispose(): void {
    this.limo.geometry.dispose();
    for (const escort of this.escorts) escort.geometry.dispose();
    for (const leg of this.legs) leg.geometry.dispose();
    (this.president.children[0] as Mesh).geometry.dispose();
  }
}
