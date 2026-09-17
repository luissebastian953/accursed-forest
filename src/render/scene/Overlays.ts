/**
 * In-scene overlays (§8 #11, #21): the selection ring, the Kopdes range ring
 * and the fire-spread preview. The selection ring is a flat glowing frame
 * that pops in with `easeOutBack`; the others float just above the block so
 * they read on any terrain.
 */

import { float, min, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  type Material,
} from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import { kopdesRange } from '@sim/kopdes';
import type { BlockId, SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { DURATION, easeOutBack } from '../anim/easing.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { landHeight } from './chunkField.ts';

/**
 * Where an overlay sits over a block: just above the highest point of the
 * land the mesher draws there. Blended wild land (and a block being cleared)
 * is not flat, so the terrace height alone buried the ring on the high side.
 */
function overlayHeight(state: SimState, world: World, block: BlockId, lift: number): number {
  const [bx, by] = world.toXY(block);
  const s = WORLD.blockSide;
  const phaseOf = (id: BlockId) => state.blocks.get(id)?.phase ?? 'wild';
  let top = -Infinity;
  for (const [fx, fz] of [
    [0.5, 0.5],
    [0.08, 0.08],
    [0.92, 0.08],
    [0.08, 0.92],
    [0.92, 0.92],
  ] as const) {
    top = Math.max(top, landHeight(world, phaseOf, (bx + fx) * s, (by + fz) * s));
  }
  return top + lift;
}

/** The flat frame that lies on the block: four thin bars, inset from the edge. */
function buildSelectionFrame() {
  const b = new BoxBuilder();
  const s = WORLD.blockSide;
  const t = 0.34;
  const h = 0.1;
  const inset = 0.35;
  const len = s - inset * 2;
  b.addAABox(0, 0, -len / 2 + t / 2, len, h, t, { side: Palette.Water });
  b.addAABox(0, 0, len / 2 - t / 2, len, h, t, { side: Palette.Water });
  b.addAABox(-len / 2 + t / 2, 0, 0, t, h, len, { side: Palette.Water });
  b.addAABox(len / 2 - t / 2, 0, 0, t, h, len, { side: Palette.Water });
  // Corner ticks, so the frame still reads when the bars are edge-on.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.addAABox((sx * len) / 2, 0.01, (sz * len) / 2, 0.95, h, 0.95, { side: Palette.Water });
    }
  }
  return b.build();
}

/** How far past the block the halo spills, as a share of the block side. */
const HALO_SPILL = 0.35;

/**
 * The selection ring (§8 #11): a flat blue frame on the block with an
 * additive halo glowing out of it, pulsing gently. Unlit and brighter than
 * white, so it reads against any ground; and blooms when the glow pass is on.
 */
export class SelectionRing {
  readonly group = new Group();
  private readonly frame: Mesh;
  private readonly halo: Mesh;
  private readonly pulse = uniform(1);
  private shownAt = -1;
  private selected: BlockId | null = null;

  /** `_material` is the shared palette material; the ring lights itself. */
  constructor(_material?: Material) {
    const frameMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    frameMaterial.colorNode = vec3(0.32, 1.25, 2.8).mul(this.pulse);
    frameMaterial.opacityNode = float(0.85);
    this.frame = new Mesh(buildSelectionFrame(), frameMaterial);

    const haloMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    haloMaterial.colorNode = vec3(0.12, 0.55, 1.35).mul(this.pulse);
    // Distance from the plane's edge, in plane units; the glow sits on the
    // block's boundary and falls off both ways.
    const p = uv();
    const edge = min(min(p.x, float(1).sub(p.x)), min(p.y, float(1).sub(p.y)));
    const band = float(HALO_SPILL / (1 + HALO_SPILL * 2));
    haloMaterial.opacityNode = smoothstep(float(0.13), float(0), edge.sub(band).abs()).mul(0.38);
    const side = WORLD.blockSide * (1 + HALO_SPILL * 2);
    this.halo = new Mesh(new PlaneGeometry(side, side).rotateX(-Math.PI / 2), haloMaterial);
    this.halo.position.y = -0.05;

    this.group.add(this.frame, this.halo);
    this.group.visible = false;
  }

  get block(): BlockId | null {
    return this.selected;
  }

  show(state: SimState, world: World, block: BlockId, nowMs: number): void {
    const [bx, by] = world.toXY(block);
    const y = overlayHeight(state, world, block, 0.35);

    const half = WORLD.blockSide / 2;
    this.group.position.set(bx * WORLD.blockSide + half, y, by * WORLD.blockSide + half);
    this.group.visible = true;
    if (this.selected !== block) this.shownAt = nowMs;
    this.selected = block;
  }

  hide(): void {
    this.group.visible = false;
    this.selected = null;
  }

  update(nowMs: number): void {
    if (!this.group.visible) return;
    this.pulse.value = 0.82 + 0.18 * Math.sin(nowMs * 0.004);
    if (this.shownAt < 0) return;
    const t = clamp01((nowMs - this.shownAt) / DURATION.popIn);
    const s = Math.max(0.001, easeOutBack(t));
    this.group.scale.set(s, 1, s);
    if (t >= 1) this.shownAt = -1;
  }

  dispose(): void {
    this.frame.geometry.dispose();
    this.halo.geometry.dispose();
    (this.frame.material as Material).dispose();
    (this.halo.material as Material).dispose();
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

      const y = overlayHeight(state, world, id, 0.2);
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

/**
 * The fire-spread preview (§8 panel 22): while hovering a Burn button, the
 * neighbours that could catch are framed in flame orange.
 */
export class HazardRing {
  readonly mesh: Mesh;

  constructor(material: Material) {
    this.mesh = new Mesh(new BoxBuilder().build(), material);
    this.mesh.visible = false;
  }

  show(blocks: readonly BlockId[], state: SimState, world: World): void {
    if (blocks.length === 0) {
      this.hide();
      return;
    }
    const b = new BoxBuilder();
    const s = WORLD.blockSide;
    const t = 0.35;
    const h = 0.25;
    for (const id of blocks) {
      const [bx, by] = world.toXY(id);
      const y = overlayHeight(state, world, id, 0.5);
      const cx = bx * s + s / 2;
      const cz = by * s + s / 2;
      const len = s - 1;
      b.addAABox(cx, y, cz - len / 2 + t / 2, len, h, t, { side: Palette.Fire });
      b.addAABox(cx, y, cz + len / 2 - t / 2, len, h, t, { side: Palette.Fire });
      b.addAABox(cx - len / 2 + t / 2, y, cz, t, h, len, { side: Palette.Fire });
      b.addAABox(cx + len / 2 - t / 2, y, cz, t, h, len, { side: Palette.Fire });
    }
    this.mesh.geometry.dispose();
    this.mesh.geometry = b.build();
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
