/**
 * Police cars at the Kopdes (§3.9, §6.3): boxy bodies and cabins with a light
 * bar that blinks. They drive up while an investigation is open, and a
 * SWAT-style truck joins them at the arrest.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeOutCubic } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

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

function lightGeometry(truck: boolean) {
  const b = new BoxBuilder();
  b.addAABox(truck ? 0.9 : -0.1, 1.33, 0, 0.7, 0.14, 0.3, { side: Palette.Water });
  return b.build();
}

export class Police {
  readonly group = new Group();
  private readonly cars: {
    body: Mesh;
    light: Mesh;
    parkedX: number;
    parkedZ: number;
    startX: number;
  }[] = [];
  private readonly truck: { body: Mesh; light: Mesh };
  private arrivedAt = -1;
  private truckAt = -1;

  constructor(material: Material) {
    for (let i = 0; i < 2; i++) {
      const body = new Mesh(carGeometry(false), material);
      const light = new Mesh(lightGeometry(false), material);
      body.add(light);
      body.visible = false;
      this.group.add(body);
      this.cars.push({ body, light, parkedX: 0, parkedZ: 0, startX: 0 });
    }
    const body = new Mesh(carGeometry(true), material);
    const light = new Mesh(lightGeometry(true), material);
    body.add(light);
    body.visible = false;
    this.group.add(body);
    this.truck = { body, light };
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
    const y = terraceHeight(state.blocks.get(state.kopdes.blockId)?.elevation ?? 0);
    const cx = bx * WORLD.blockSide + WORLD.blockSide / 2;
    const cz = by * WORLD.blockSide + WORLD.blockSide / 2;

    if (this.arrivedAt < 0) this.arrivedAt = nowMs;
    this.cars.forEach((car, i) => {
      car.parkedX = cx - 3 + i * 3.2;
      car.parkedZ = cz + 4.2;
      car.startX = car.parkedX - 30;
      car.body.position.set(car.startX, y, car.parkedZ);
      car.body.visible = true;
    });

    if (state.run.ending === 'arrested') {
      if (this.truckAt < 0) this.truckAt = nowMs;
      this.truck.body.position.set(cx + 4, y, cz + 4.2);
      this.truck.body.visible = true;
    }
  }

  update(nowMs: number): void {
    if (this.arrivedAt < 0) return;
    const t = easeOutCubic(clamp01((nowMs - this.arrivedAt) / DRIVE_MS));
    const blink = Math.floor(nowMs / 250) % 2 === 0;
    for (const [i, car] of this.cars.entries()) {
      if (!car.body.visible) continue;
      car.body.position.x = car.startX + (car.parkedX - car.startX) * t;
      car.light.visible = i % 2 === 0 ? blink : !blink;
    }
    if (this.truck.body.visible) this.truck.light.visible = blink;
  }

  dispose(): void {
    for (const car of this.cars) {
      car.body.geometry.dispose();
      car.light.geometry.dispose();
    }
    this.truck.body.geometry.dispose();
    this.truck.light.geometry.dispose();
  }
}
