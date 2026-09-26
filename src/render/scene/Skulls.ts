import {
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Camera,
  type Material,
} from 'three/webgpu';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

/** How many can rise at once; a wildfire tick can take several animals. */
const MAX = 12;
/** How long a skull takes to climb, how far it gets, and how big it grows on the way. */
const RISE_SECONDS = 3.4;
const RISE = 7.5;
const SCALE_FROM = 1.3;
const SCALE_TO = 3.2;
/** How far it sways side to side as it climbs. */
const SWAY = 0.9;

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _dir = new Vector3();
const _up = new Vector3(0, 1, 0);

interface Skull {
  x: number;
  y: number;
  z: number;
  /** Seconds since it rose. */
  age: number;
  /** Which way it leans first, so two skulls do not sway in step. */
  sign: number;
}

/** One skull, about a unit across, facing +Z: bone with the sockets and the nose cut dark. */
function skullGeometry(): BoxBuilder {
  const b = new BoxBuilder();
  const bone = { side: Palette.Bone };
  const dark = { side: Palette.Cave };

  // The cranium, and the jaw set forward and under it.
  b.addAABox(0, 0.18, 0, 1, 0.84, 0.92, bone);
  b.addAABox(0, -0.36, 0.14, 0.62, 0.36, 0.56, bone);
  // Sockets, nose, and the gap between the teeth, just proud of the face.
  for (const side of [-1, 1]) b.addAABox(side * 0.23, 0.14, 0.47, 0.27, 0.3, 0.06, dark);
  b.addAABox(0, -0.14, 0.47, 0.13, 0.17, 0.06, dark);
  b.addAABox(0, -0.46, 0.43, 0.5, 0.05, 0.05, dark);
  // Teeth: a row of small pale blocks under the gap.
  for (const x of [-0.18, -0.06, 0.06, 0.18]) b.addAABox(x, -0.51, 0.44, 0.09, 0.08, 0.05, bone);
  return b;
}

/**
 * What a burn does to whatever was standing in it (GDD 6.5): a translucent
 * skull rises from where the animal died, swelling as it climbs, then is gone.
 */
export class Skulls {
  readonly mesh: InstancedMesh;
  private readonly skulls: Skull[] = [];

  constructor(material: Material) {
    this.mesh = new InstancedMesh(skullGeometry().build(), material, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** Skulls in the air right now. */
  get count(): number {
    return this.skulls.length;
  }

  /** Raise one from a point on the ground. */
  raise(x: number, y: number, z: number): void {
    if (this.skulls.length >= MAX) this.skulls.shift();
    this.skulls.push({ x, y, z, age: 0, sign: this.skulls.length % 2 === 0 ? 1 : -1 });
  }

  /** Step every skull; `camera` is what each one turns its face toward. */
  update(dtSeconds: number, camera: Camera): void {
    for (const skull of this.skulls) skull.age += dtSeconds;

    let i = 0;

    while (i < this.skulls.length) {
      if (this.skulls[i]!.age >= RISE_SECONDS) this.skulls.splice(i, 1);
      else i += 1;
    }

    this.mesh.count = this.skulls.length;
    if (this.skulls.length === 0) return;

    camera.getWorldDirection(_dir);

    // Face the camera: the sockets are the whole point, and a skull seen
    // from behind is a pale box.
    const yaw = Math.atan2(-_dir.x, -_dir.z);

    for (let n = 0; n < this.skulls.length; n++) {
      const skull = this.skulls[n]!;
      const t = Math.min(1, skull.age / RISE_SECONDS);
      // Fast off the ground, slowing as it goes, and shrinking away at the top.
      const climb = 1 - (1 - t) * (1 - t);
      const size = (SCALE_FROM + (SCALE_TO - SCALE_FROM) * t) * (t > 0.85 ? (1 - t) / 0.15 : 1);

      _p.set(
        skull.x + Math.sin(t * Math.PI * 2.5) * SWAY * skull.sign,
        skull.y + 0.6 + climb * RISE,
        skull.z,
      );
      _q.setFromAxisAngle(_up, yaw + Math.sin(t * Math.PI * 3) * 0.25 * skull.sign);
      _s.setScalar(size);
      this.mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.skulls.length = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
