/**
 * Sparkles (§6.5): a few glints turning over something worth a click, so a
 * golden capybara in the grass or a babi ngepet up on two legs reads as
 * "this one, now" rather than as scenery.
 *
 * One instanced mesh, a fixed ring of glints per point, stepped on the CPU.
 * The caller hands in the points every frame; nothing is kept between them.
 *
 * `SparkleBurst` is the other half: one throw of glints that arc out, turn
 * over and go. It is for a moment rather than a state, such as the Kopdes
 * coming back bigger after an upgrade.
 */

import { InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three/webgpu';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** Glints per point, and how many points can shine at once. */
const PER_POINT = 5;
const MAX_POINTS = 12;
const MAX = PER_POINT * MAX_POINTS;

/** How wide the ring is, how fast it turns, and how far the glints bob. */
const RADIUS = 0.95;
const TURN = 1.6;
const BOB = 0.35;
const LIFT = 1.35;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _axis = new Vector3(0.4, 1, 0.2).normalize();

export interface SparklePoint {
  x: number;
  y: number;
  z: number;
}

export class Sparkles {
  readonly mesh: InstancedMesh;

  constructor(material: Material) {
    const geometry = new BoxBuilder()
      .addAABox(0, 0, 0, 0.3, 0.3, 0.3, { side: Palette.Sparkle })
      .build();
    this.mesh = new InstancedMesh(geometry, material, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** Shine over each point. Time is the wall clock, so the glints keep turning. */
  update(points: readonly SparklePoint[], nowMs: number): void {
    const count = Math.min(points.length, MAX_POINTS);
    this.mesh.count = count * PER_POINT;
    if (count === 0) return;
    const time = nowMs / 1000;

    let i = 0;
    for (let p = 0; p < count; p++) {
      const point = points[p]!;
      for (let g = 0; g < PER_POINT; g++) {
        const phase = (g / PER_POINT) * Math.PI * 2;
        const angle = time * TURN + phase;
        // Each glint swells and shrinks in its own time, so the ring twinkles.
        const pulse = 0.55 + 0.45 * Math.sin(time * 4 + phase * 1.7);
        _p.set(
          point.x + Math.cos(angle) * RADIUS,
          point.y + LIFT + Math.sin(time * 2.2 + phase) * BOB,
          point.z + Math.sin(angle) * RADIUS,
        );
        _q.setFromAxisAngle(_axis, angle * 1.5);
        _s.setScalar(0.5 + pulse * 0.9);
        this.mesh.setMatrixAt(i++, _m.compose(_p, _q, _s));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

/** Glints in one throw, and how many throws can overlap. */
const BURST_MAX = 90;
/** How the throw moves: out, up, and down again, turning as it goes. */
const BURST_GRAVITY = 11;
const BURST_LIFE = 1.15;
const BURST_UP = { min: 2.6, max: 6.4 };
const BURST_OUT = { min: 1.4, max: 4.2 };
const BURST_SPIN = { min: 4, max: 11 };

/**
 * A one-shot throw of glints. Same pool discipline as the coins: a burst past
 * the pool drops its extra glints rather than growing the buffer.
 */
export class SparkleBurst {
  readonly mesh: InstancedMesh;
  private readonly x = new Float32Array(BURST_MAX);
  private readonly y = new Float32Array(BURST_MAX);
  private readonly z = new Float32Array(BURST_MAX);
  private readonly vx = new Float32Array(BURST_MAX);
  private readonly vy = new Float32Array(BURST_MAX);
  private readonly vz = new Float32Array(BURST_MAX);
  private readonly spin = new Float32Array(BURST_MAX);
  private readonly turn = new Float32Array(BURST_MAX);
  private readonly life = new Float32Array(BURST_MAX);
  private used = 0;
  private seed = 0x5eed;

  constructor(material: Material) {
    const geometry = new BoxBuilder()
      .addAABox(0, 0, 0, 0.3, 0.3, 0.3, { side: Palette.Sparkle })
      .build();
    this.mesh = new InstancedMesh(geometry, material, BURST_MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private between(range: { min: number; max: number }): number {
    return range.min + this.random() * (range.max - range.min);
  }

  /** Throw `count` glints from a point, once. */
  burst(x: number, y: number, z: number, count = 14): void {
    for (let i = 0; i < count; i++) {
      if (this.used >= BURST_MAX) return;
      const slot = this.used++;
      const angle = this.random() * Math.PI * 2;
      const out = this.between(BURST_OUT);
      this.x[slot] = x;
      this.y[slot] = y;
      this.z[slot] = z;
      this.vx[slot] = Math.cos(angle) * out;
      this.vy[slot] = this.between(BURST_UP);
      this.vz[slot] = Math.sin(angle) * out;
      this.spin[slot] = this.between(BURST_SPIN) * (this.random() < 0.5 ? -1 : 1);
      this.turn[slot] = this.random() * Math.PI * 2;
      this.life[slot] = BURST_LIFE;
    }
  }

  /** Every glint in the air, one step on. */
  update(dtSeconds: number): void {
    if (this.used === 0) {
      this.mesh.count = 0;
      return;
    }
    let live = 0;
    for (let i = 0; i < this.used; i++) {
      const life = this.life[i]! - dtSeconds;
      if (life <= 0) continue;
      // Compact as it goes: the dead leave, the living keep their order.
      const slot = live++;
      this.life[slot] = life;
      this.vy[i] = this.vy[i]! - BURST_GRAVITY * dtSeconds;
      this.x[slot] = this.x[i]! + this.vx[i]! * dtSeconds;
      this.y[slot] = this.y[i]! + this.vy[i]! * dtSeconds;
      this.z[slot] = this.z[i]! + this.vz[i]! * dtSeconds;
      this.vx[slot] = this.vx[i]!;
      this.vy[slot] = this.vy[i]!;
      this.vz[slot] = this.vz[i]!;
      this.turn[slot] = this.turn[i]! + this.spin[i]! * dtSeconds;
      this.spin[slot] = this.spin[i]!;

      // A glint is brightest at the top of its arc and shrinks out of sight.
      const t = this.life[slot]! / BURST_LIFE;
      const scale = 0.45 + 1.15 * Math.sin(Math.PI * Math.min(1, t * 1.25));
      _p.set(this.x[slot]!, this.y[slot]!, this.z[slot]!);
      _q.setFromAxisAngle(_axis, this.turn[slot]!);
      _s.setScalar(scale);
      this.mesh.setMatrixAt(slot, _m.compose(_p, _q, _s));
    }
    this.used = live;
    this.mesh.count = live;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
