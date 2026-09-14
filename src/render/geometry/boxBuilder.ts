/**
 * Everything in this game is boxes arranged well (§6.1, §6.3).
 *
 * `BoxBuilder` accumulates non-indexed triangles so flat shading is free, and
 * tags every vertex with a `paletteU` instead of a UV (§6.4). Geometry is built
 * once at startup and merged; nothing here runs per frame.
 */

import { BufferGeometry, Float32BufferAttribute, Matrix3, Matrix4, Vector3 } from 'three';

import { paletteU, type PaletteSlot } from '../materials/paletteSlots.ts';

/** Per-face palette slots. `side` fills in for any face left unspecified. */
export interface BoxFaces {
  side: PaletteSlot | number;
  top?: PaletteSlot | number;
  bottom?: PaletteSlot | number;
}

type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';

/** Unit cube centred on the origin: 4 corners per face, CCW seen from outside. */
const FACE_CORNERS: Record<FaceKey, readonly [number, number, number][]> = {
  px: [
    [0.5, -0.5, 0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [0.5, 0.5, 0.5],
  ],
  nx: [
    [-0.5, -0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [-0.5, 0.5, 0.5],
    [-0.5, 0.5, -0.5],
  ],
  py: [
    [-0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
  ],
  ny: [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, -0.5, 0.5],
    [-0.5, -0.5, 0.5],
  ],
  pz: [
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ],
  nz: [
    [0.5, -0.5, -0.5],
    [-0.5, -0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [0.5, 0.5, -0.5],
  ],
};

const FACE_NORMALS: Record<FaceKey, readonly [number, number, number]> = {
  px: [1, 0, 0],
  nx: [-1, 0, 0],
  py: [0, 1, 0],
  ny: [0, -1, 0],
  pz: [0, 0, 1],
  nz: [0, 0, -1],
};

const ALL_FACES: readonly FaceKey[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

const _v = new Vector3();
const _n = new Vector3();

export class BoxBuilder {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly us: number[] = [];

  /** Triangle count so far — useful for asserting mesher budgets (§6.7). */
  get triangleCount(): number {
    return this.positions.length / 9;
  }

  /**
   * Append a box.
   *
   * @param matrix  places the unit cube (centre origin, size 1) in local space
   * @param faces   palette slot per face
   * @param skip    faces to omit — the column mesher culls faces that abut a
   *                taller neighbour, which is most of them at estate scale
   */
  addBox(matrix: Matrix4, faces: BoxFaces, skip?: Partial<Record<FaceKey, boolean>>): this {
    const normalMatrix = _normalBasis(matrix);

    for (const face of ALL_FACES) {
      if (skip?.[face]) continue;

      const slot =
        face === 'py'
          ? (faces.top ?? faces.side)
          : face === 'ny'
            ? (faces.bottom ?? faces.side)
            : faces.side;
      const u = paletteU(slot);

      const [nx, ny, nz] = FACE_NORMALS[face];
      _n.set(nx, ny, nz).applyMatrix3(normalMatrix).normalize();

      const corners = FACE_CORNERS[face];
      // two triangles: 0-1-2, 0-2-3
      for (const [a, b, c] of [
        [0, 1, 2],
        [0, 2, 3],
      ] as const) {
        for (const index of [a, b, c]) {
          const corner = corners[index]!;
          _v.set(corner[0], corner[1], corner[2]).applyMatrix4(matrix);
          this.positions.push(_v.x, _v.y, _v.z);
          this.normals.push(_n.x, _n.y, _n.z);
          this.us.push(u);
        }
      }
    }

    return this;
  }

  /** Convenience for an axis-aligned box given centre and size. */
  addAABox(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    faces: BoxFaces,
    skip?: Partial<Record<FaceKey, boolean>>,
  ): this {
    const m = new Matrix4().makeScale(sx, sy, sz).setPosition(cx, cy, cz);
    return this.addBox(m, faces, skip);
  }

  /**
   * Raw attribute arrays, for shipping out of a worker as transferables.
   * `build()` is this plus a `BufferGeometry` wrapper.
   */
  toArrays(): MeshArrays {
    return {
      positions: Float32Array.from(this.positions),
      normals: Float32Array.from(this.normals),
      paletteU: Float32Array.from(this.us),
      triangles: this.triangleCount,
    };
  }

  build(): BufferGeometry {
    return geometryFromArrays(this.toArrays());
  }
}

export interface MeshArrays {
  positions: Float32Array;
  normals: Float32Array;
  paletteU: Float32Array;
  triangles: number;
}

/** Wrap mesher output in a geometry. The arrays are adopted, not copied. */
export function geometryFromArrays(arrays: MeshArrays): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(arrays.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(arrays.normals, 3));
  geometry.setAttribute('paletteU', new Float32BufferAttribute(arrays.paletteU, 1));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

const _normal = new Matrix3();
function _normalBasis(matrix: Matrix4): Matrix3 {
  return _normal.setFromMatrix4(matrix).invert().transpose();
}
