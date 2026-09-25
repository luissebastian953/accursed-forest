import { float, min, smoothstep, uniform, uv, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  type BufferGeometry,
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
 * Where an overlay sits over a block: just above the land's highest point,
 * since blended wild land is not flat and the terrace height buries it.
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
 * The selection ring (GDD 8 #11): a flat blue frame with a pulsing additive
 * halo, unlit and brighter than white so it reads against any ground.
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

  /**
   * @param pulsing false holds the glow steady while the estate is paused;
   * the pop-in still runs, since a click must answer even with the clock stopped.
   */
  update(nowMs: number, pulsing = true): void {
    if (!this.group.visible) return;
    this.pulse.value = pulsing ? 0.82 + 0.18 * Math.sin(nowMs * 0.004) : 1;
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
 * The Kopdes range ring (GDD 8 panel 21): a thin frame on every block it can
 * sell for, rebuilt when the Kopdes moves or levels up.
 */
export class RangeRing {
  readonly group = new Group();
  private readonly core: Mesh;
  private readonly glow: Mesh;
  private key = '';

  /** `_material` is the shared palette material; these rings light themselves. */
  constructor(_material?: Material) {
    // The same flat, self-lit treatment as the selection ring, thinner and a
    // touch softer: many of these are on screen at once, showing the estate's edges.
    const coreMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });

    coreMaterial.colorNode = vec3(0.3, 1.1, 2.5);
    coreMaterial.opacityNode = float(0.72);
    this.core = new Mesh(new BoxBuilder().build(), coreMaterial);

    const glowMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    glowMaterial.colorNode = vec3(0.1, 0.45, 1.2);
    glowMaterial.opacityNode = float(0.3);
    this.glow = new Mesh(new BoxBuilder().build(), glowMaterial);
    this.glow.position.y = -0.02;

    this.group.add(this.core, this.glow);
    this.group.visible = false;
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
      this.core.geometry.dispose();
      this.glow.geometry.dispose();
      this.core.geometry = buildRangeGeometry(state, world, RANGE_BAR, 0.2);
      // The glow is the same frame wider and a little lower: from above it
      // reads as a soft bloom either side of the line.
      this.glow.geometry = buildRangeGeometry(state, world, RANGE_BAR * 3.2, 0.18);
    }

    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.core.geometry.dispose();
    this.glow.geometry.dispose();
    (this.core.material as Material).dispose();
    (this.glow.material as Material).dispose();
  }
}

/** How thick the range frame's bars are: narrower than the selection ring. */
const RANGE_BAR = 0.12;

function buildRangeGeometry(state: SimState, world: World, t: number, lift: number) {
  const kopdes = state.kopdes!;
  const range = kopdesRange(kopdes.level);
  const [kx, ky] = world.toXY(kopdes.blockId);
  const b = new BoxBuilder();
  const s = WORLD.blockSide;
  // Flat: a bar with height showed its dark sides, and read as a raised rail.
  const h = 0.03;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > range) continue;

      const bx = kx + dx;
      const by = ky + dy;

      if (!world.inBounds(bx, by)) continue;

      const id = world.toId(bx, by);
      const generated = world.generated(bx, by);

      if (generated.biome === 'river') continue;

      const y = overlayHeight(state, world, id, lift);
      const cx = bx * s + s / 2;
      const cz = by * s + s / 2;
      const inset = 0.6;
      const len = s - inset * 2;

      b.addAABox(cx, y, cz - len / 2 + t / 2, len, h, t, { side: Palette.Water });
      b.addAABox(cx, y, cz + len / 2 - t / 2, len, h, t, { side: Palette.Water });
      b.addAABox(cx - len / 2 + t / 2, y, cz, t, h, len, { side: Palette.Water });
      b.addAABox(cx + len / 2 - t / 2, y, cz, t, h, len, { side: Palette.Water });
    }
  }

  return b.build();
}

/**
 * The fire-spread preview (GDD 8 panel 22): while hovering a Burn button, each
 * neighbour that could catch wears the selection ring's frame and halo, in orange.
 */
export class HazardRing {
  readonly group = new Group();
  private readonly frame: BufferGeometry;
  private readonly halo: PlaneGeometry;
  private readonly frameMaterial: MeshBasicNodeMaterial;
  private readonly haloMaterial: MeshBasicNodeMaterial;

  /** `_material` is the shared palette material; the rings light themselves. */
  constructor(_material?: Material) {
    this.frameMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    this.frameMaterial.colorNode = vec3(2.8, 1.15, 0.22);
    this.frameMaterial.opacityNode = float(0.85);
    this.frame = buildSelectionFrame();

    this.haloMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.haloMaterial.colorNode = vec3(1.35, 0.5, 0.08);

    const p = uv();
    const edge = min(min(p.x, float(1).sub(p.x)), min(p.y, float(1).sub(p.y)));
    const band = float(HALO_SPILL / (1 + HALO_SPILL * 2));

    this.haloMaterial.opacityNode = smoothstep(float(0.13), float(0), edge.sub(band).abs()).mul(
      0.38,
    );

    const side = WORLD.blockSide * (1 + HALO_SPILL * 2);

    this.halo = new PlaneGeometry(side, side).rotateX(-Math.PI / 2);
    this.group.visible = false;
  }

  show(blocks: readonly BlockId[], state: SimState, world: World): void {
    this.group.clear();

    if (blocks.length === 0) {
      this.group.visible = false;
      return;
    }

    const s = WORLD.blockSide;

    for (const id of blocks) {
      const [bx, by] = world.toXY(id);
      const y = overlayHeight(state, world, id, 0.45);
      const frame = new Mesh(this.frame, this.frameMaterial);
      const halo = new Mesh(this.halo, this.haloMaterial);

      frame.position.set(bx * s + s / 2, y, by * s + s / 2);
      halo.position.set(bx * s + s / 2, y - 0.05, by * s + s / 2);
      this.group.add(frame, halo);
    }

    this.group.visible = true;
  }

  hide(): void {
    this.group.clear();
    this.group.visible = false;
  }

  dispose(): void {
    this.group.clear();
    this.frame.dispose();
    this.halo.dispose();
    this.frameMaterial.dispose();
    this.haloMaterial.dispose();
  }
}
