/**
 * Wisps (§6.5): the smoke that hangs around a babi ngepet. In the stories the
 * thing arrives in a haze and leaves in one, so smoke is how you know the pig
 * crossing your land is not a pig.
 *
 * One instanced mesh, a fixed column of puffs per point, stepped on the CPU
 * the way `Sparkles` is. The caller hands in the points every frame, and each
 * puff rises, spreads and fades on its own loop.
 */

import { InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three/webgpu';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** Puffs per point, and how many points can smoke at once. */
const PER_POINT = 10;
const MAX_POINTS = 6;
const MAX = PER_POINT * MAX_POINTS;

/** How long a puff takes to climb, how far it gets, and how wide it drifts. */
const RISE_SECONDS = 2.8;
const RISE = 1.9;
const DRIFT = 0.7;
/** How far round the mob the puffs start. */
const SPREAD = 0.4;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _axis = new Vector3(0.2, 1, 0.3).normalize();

export interface WispPoint {
  x: number;
  y: number;
  z: number;
}

export class Wisps {
  readonly mesh: InstancedMesh;

  constructor(material: Material) {
    const geometry = new BoxBuilder()
      .addAABox(0, 0, 0, 0.85, 0.85, 0.85, { side: Palette.Smoke })
      .build();
    this.mesh = new InstancedMesh(geometry, material, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** Smoke over each point. Time is the wall clock, so it keeps rising. */
  update(points: readonly WispPoint[], nowMs: number): void {
    const count = Math.min(points.length, MAX_POINTS);
    this.mesh.count = count * PER_POINT;
    if (count === 0) return;
    const time = nowMs / 1000;

    let i = 0;
    for (let p = 0; p < count; p++) {
      const point = points[p]!;
      for (let g = 0; g < PER_POINT; g++) {
        // Each puff runs the same climb, offset so they leave in a stream.
        const offset = g / PER_POINT;
        const t = (time / RISE_SECONDS + offset) % 1;
        const angle = offset * Math.PI * 2 + t * 1.2;
        const radius = SPREAD + t * DRIFT;
        _p.set(
          point.x + Math.cos(angle) * radius,
          point.y + 0.35 + t * RISE,
          point.z + Math.sin(angle) * radius,
        );
        _q.setFromAxisAngle(_axis, angle + time * 0.4);
        // Nothing here can fade on its own, so a puff swells out of nothing
        // and shrinks back into it: at the ends of the climb it is not there.
        _s.setScalar(0.25 + Math.sin(t * Math.PI) * 0.95);
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
