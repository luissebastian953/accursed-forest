import { MapControls } from 'three/addons/controls/MapControls.js';
import { OrthographicCamera, Vector3 } from 'three/webgpu';

import { clamp, lerp } from '@shared/math';

import { DURATION, easeOutCubic } from '../anim/easing.ts';

/** A rectangle on the ground plane, in world units. */
export interface GroundRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapRigOptions {
  domElement: HTMLElement;
  /** World extent in world units; the target is clamped to it plus a margin. */
  bounds: GroundRect;
  /** Vertical world units visible at zoom 1. */
  baseFrustum?: number;
  minZoom?: number;
  maxZoom?: number;
}

const PITCH = (35 * Math.PI) / 180;
const CAMERA_DISTANCE = 120;
const BOUNDS_MARGIN = 24;
const DIAGONALS = 4;

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
}

export class MapRig {
  readonly camera: OrthographicCamera;
  private readonly controls: MapControls;
  private readonly bounds: GroundRect;
  private readonly baseFrustum: number;
  private aspect = 16 / 9;

  /** Azimuth index 0..3, each a diagonal. */
  private diagonal = 0;
  private azimuth = Math.PI / 4;
  private azimuthTween: Tween | null = null;
  private focusTween: { from: Vector3; to: Vector3; start: number; duration: number } | null = null;
  private zoomTween: Tween | null = null;

  private readonly direction = new Vector3();
  private readonly corner = new Vector3();

  constructor(options: MapRigOptions) {
    this.bounds = options.bounds;
    this.baseFrustum = options.baseFrustum ?? 110;

    this.camera = new OrthographicCamera();
    this.camera.near = 0.1;
    this.camera.far = CAMERA_DISTANCE * 3;
    this.camera.zoom = 1;

    this.controls = new MapControls(this.camera, options.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.screenSpacePanning = false;
    this.controls.enableRotate = false;
    this.controls.minZoom = options.minZoom ?? 0.6;
    this.controls.maxZoom = options.maxZoom ?? 6;
    this.controls.zoomToCursor = true;

    this.applyFrustum();
    this.place();
  }

  get target(): Vector3 {
    return this.controls.target;
  }

  /** Vertical world units currently visible. */
  get frustumSize(): number {
    return this.baseFrustum / this.camera.zoom;
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.applyFrustum();
  }

  jumpTo(x: number, z: number): void {
    this.focusTween = null;
    this.controls.target.set(x, 0, z);
    this.place();
  }

  /** Ease the view to a ground point (GDD 6.5: camera never overshoots). */
  focus(x: number, z: number, nowMs: number, durationMs = DURATION.cameraFocus): void {
    this.focusTween = {
      from: this.controls.target.clone(),
      to: new Vector3(x, 0, z),
      start: nowMs,
      duration: durationMs,
    };
  }

  /** Set the zoom now (orthographic: bigger is closer). */
  setZoom(zoom: number): void {
    this.zoomTween = null;
    this.camera.zoom = clamp(zoom, this.controls.minZoom, this.controls.maxZoom);
    this.applyFrustum();
  }

  /** Ease the zoom to a level: the title screen's pull-in onto the estate. */
  zoomTo(zoom: number, nowMs: number, durationMs: number = DURATION.cameraFocus): void {
    this.zoomTween = {
      from: this.camera.zoom,
      to: clamp(zoom, this.controls.minZoom, this.controls.maxZoom),
      start: nowMs,
      duration: durationMs,
    };
  }

  /** Snap-rotate a quarter turn (GDD 6.2: four diagonals). */
  rotate(direction: 1 | -1, nowMs: number): void {
    this.diagonal = (this.diagonal + direction + DIAGONALS) % DIAGONALS;
    const to = Math.PI / 4 + (this.diagonal * Math.PI) / 2;
    // Take the short way round.
    let from = this.azimuth;
    while (to - from > Math.PI) from += Math.PI * 2;
    while (from - to > Math.PI) from -= Math.PI * 2;
    this.azimuthTween = { from, to, start: nowMs, duration: DURATION.cameraFocus };
  }

  update(_dtSeconds: number, nowMs: number): void {
    if (this.focusTween) {
      const t = clamp((nowMs - this.focusTween.start) / this.focusTween.duration, 0, 1);
      this.controls.target.lerpVectors(this.focusTween.from, this.focusTween.to, easeOutCubic(t));
      if (t >= 1) this.focusTween = null;
    }
    if (this.azimuthTween) {
      const t = clamp((nowMs - this.azimuthTween.start) / this.azimuthTween.duration, 0, 1);
      this.azimuth = lerp(this.azimuthTween.from, this.azimuthTween.to, easeOutCubic(t));
      if (t >= 1) this.azimuthTween = null;
    }
    if (this.zoomTween) {
      const t = clamp((nowMs - this.zoomTween.start) / this.zoomTween.duration, 0, 1);
      this.camera.zoom = lerp(this.zoomTween.from, this.zoomTween.to, easeOutCubic(t));
      if (t >= 1) this.zoomTween = null;
    }

    this.controls.update();

    // Clamp the pan to the world plus a margin.
    const target = this.controls.target;
    target.x = clamp(target.x, this.bounds.minX - BOUNDS_MARGIN, this.bounds.maxX + BOUNDS_MARGIN);
    target.z = clamp(target.z, this.bounds.minZ - BOUNDS_MARGIN, this.bounds.maxZ + BOUNDS_MARGIN);
    target.y = 0;

    this.applyFrustum();
    this.place();
  }

  /**
   * The ground rectangle the camera can see, for chunk streaming (GDD 6.7).
   * Unprojects the four frustum corners along the view direction to y = 0.
   */
  visibleGround(out: GroundRect): GroundRect {
    this.camera.getWorldDirection(this.direction);
    out.minX = Infinity;
    out.maxX = -Infinity;
    out.minZ = Infinity;
    out.maxZ = -Infinity;

    for (const [nx, ny] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      this.corner.set(nx, ny, -1).unproject(this.camera);
      // Ray from the near-plane corner along the view direction to the ground.
      const t = -this.corner.y / this.direction.y;
      const gx = this.corner.x + this.direction.x * t;
      const gz = this.corner.z + this.direction.z * t;
      out.minX = Math.min(out.minX, gx);
      out.maxX = Math.max(out.maxX, gx);
      out.minZ = Math.min(out.minZ, gz);
      out.maxZ = Math.max(out.maxZ, gz);
    }
    return out;
  }

  dispose(): void {
    this.controls.dispose();
  }

  private applyFrustum(): void {
    const size = this.baseFrustum;
    this.camera.left = (-size * this.aspect) / 2;
    this.camera.right = (size * this.aspect) / 2;
    this.camera.top = size / 2;
    this.camera.bottom = -size / 2;
    this.camera.updateProjectionMatrix();
  }

  private place(): void {
    this.direction.set(
      Math.cos(PITCH) * Math.cos(this.azimuth),
      Math.sin(PITCH),
      Math.cos(PITCH) * Math.sin(this.azimuth),
    );
    this.camera.position
      .copy(this.controls.target)
      .addScaledVector(this.direction, CAMERA_DISTANCE);
    this.camera.lookAt(this.controls.target);
    this.camera.updateMatrixWorld();
  }
}
