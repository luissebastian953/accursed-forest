/**
 * In-scene overlays (§8 #11): the selection ring. It pops in with
 * `easeOutBack` and floats above the block so it reads on any terrain.
 */

import { Mesh, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
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
