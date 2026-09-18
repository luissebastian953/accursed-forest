/**
 * Rain (§6.1): streaks falling over the part of the world in view, as thick
 * as the day's rain. One instanced mesh; positions are stepped on the CPU;
 * a couple of thousand drops is nothing next to the terrain.
 */

import { InstancedMesh, Matrix4, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { SKY } from '@sim/balance/seasons';
import type { SkyCondition } from '@sim/types';

import type { GroundRect } from '../camera/MapRig.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

const MAX_DROPS = 2400;
/**
 * The thinnest shower that still draws, so the first day the sky says rain
 * has something falling in it rather than nothing.
 */
const DRIZZLE = 0.3;
const TOP = 34;
const SPEED = 55;
/** Wind pushes the streaks a little sideways. */
const DRIFT_X = 6;
/** How fast the shower thickens or thins, per second. */
const EASE = 0.8;

export class Rain {
  readonly mesh: InstancedMesh;
  private readonly x = new Float32Array(MAX_DROPS);
  private readonly y = new Float32Array(MAX_DROPS);
  private readonly z = new Float32Array(MAX_DROPS);
  private intensity = 0;
  private seed = 1;
  private readonly m = new Matrix4();

  constructor(material: Material) {
    const geometry = new BoxBuilder()
      .addAABox(0, 0, 0, 0.06, 1.1, 0.06, { side: Palette.Rain })
      .build();
    this.mesh = new InstancedMesh(geometry, material, MAX_DROPS);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < MAX_DROPS; i++) this.y[i] = this.random() * TOP;
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /**
   * @param rain  today's rain, 0..1
   * @param sky  what the day is called (§3.6); only rain and storms fall
   * @param view  the ground in view; drops respawn over it
   * @param running  false while paused: the drops hang where they are
   */
  update(
    dtSeconds: number,
    rain: number,
    sky: SkyCondition,
    view: GroundRect,
    running: boolean,
  ): void {
    // The sky decides, not the number behind it: a damp day the HUD calls
    // cloudy must not have rain falling on it. Past that, the shower thickens
    // with the day's rain.
    const wet = sky === 'rain' || sky === 'storm';
    const target = wet
      ? DRIZZLE + (1 - DRIZZLE) * clamp01((rain - SKY.rainAbove) / (1 - SKY.rainAbove))
      : 0;
    const step = Math.min(1, EASE * dtSeconds);
    this.intensity += (target - this.intensity) * step;
    const count = Math.floor(MAX_DROPS * this.intensity);
    this.mesh.count = count;
    if (count === 0) return;

    const w = view.maxX - view.minX;
    const d = view.maxZ - view.minZ;
    const fall = running ? SPEED * dtSeconds : 0;
    const drift = running ? DRIFT_X * dtSeconds : 0;
    for (let i = 0; i < count; i++) {
      let x = this.x[i]! + drift;
      let y = this.y[i]! - fall;
      let z = this.z[i]!;
      const outside =
        x < view.minX - 4 || x > view.maxX + 4 || z < view.minZ - 4 || z > view.maxZ + 4;
      if (y < -1 || outside || (x === 0 && z === 0)) {
        x = view.minX + this.random() * w;
        z = view.minZ + this.random() * d;
        y = y < -1 ? TOP : this.random() * TOP;
      }
      this.x[i] = x;
      this.y[i] = y;
      this.z[i] = z;
      this.m.makeRotationZ(-0.1).setPosition(x, y, z);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
