import { InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three/webgpu';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

const MAX_COINS = 160;
/** World units a second, squared: a coin's arc is short and snappy. */
const GRAVITY = 26;
/** Seconds a coin lives, and how long it spends shrinking at the end. */
const LIFE = 1.6;
const FADE = 0.45;
/** How high and how wide a coin is thrown. */
const UP = { min: 5.5, max: 9 };
const OUT = { min: 1.2, max: 3.8 };
const SPIN = { min: 6, max: 13 };

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _axis = new Vector3(0, 1, 0);

export class Coins {
  readonly mesh: InstancedMesh;
  private readonly x = new Float32Array(MAX_COINS);
  private readonly y = new Float32Array(MAX_COINS);
  private readonly z = new Float32Array(MAX_COINS);
  private readonly vx = new Float32Array(MAX_COINS);
  private readonly vy = new Float32Array(MAX_COINS);
  private readonly vz = new Float32Array(MAX_COINS);
  private readonly spin = new Float32Array(MAX_COINS);
  private readonly turn = new Float32Array(MAX_COINS);
  private readonly ground = new Float32Array(MAX_COINS);
  /** Seconds left; 0 is a free slot. */
  private readonly life = new Float32Array(MAX_COINS);
  private used = 0;
  private seed = 20_260_918;

  constructor(material: Material) {
    // A fat little disc: wide, thin, and gold on every face.
    const geometry = new BoxBuilder()
      .addAABox(0, 0, 0, 0.5, 0.12, 0.5, { side: Palette.Coin })
      .build();

    this.mesh = new InstancedMesh(geometry, material, MAX_COINS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** How many coins are in the air. */
  get count(): number {
    return this.used;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private between(range: { min: number; max: number }): number {
    return range.min + this.random() * (range.max - range.min);
  }

  /** Throw `count` coins up from (x, y, z); they fall back to `y`. */
  burst(x: number, y: number, z: number, count = 10): void {
    for (let i = 0; i < count; i++) {
      if (this.used >= MAX_COINS) return;

      const slot = this.used++;
      const angle = this.random() * Math.PI * 2;
      const out = this.between(OUT);

      this.x[slot] = x;
      this.y[slot] = y;
      this.z[slot] = z;
      this.vx[slot] = Math.cos(angle) * out;
      this.vy[slot] = this.between(UP);
      this.vz[slot] = Math.sin(angle) * out;
      this.spin[slot] = this.between(SPIN) * (this.random() < 0.5 ? -1 : 1);
      this.turn[slot] = this.random() * Math.PI * 2;
      this.ground[slot] = y;
      this.life[slot] = LIFE;
    }
  }

  /** Every coin in the air, one step on. */
  update(dtSeconds: number): void {
    if (this.used === 0) {
      this.mesh.count = 0;
      return;
    }

    const dt = Math.min(0.05, dtSeconds);

    for (let i = this.used - 1; i >= 0; i--) {
      const life = this.life[i]! - dtSeconds;

      if (life <= 0) {
        // Swap the last live coin into this slot and shrink the pool.
        this.used -= 1;
        this.copy(this.used, i);
        continue;
      }

      this.life[i] = life;
      this.vy[i] = this.vy[i]! - GRAVITY * dt;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.y[i] = this.y[i]! + this.vy[i]! * dt;
      this.z[i] = this.z[i]! + this.vz[i]! * dt;
      this.turn[i] = this.turn[i]! + this.spin[i]! * dt;

      // Landed: it settles where it fell rather than rolling on.
      if (this.y[i]! <= this.ground[i]!) {
        this.y[i] = this.ground[i]!;
        this.vy[i] = 0;
        this.vx[i] = this.vx[i]! * 0.4;
        this.vz[i] = this.vz[i]! * 0.4;
        this.spin[i] = this.spin[i]! * 0.5;
      }
    }

    this.mesh.count = this.used;

    for (let i = 0; i < this.used; i++) {
      const life = this.life[i]!;
      const scale = life < FADE ? life / FADE : 1;

      _p.set(this.x[i]!, this.y[i]! + 0.06 * scale, this.z[i]!);
      _q.setFromAxisAngle(_axis, this.turn[i]!);
      _s.setScalar(scale);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Drop everything in the air, for a new estate. */
  clear(): void {
    this.used = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }

  private copy(from: number, to: number): void {
    if (from === to) return;
    this.x[to] = this.x[from]!;
    this.y[to] = this.y[from]!;
    this.z[to] = this.z[from]!;
    this.vx[to] = this.vx[from]!;
    this.vy[to] = this.vy[from]!;
    this.vz[to] = this.vz[from]!;
    this.spin[to] = this.spin[from]!;
    this.turn[to] = this.turn[from]!;
    this.ground[to] = this.ground[from]!;
    this.life[to] = this.life[from]!;
  }
}
