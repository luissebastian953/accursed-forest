/**
 * Sparkles (§6.5): a few glints turning over something worth a click, so a
 * golden capybara in the grass or a babi ngepet up on two legs reads as
 * "this one, now" rather than as scenery.
 *
 * One instanced mesh, a fixed ring of glints per point, stepped on the CPU.
 * The caller hands in the points every frame; nothing is kept between them.
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
