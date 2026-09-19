import { distance, float, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';
import {
  AdditiveBlending,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Vector3,
  type Material,
} from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { terraceHeight } from './chunkField.ts';

const SIDE = WORLD.blockSide;

export const FIRE_LOOK = {
  /** Flame sources per burning block, by intensity. */
  sources: { 1: 6, 2: 9, 3: 12 } as Record<number, number>,
  flamesPerSecond: 18,
  embersPerSecond: 2.5,
  smokePerSecond: 1.6,
  maxFlames: 6000,
  maxEmbers: 900,
  maxSmoke: 900,
  maxGlows: 256,
  lights: 4,
} as const;

/** White-hot → yellow → orange → red, as HDR multipliers of 1. */
const RAMP: readonly (readonly [number, number, number, number])[] = [
  [0, 2.5, 2.3, 1.6],
  [0.18, 2.4, 1.7, 0.6],
  [0.45, 2.1, 0.95, 0.22],
  [0.75, 1.4, 0.4, 0.07],
  [1, 0.8, 0.15, 0.05],
];

function ramp(t: number, out: Color): Color {
  for (let i = 1; i < RAMP.length; i++) {
    const [t1, r1, g1, b1] = RAMP[i]!;

    if (t <= t1) {
      const [t0, r0, g0, b0] = RAMP[i - 1]!;
      const f = (t - t0) / (t1 - t0);

      return out.setRGB(r0 + (r1 - r0) * f, g0 + (g1 - g0) * f, b0 + (b1 - b0) * f);
    }
  }

  const [, r, g, b] = RAMP.at(-1)!;

  return out.setRGB(r, g, b);
}

interface Source {
  x: number;
  y: number;
  z: number;
  /** 1..3 */
  strength: number;
  /** Fractional particles owed, per kind. */
  flameDebt: number;
  emberDebt: number;
  smokeDebt: number;
}

/** A pool of particles stored as parallel arrays. */
class Pool {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly size: Float32Array;
  readonly spin: Float32Array;
  /** Where the flame should narrow toward: its source's centre. */
  readonly cx: Float32Array;
  readonly cz: Float32Array;
  count = 0;

  constructor(readonly max: number) {
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.z = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.vz = new Float32Array(max);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.cx = new Float32Array(max);
    this.cz = new Float32Array(max);
  }

  /** Index of a new particle, or -1 when full. */
  add(): number {
    if (this.count >= this.max) return -1;
    return this.count++;
  }

  /** Remove particle `i` by moving the last one into its place. */
  remove(i: number): void {
    const last = --this.count;

    for (const array of [
      this.x,
      this.y,
      this.z,
      this.vx,
      this.vy,
      this.vz,
      this.age,
      this.life,
      this.size,
      this.spin,
      this.cx,
      this.cz,
    ]) {
      array[i] = array[last]!;
    }
  }
}

function hash01(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;

  return v - Math.floor(v);
}

export class Fires {
  readonly group = new Group();
  private readonly flameMesh: InstancedMesh;
  private readonly emberMesh: InstancedMesh;
  private readonly smokeMesh: InstancedMesh;
  private readonly glowMesh: InstancedMesh;
  private readonly lights: PointLight[] = [];
  private readonly flicker = uniform(1);
  private readonly flames = new Pool(FIRE_LOOK.maxFlames);
  private readonly embers = new Pool(FIRE_LOOK.maxEmbers);
  private readonly smoke = new Pool(FIRE_LOOK.maxSmoke);
  private sources: Source[] = [];
  private key = '';
  private lastMs = -1;
  private seed = 7;

  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly axis = new Vector3(0.3, 1, 0.2).normalize();
  private readonly c = new Color();

  /** `_material` is the shared palette material; fire makes its own, unlit ones. */
  constructor(_material?: Material) {
    const cube = new BoxBuilder().addAABox(0, 0, 0, 1, 1, 1, { side: Palette.Fire }).build();

    const flameMaterial = new MeshBasicNodeMaterial();

    this.flameMesh = new InstancedMesh(cube, flameMaterial, FIRE_LOOK.maxFlames);

    const emberMaterial = new MeshBasicNodeMaterial();

    this.emberMesh = new InstancedMesh(cube, emberMaterial, FIRE_LOOK.maxEmbers);

    const smokeMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.smokeMesh = new InstancedMesh(cube, smokeMaterial, FIRE_LOOK.maxSmoke);

    const glowMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    glowMaterial.colorNode = vec3(1, 0.42, 0.12).mul(this.flicker);
    glowMaterial.opacityNode = smoothstep(float(0.5), float(0), distance(uv(), vec2(0.5, 0.5))).mul(
      0.85,
    );

    const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

    this.glowMesh = new InstancedMesh(plane, glowMaterial, FIRE_LOOK.maxGlows);

    for (const mesh of [this.flameMesh, this.emberMesh, this.smokeMesh, this.glowMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }

    // Colour buffers exist from the start, so the shader is built with them.
    this.flameMesh.setColorAt(0, this.c.setRGB(1, 1, 1));
    this.emberMesh.setColorAt(0, this.c);
    this.smokeMesh.setColorAt(0, this.c.setRGB(0.3, 0.28, 0.26));

    for (let i = 0; i < FIRE_LOOK.lights; i++) {
      const light = new PointLight(0xff7a2a, 0, 22, 2);

      this.lights.push(light);
      this.group.add(light);
    }
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Re-read which blocks burn. Cheap when nothing changed. */
  sync(state: SimState, world: World): void {
    const burning: { id: number; intensity: number }[] = [];

    for (const block of state.blocks.values()) {
      if (block.burning) burning.push({ id: block.id, intensity: block.fireIntensity });
    }

    burning.sort((a, b) => a.id - b.id);

    const key = burning.map((b) => `${b.id}:${b.intensity}`).join(',');

    if (key === this.key) return;
    this.key = key;

    this.sources = [];

    let glows = 0;

    for (const { id, intensity } of burning) {
      const [bx, by] = world.toXY(id);
      const base = terraceHeight(world.generated(bx, by).elevation) + 0.3;
      const count = FIRE_LOOK.sources[intensity] ?? FIRE_LOOK.sources[1]!;

      for (let i = 0; i < count; i++) {
        this.sources.push({
          x: bx * SIDE + 1.5 + hash01(id, i) * (SIDE - 3),
          y: base,
          z: by * SIDE + 1.5 + hash01(i, id) * (SIDE - 3),
          strength: intensity,
          flameDebt: hash01(id, i + 99),
          emberDebt: 0,
          smokeDebt: 0,
        });
      }

      if (glows < FIRE_LOOK.maxGlows) {
        const size = SIDE * (1.2 + intensity * 0.2);

        this.m
          .makeScale(size, 1, size)
          .setPosition((bx + 0.5) * SIDE, base + 0.1, (by + 0.5) * SIDE);
        this.glowMesh.setMatrixAt(glows++, this.m);
      }
    }

    this.glowMesh.count = glows;
    this.glowMesh.instanceMatrix.needsUpdate = true;

    // Light the biggest fires: spread the lights across the burning blocks.
    this.lights.forEach((light, i) => {
      const block = burning[Math.floor((i * burning.length) / FIRE_LOOK.lights)];

      if (!block || i >= burning.length) {
        light.intensity = 0;
        return;
      }

      const [bx, by] = world.toXY(block.id);

      light.position.set(
        (bx + 0.5) * SIDE,
        terraceHeight(world.generated(bx, by).elevation) + 3,
        (by + 0.5) * SIDE,
      );
      light.userData['base'] = 30 + block.intensity * 15;
    });
  }

  get burning(): boolean {
    return this.sources.length > 0 || this.flames.count > 0;
  }

  update(nowMs: number): void {
    const dt = this.lastMs < 0 ? 0 : Math.min(0.1, (nowMs - this.lastMs) / 1000);

    this.lastMs = nowMs;

    if (!this.burning && this.embers.count === 0 && this.smoke.count === 0) {
      this.flameMesh.count = 0;
      this.emberMesh.count = 0;
      this.smokeMesh.count = 0;
      for (const light of this.lights) light.intensity = 0;
      return;
    }

    // Share the particle budget when a wildfire lights up dozens of blocks.
    const capacity =
      FIRE_LOOK.maxFlames / Math.max(1, this.sources.length * FIRE_LOOK.flamesPerSecond * 1.0);
    const rate = Math.min(1, capacity);

    for (const s of this.sources) {
      s.flameDebt += FIRE_LOOK.flamesPerSecond * rate * (0.7 + s.strength * 0.15) * dt;
      s.emberDebt += FIRE_LOOK.embersPerSecond * rate * dt;
      s.smokeDebt += FIRE_LOOK.smokePerSecond * rate * dt;

      while (s.flameDebt >= 1) {
        s.flameDebt -= 1;
        this.spawnFlame(s);
      }

      while (s.emberDebt >= 1) {
        s.emberDebt -= 1;
        this.spawnEmber(s);
      }

      while (s.smokeDebt >= 1) {
        s.smokeDebt -= 1;
        this.spawnSmoke(s);
      }
    }

    this.stepFlames(dt);
    this.stepEmbers(dt, nowMs);
    this.stepSmoke(dt);

    const flicker = 0.85 + 0.1 * Math.sin(nowMs * 0.017) + 0.05 * Math.sin(nowMs * 0.041);

    this.flicker.value = flicker;

    for (const light of this.lights) {
      const base = (light.userData['base'] as number | undefined) ?? 0;

      light.intensity = this.sources.length > 0 ? base * flicker : 0;
    }
  }

  private spawnFlame(s: Source): void {
    const i = this.flames.add();

    if (i < 0) return;

    const f = this.flames;
    const spread = 0.9 + s.strength * 0.25;

    f.x[i] = s.x + (this.random() - 0.5) * spread;
    f.z[i] = s.z + (this.random() - 0.5) * spread;
    f.y[i] = s.y + this.random() * 0.2;
    f.cx[i] = s.x;
    f.cz[i] = s.z;
    f.vx[i] = (this.random() - 0.5) * 0.3;
    f.vz[i] = (this.random() - 0.5) * 0.3;
    f.vy[i] = 2.2 + this.random() * 1.4 + s.strength * 0.4;
    f.age[i] = 0;
    f.life[i] = 0.7 + this.random() * 0.55 + s.strength * 0.1;
    f.size[i] = (0.7 + this.random() * 0.55) * (0.85 + s.strength * 0.2);
    f.spin[i] = this.random() * Math.PI * 2;
  }

  private spawnEmber(s: Source): void {
    const i = this.embers.add();

    if (i < 0) return;

    const e = this.embers;

    e.x[i] = s.x + (this.random() - 0.5) * 1.2;
    e.z[i] = s.z + (this.random() - 0.5) * 1.2;
    e.y[i] = s.y + 1 + this.random();
    e.vx[i] = (this.random() - 0.5) * 1.2;
    e.vz[i] = (this.random() - 0.5) * 1.2;
    e.vy[i] = 2.5 + this.random() * 2.5;
    e.age[i] = 0;
    e.life[i] = 1.2 + this.random() * 1.4;
    e.size[i] = 0.1 + this.random() * 0.1;
    e.spin[i] = this.random() * 10;
  }

  private spawnSmoke(s: Source): void {
    const i = this.smoke.add();

    if (i < 0) return;

    const k = this.smoke;

    k.x[i] = s.x + (this.random() - 0.5);
    k.z[i] = s.z + (this.random() - 0.5);
    k.y[i] = s.y + 2 + s.strength * 0.5;
    k.vx[i] = 0.6 + this.random() * 0.4;
    k.vz[i] = (this.random() - 0.5) * 0.4;
    k.vy[i] = 1 + this.random() * 0.6;
    k.age[i] = 0;
    k.life[i] = 2.2 + this.random() * 1.5;
    k.size[i] = 0.6 + this.random() * 0.5;
    k.spin[i] = this.random() * Math.PI;
  }

  private place(
    mesh: InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    size: number,
    spin: number,
  ): void {
    this.q.setFromAxisAngle(this.axis, spin);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.setScalar(Math.max(0.001, size)));
    mesh.setMatrixAt(index, this.m);
  }

  private stepFlames(dt: number): void {
    const f = this.flames;

    for (let i = 0; i < f.count;) {
      f.age[i]! += dt;

      const t = f.age[i]! / f.life[i]!;

      if (t >= 1) {
        f.remove(i);
        continue;
      }

      // Rise, and narrow toward the source as it climbs: a flame's shape.
      f.x[i]! += (f.vx[i]! + (f.cx[i]! - f.x[i]!) * 1.6) * dt;
      f.z[i]! += (f.vz[i]! + (f.cz[i]! - f.z[i]!) * 1.6) * dt;
      f.y[i]! += f.vy[i]! * dt;
      f.spin[i]! += dt * 1.5;

      const swell = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) * 0.95;

      this.place(this.flameMesh, i, f.x[i]!, f.y[i]!, f.z[i]!, f.size[i]! * swell, f.spin[i]!);
      this.flameMesh.setColorAt(i, ramp(t, this.c));
      i++;
    }

    this.flameMesh.count = f.count;
    this.flameMesh.instanceMatrix.needsUpdate = true;
    if (this.flameMesh.instanceColor) this.flameMesh.instanceColor.needsUpdate = true;
  }

  private stepEmbers(dt: number, nowMs: number): void {
    const e = this.embers;

    for (let i = 0; i < e.count;) {
      e.age[i]! += dt;

      const t = e.age[i]! / e.life[i]!;

      if (t >= 1) {
        e.remove(i);
        continue;
      }

      e.x[i]! += (e.vx[i]! + Math.sin(nowMs * 0.003 + e.spin[i]!) * 0.6) * dt;
      e.z[i]! += e.vz[i]! * dt;
      e.y[i]! += e.vy[i]! * dt;

      const wink = 0.6 + 0.4 * Math.sin(nowMs * 0.02 + e.spin[i]! * 5);

      this.place(
        this.emberMesh,
        i,
        e.x[i]!,
        e.y[i]!,
        e.z[i]!,
        e.size[i]! * (1 - t * 0.6),
        e.spin[i]!,
      );
      this.emberMesh.setColorAt(i, this.c.setRGB(3.2 * wink * (1 - t), 1.5 * wink * (1 - t), 0.3));
      i++;
    }

    this.emberMesh.count = e.count;
    this.emberMesh.instanceMatrix.needsUpdate = true;
    if (this.emberMesh.instanceColor) this.emberMesh.instanceColor.needsUpdate = true;
  }

  private stepSmoke(dt: number): void {
    const k = this.smoke;

    for (let i = 0; i < k.count;) {
      k.age[i]! += dt;

      const t = k.age[i]! / k.life[i]!;

      if (t >= 1) {
        k.remove(i);
        continue;
      }

      k.x[i]! += k.vx[i]! * dt;
      k.z[i]! += k.vz[i]! * dt;
      k.y[i]! += k.vy[i]! * dt;

      const grey = 0.32 - t * 0.12;

      this.place(
        this.smokeMesh,
        i,
        k.x[i]!,
        k.y[i]!,
        k.z[i]!,
        k.size[i]! * (1 + t * 1.8),
        k.spin[i]!,
      );
      this.smokeMesh.setColorAt(i, this.c.setRGB(grey, grey * 0.95, grey * 0.9));
      i++;
    }

    this.smokeMesh.count = k.count;
    this.smokeMesh.instanceMatrix.needsUpdate = true;
    if (this.smokeMesh.instanceColor) this.smokeMesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.flameMesh, this.emberMesh, this.smokeMesh, this.glowMesh]) {
      mesh.geometry.dispose();
      (mesh.material as Material).dispose();
    }
  }
}
