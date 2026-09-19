import { uniform, vec3 } from 'three/tsl';
import { Group, Mesh, MeshBasicNodeMaterial, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeOutCubic } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

const DRIVE_MS = 1400;

function carGeometry(truck: boolean) {
  const b = new BoxBuilder();
  const length = truck ? 3.4 : 2.4;
  b.addAABox(0, 0.45, 0, length, 0.6, 1.2, { side: truck ? Palette.Charcoal : Palette.KopdesWall });
  b.addAABox(truck ? 0.9 : -0.1, 1.0, 0, truck ? 1.2 : 1.3, 0.5, 1.1, {
    side: truck ? Palette.Charcoal : Palette.Rock,
  });
  for (const x of [-length / 2 + 0.45, length / 2 - 0.45]) {
    for (const z of [-0.6, 0.6]) b.addAABox(x, 0.2, z, 0.45, 0.4, 0.12, { side: Palette.Charcoal });
  }
  return b.build();
}

/** Half a light bar: the blue side and the red side take turns. */
function lightGeometry(truck: boolean, side: -1 | 1) {
  const b = new BoxBuilder();
  const x = (truck ? 0.9 : -0.1) + side * 0.18;
  b.addAABox(x, 1.33, 0, 0.34, 0.16, 0.34, { side: Palette.Water });
  return b.build();
}

/** An unlit, brighter-than-white material, so the bar glows (and blooms). */
function sirenMaterial(colour: readonly [number, number, number]) {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  const level = uniform(1);
  material.colorNode = vec3(colour[0], colour[1], colour[2]).mul(level);
  material.opacityNode = level.clamp(0.25, 1);
  return { material, level };
}

const SIREN_BLUE = [0.3, 1.1, 3.4] as const;
const SIREN_RED = [3.4, 0.5, 0.35] as const;

export class Police {
  readonly group = new Group();
  private readonly cars: {
    body: Mesh;
    blue: { mesh: Mesh; level: { value: number } };
    red: { mesh: Mesh; level: { value: number } };
    parkedX: number;
    parkedZ: number;
    startX: number;
  }[] = [];
  private readonly truck: {
    body: Mesh;
    blue: { mesh: Mesh; level: { value: number } };
    red: { mesh: Mesh; level: { value: number } };
  };
  private arrivedAt = -1;
  private truckAt = -1;

  constructor(
    material: Material,
    /** The land under a world point; the cars ride it in. */
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    for (let i = 0; i < 2; i++) {
      const body = new Mesh(carGeometry(false), material);
      const lights = this.sirens(body, false);
      body.visible = false;
      this.group.add(body);
      this.cars.push({ body, ...lights, parkedX: 0, parkedZ: 0, startX: 0 });
    }
    const body = new Mesh(carGeometry(true), material);
    const lights = this.sirens(body, true);
    body.visible = false;
    this.group.add(body);
    this.truck = { body, ...lights };
  }

  /** Bolt a blue and a red lamp to a vehicle's roof. */
  private sirens(body: Mesh, truck: boolean) {
    const blue = sirenMaterial(SIREN_BLUE);
    const red = sirenMaterial(SIREN_RED);
    const blueMesh = new Mesh(lightGeometry(truck, -1), blue.material);
    const redMesh = new Mesh(lightGeometry(truck, 1), red.material);
    body.add(blueMesh, redMesh);
    return {
      blue: { mesh: blueMesh, level: blue.level },
      red: { mesh: redMesh, level: red.level },
    };
  }

  /** Place the cars for the current state. Call when the investigation or arrest changes. */
  sync(state: SimState, world: World, nowMs: number): void {
    const present =
      state.society.investigationUntil > state.tick || state.run.ending === 'arrested';
    if (!present || !state.kopdes) {
      for (const car of this.cars) car.body.visible = false;
      this.truck.body.visible = false;
      this.arrivedAt = -1;
      this.truckAt = -1;
      return;
    }

    const [bx, by] = world.toXY(state.kopdes.blockId);
    const cx = bx * WORLD.blockSide + WORLD.blockSide / 2;
    const cz = by * WORLD.blockSide + WORLD.blockSide / 2;

    if (this.arrivedAt < 0) this.arrivedAt = nowMs;
    this.cars.forEach((car, i) => {
      car.parkedX = cx - 3 + i * 3.2;
      car.parkedZ = cz + 4.2;
      car.startX = car.parkedX - 30;
      car.body.position.set(car.startX, this.groundAt(car.startX, car.parkedZ), car.parkedZ);
      car.body.visible = true;
    });

    if (state.run.ending === 'arrested') {
      if (this.truckAt < 0) this.truckAt = nowMs;
      this.truck.body.position.set(cx + 4, this.groundAt(cx + 4, cz + 4.2), cz + 4.2);
      this.truck.body.visible = true;
    }
  }

  update(nowMs: number): void {
    if (this.arrivedAt < 0) return;
    const t = easeOutCubic(clamp01((nowMs - this.arrivedAt) / DRIVE_MS));
    // Blue and red alternate, and neighbouring cars run out of phase.
    const phase = Math.floor(nowMs / 220);
    for (const [i, car] of this.cars.entries()) {
      if (!car.body.visible) continue;
      car.body.position.x = car.startX + (car.parkedX - car.startX) * t;
      car.body.position.y = this.groundAt(car.body.position.x, car.parkedZ);
      const on = (phase + i) % 2 === 0;
      car.blue.level.value = on ? 1 : 0.12;
      car.red.level.value = on ? 0.12 : 1;
    }
    if (this.truck.body.visible) {
      const on = phase % 2 === 0;
      this.truck.blue.level.value = on ? 1 : 0.12;
      this.truck.red.level.value = on ? 0.12 : 1;
    }
  }

  dispose(): void {
    for (const car of this.cars) {
      car.body.geometry.dispose();
      car.blue.mesh.geometry.dispose();
      car.red.mesh.geometry.dispose();
      (car.blue.mesh.material as Material).dispose();
      (car.red.mesh.material as Material).dispose();
    }
    this.truck.body.geometry.dispose();
    this.truck.blue.mesh.geometry.dispose();
    this.truck.red.mesh.geometry.dispose();
    (this.truck.blue.mesh.material as Material).dispose();
    (this.truck.red.mesh.material as Material).dispose();
  }
}
