import { Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { BlockId } from '@sim/types';
import type { World } from '@sim/worldgen/index';

export class Picker {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);

  constructor(
    private readonly camera: Camera,
    private readonly terrain: Object3D,
    private readonly world: World,
  ) {}

  /** Block under a normalised device coordinate, or null off the map. */
  pickBlock(ndcX: number, ndcY: number): BlockId | null {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const hits = this.raycaster.intersectObject(this.terrain, true);
    let point: Vector3 | null = hits[0]?.point ?? null;

    // Chunks still loading: fall back to the ground plane.
    if (!point) {
      point = this.raycaster.ray.intersectPlane(this.ground, this.hit);
    }

    if (!point) return null;

    const bx = Math.floor(point.x / WORLD.blockSide);
    const by = Math.floor(point.z / WORLD.blockSide);

    if (!this.world.inBounds(bx, by)) return null;
    return this.world.toId(bx, by);
  }
}
