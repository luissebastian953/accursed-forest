/**
 * The ISPO ceremony at the Kopdes (§3.8, §6.5): a banner on two poles pops in
 * with `easeOutBack`, and fireworks burst over the roof for a few seconds.
 * Clean or dirty, it is the same ceremony; the epilogue tells the difference.
 */

import { Group, Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { easeOutBack, easeOutCubic } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

const BANNER_MS = 700;
const SHOW_MS = 9_000;
const BURST_EVERY_MS = 1_100;
const BURST_MS = 900;
const SPARKS = 14;
const COLOURS = [Palette.KopdesFlag, Palette.Fire, Palette.Sand, Palette.Water] as const;

function bannerGeometry() {
  const b = new BoxBuilder();
  for (const x of [-5, 5]) b.addAABox(x, 3.5, 0, 0.35, 7, 0.35, { side: Palette.PalmTrunk });
  b.addAABox(0, 6, 0, 9.8, 2, 0.2, { side: Palette.KopdesFlag });
  b.addAABox(0, 6, 0.12, 7, 0.45, 0.04, { side: Palette.Sand });
  return b.build();
}

function sparkGeometry(colour: number) {
  return new BoxBuilder().addAABox(0, 0, 0, 0.8, 0.8, 0.8, { side: colour }).build();
}

interface Spark {
  mesh: Mesh;
  dx: number;
  dy: number;
  dz: number;
}

export class Ceremony {
  readonly group = new Group();
  private readonly banner: Mesh;
  private readonly sparks: Spark[] = [];
  private startedAt = -1;
  private originY = 0;

  constructor(material: Material) {
    this.banner = new Mesh(bannerGeometry(), material);
    this.banner.visible = false;
    this.group.add(this.banner);
    for (let i = 0; i < SPARKS; i++) {
      const mesh = new Mesh(sparkGeometry(COLOURS[i % COLOURS.length]!), material);
      mesh.visible = false;
      const angle = (i / SPARKS) * Math.PI * 2;
      const lift = 0.6 + ((i * 7) % 5) / 10;
      this.sparks.push({ mesh, dx: Math.cos(angle) * 8, dy: lift * 6, dz: Math.sin(angle) * 8 });
      this.group.add(mesh);
    }
  }

  /** Show the banner for a certified estate; `celebrate` starts the fireworks now. */
  sync(state: SimState, world: World, nowMs: number, celebrate = false): void {
    const certified = state.run.ending === 'clean' || state.run.ending === 'dirty';
    if (!certified || !state.kopdes) {
      this.banner.visible = false;
      for (const s of this.sparks) s.mesh.visible = false;
      this.startedAt = -1;
      return;
    }
    const [bx, by] = world.toXY(state.kopdes.blockId);
    const y = terraceHeight(state.blocks.get(state.kopdes.blockId)?.elevation ?? 0);
    this.group.position.set(
      bx * WORLD.blockSide + WORLD.blockSide / 2,
      y,
      by * WORLD.blockSide + WORLD.blockSide / 2 + 4.5,
    );
    this.originY = 16;
    this.banner.visible = true;
    if (celebrate) this.startedAt = nowMs;
    else if (this.startedAt < 0) this.banner.scale.setScalar(1);
  }

  update(nowMs: number): void {
    if (this.startedAt < 0) return;
    const elapsed = nowMs - this.startedAt;
    this.banner.scale.setScalar(Math.max(0.001, easeOutBack(clamp01(elapsed / BANNER_MS))));

    const bursting = elapsed < SHOW_MS;
    const phase = (elapsed % BURST_EVERY_MS) / BURST_MS;
    const burst = Math.floor(elapsed / BURST_EVERY_MS);
    for (const [i, s] of this.sparks.entries()) {
      s.mesh.visible = bursting && phase <= 1;
      if (!s.mesh.visible) continue;
      const t = easeOutCubic(clamp01(phase));
      const side = burst % 2 === 0 ? -6 : 6;
      s.mesh.position.set(
        side + s.dx * t,
        this.originY + s.dy * t - 5 * t * t,
        s.dz * t * (i % 2 === 0 ? 1 : 0.6),
      );
      s.mesh.scale.setScalar(Math.max(0.001, 1 - clamp01(phase)));
    }
    if (!bursting) this.startedAt = -1;
  }

  dispose(): void {
    this.banner.geometry.dispose();
    for (const s of this.sparks) s.mesh.geometry.dispose();
  }
}
