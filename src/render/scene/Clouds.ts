/**
 * Clouds (§6.1): small white chunks drifting over the estate, see-through
 * enough that the land reads through them. They are scenery, not weather:
 * the sky's own mood is `Sky.ts`.
 *
 * They drift down and to the left of the screen whichever way the camera is
 * turned, so the direction is taken from the camera each frame rather than
 * fixed in the world. They live on a tile that follows the view and wraps,
 * so a handful of them covers any amount of panning.
 */

import {
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Material,
  type OrthographicCamera,
} from 'three/webgpu';

import type { GroundRect } from '../camera/MapRig.ts';
import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

const COUNT = 18;
/** The tile the clouds wrap around, in world units, and how high they fly. */
const TILE = 320;
const HEIGHT = { min: 52, max: 74 };
/** World units a second. A cloud crosses the view in a couple of minutes. */
const SPEED = 2.4;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _right = new Vector3();
const _forward = new Vector3();
const _drift = new Vector3();
const _up = new Vector3(0, 1, 0);

/** One puffy chunk: a few flattened boxes, offset so it is not a brick. */
function cloudGeometry(): ReturnType<BoxBuilder['build']> {
  const b = new BoxBuilder();
  const puffs: [number, number, number, number, number, number][] = [
    [0, 0, 0, 7.5, 2.2, 5.5],
    [2.6, 0.7, -0.9, 4.6, 1.8, 3.6],
    [-2.9, 0.4, 0.8, 4.2, 1.6, 3.4],
    [0.4, 1.5, 0.3, 3.8, 1.5, 3],
  ];
  for (const [x, y, z, w, h, d] of puffs) {
    b.addAABox(x, y, z, w, h, d, { side: Palette.Cloud, top: Palette.CloudTop });
  }
  return b.build();
}

export class Clouds {
  readonly mesh: InstancedMesh;
  private readonly x = new Float32Array(COUNT);
  private readonly y = new Float32Array(COUNT);
  private readonly z = new Float32Array(COUNT);
  private readonly scale = new Float32Array(COUNT);
  private readonly turn = new Float32Array(COUNT);
  private seed = 1_770_419;

  constructor(material: Material) {
    this.mesh = new InstancedMesh(cloudGeometry(), material, COUNT);
    this.mesh.count = COUNT;
    this.mesh.frustumCulled = false;
    for (let i = 0; i < COUNT; i++) {
      this.x[i] = this.random() * TILE;
      this.z[i] = this.random() * TILE;
      this.y[i] = HEIGHT.min + this.random() * (HEIGHT.max - HEIGHT.min);
      this.scale[i] = 0.9 + this.random() * 1.1;
      this.turn[i] = this.random() * Math.PI * 2;
    }
  }

  private random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /**
   * @param view  the ground in view; the tile keeps itself centred on it
   */
  update(dtSeconds: number, camera: OrthographicCamera, view: GroundRect): void {
    // Down and to the left of the screen: away from the camera's right, and
    // toward the viewer along the ground.
    _right.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
    _forward.setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize();
    _drift
      .copy(_right)
      .negate()
      .addScaledVector(_forward, 1)
      .setY(0)
      .normalize()
      .multiplyScalar(SPEED * dtSeconds);

    const centreX = (view.minX + view.maxX) / 2;
    const centreZ = (view.minZ + view.maxZ) / 2;
    for (let i = 0; i < COUNT; i++) {
      let x = this.x[i]! + _drift.x;
      let z = this.z[i]! + _drift.z;
      // Wrap around the tile that follows the view, so panning never outruns them.
      x = centreX + ((((x - centreX + TILE * 1.5) % TILE) + TILE) % TILE) - TILE / 2;
      z = centreZ + ((((z - centreZ + TILE * 1.5) % TILE) + TILE) % TILE) - TILE / 2;
      this.x[i] = x;
      this.z[i] = z;
      _p.set(x, this.y[i]!, z);
      _q.setFromAxisAngle(_up, this.turn[i]!);
      _s.setScalar(this.scale[i]!);
      this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
