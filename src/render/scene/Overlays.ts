/**
 * In-scene overlays (§8 #11, #21): the selection ring and the Kopdes range
 * ring. The selection ring pops in with `easeOutBack`; both float above the
 * block so they read on any terrain.
 */

import { Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import { kopdesRange } from '@sim/kopdes';
import type { BlockId, SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { DURATION, easeOutBack } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { ELEVATION_STEP, terraceHeight } from './chunkField.ts';

function buildRingGeometry() {
  const b = new BoxBuilder();
  const s = WORLD.blockSide;
  const t = 0.35;
  const h = 0.3;
  b.addAABox(0, 0, -s / 2 + t / 2, s, h, t, { side: Palette.KopdesFlag });
  b.addAABox(0, 0, s / 2 - t / 2, s, h, t, { side: Palette.KopdesFlag });
  b.addAABox(-s / 2 + t / 2, 0, 0, t, h, s, { side: Palette.KopdesFlag });
  b.addAABox(s / 2 - t / 2, 0, 0, t, h, s, { side: Palette.KopdesFlag });
  return b.build();
}

export class SelectionRing {
  readonly mesh: Mesh;
  private shownAt = -1;
  private selected: BlockId | null = null;

  constructor(material: Material) {
    this.mesh = new Mesh(buildRingGeometry(), material);
    this.mesh.visible = false;
  }

  get block(): BlockId | null {
    return this.selected;
  }

  show(state: SimState, world: World, block: BlockId, nowMs: number): void {
    const [bx, by] = world.toXY(block);
    const generated = world.generated(bx, by);
    const diverged = state.blocks.get(block);
    const terraced = diverged && diverged.phase !== 'wild';
    const y = terraced
      ? terraceHeight(generated.elevation) + 0.4
      : terraceHeight(generated.elevation) + ELEVATION_STEP + 0.4;

    const half = WORLD.blockSide / 2;
    this.mesh.position.set(bx * WORLD.blockSide + half, y, by * WORLD.blockSide + half);
    this.mesh.visible = true;
    if (this.selected !== block) this.shownAt = nowMs;
    this.selected = block;
  }

  hide(): void {
    this.mesh.visible = false;
    this.selected = null;
  }

  update(nowMs: number): void {
    if (!this.mesh.visible || this.shownAt < 0) return;
    const t = clamp01((nowMs - this.shownAt) / DURATION.popIn);
    const s = Math.max(0.001, easeOutBack(t));
    this.mesh.scale.set(s, 1, s);
    if (t >= 1) this.shownAt = -1;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

/**
 * The Kopdes range ring (§8 panel 21): a thin frame on every block the Kopdes
 * can sell for, drawn while the shop is open. Rebuilt when the Kopdes moves or
 * levels up; a few hundred boxes at most.
 */
export class RangeRing {
  readonly mesh: Mesh;
  private key = '';

  constructor(material: Material) {
    this.mesh = new Mesh(new BoxBuilder().build(), material);
    this.mesh.visible = false;
  }

  show(state: SimState, world: World): void {
    const kopdes = state.kopdes;
    if (!kopdes) {
      this.hide();
      return;
    }

    const key = `${kopdes.blockId}:${kopdes.level}`;
    if (key !== this.key) {
      this.key = key;
      this.mesh.geometry.dispose();
      this.mesh.geometry = buildRangeGeometry(state, world);
    }
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

function buildRangeGeometry(state: SimState, world: World) {
  const kopdes = state.kopdes!;
  const range = kopdesRange(kopdes.level);
  const [kx, ky] = world.toXY(kopdes.blockId);
  const b = new BoxBuilder();
  const s = WORLD.blockSide;
  const t = 0.18;
  const h = 0.15;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;
      const bx = kx + dx;
      const by = ky + dy;
      if (!world.inBounds(bx, by)) continue;
      const id = world.toId(bx, by);
      const generated = world.generated(bx, by);
      if (generated.biome === 'river') continue;

      const diverged = state.blocks.get(id);
      const terraced = diverged && diverged.phase !== 'wild';
      const y = terraceHeight(generated.elevation) + (terraced ? 0.2 : ELEVATION_STEP + 0.2);
      const cx = bx * s + s / 2;
      const cz = by * s + s / 2;
      const inset = 0.6;
      const len = s - inset * 2;
      b.addAABox(cx, y, cz - len / 2 + t / 2, len, h, t, { side: Palette.PalmFrondYoung });
      b.addAABox(cx, y, cz + len / 2 - t / 2, len, h, t, { side: Palette.PalmFrondYoung });
      b.addAABox(cx - len / 2 + t / 2, y, cz, t, h, len, { side: Palette.PalmFrondYoung });
      b.addAABox(cx + len / 2 - t / 2, y, cz, t, h, len, { side: Palette.PalmFrondYoung });
    }
  }
  return b.build();
}
