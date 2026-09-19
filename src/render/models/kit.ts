import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

import type { BoxBuilder } from '../geometry/boxBuilder.ts';

export interface Placement {
  x: number;
  /** Ground height at the model's foot. */
  y: number;
  z: number;
  /** Uniform scale; 1 is the model's natural size. */
  scale: number;
  /** Rotation about +Y, radians. */
  turn: number;
}

export type Rand = () => number;

export interface BoxOptions {
  /** Extra rotation about the box's own centre, radians (applied Y, then X, then Z). */
  turn?: number;
  tiltX?: number;
  tiltZ?: number;
  /** A different slot for the top face. */
  top?: number;
  /** Draw the underside too (hanging and tilted boxes show it). */
  bottom?: boolean;
}

export interface Model {
  /** Short name, for the gallery and tests. */
  name: string;
  /** Furthest any part reaches from the foot at scale 1, for keeping it inside its block. */
  radius: number;
  build(kit: ModelKit, rand: Rand): void;
}

const _place = new Matrix4();
const _local = new Matrix4();
const _q = new Quaternion();
const _e = new Euler(0, 0, 0, 'YXZ');
const _p = new Vector3();
const _s = new Vector3();
const SKIP_BOTTOM = { ny: true } as const;

export class ModelKit {
  constructor(private readonly builder: BoxBuilder) {}

  /** Where the next model's boxes go. */
  at(place: Placement): this {
    _e.set(0, place.turn, 0);
    _q.setFromEuler(_e);
    _place.compose(_p.set(place.x, place.y, place.z), _q, _s.setScalar(place.scale));
    return this;
  }

  /**
   * A box whose bottom face centre sits at local (x, y, z), `sx`×`sy`×`sz`
   * big. Tilted boxes pivot about their centre.
   */
  box(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    slot: number,
    options: BoxOptions = {},
  ): this {
    _e.set(options.tiltX ?? 0, options.turn ?? 0, options.tiltZ ?? 0);
    _q.setFromEuler(_e);
    _local.compose(_p.set(x, y + sy / 2, z), _q, _s.set(sx, sy, sz));
    _local.premultiply(_place);
    this.builder.addBox(
      _local,
      options.top === undefined ? { side: slot } : { side: slot, top: options.top },
      options.bottom ? undefined : SKIP_BOTTOM,
    );
    return this;
  }
}

/** A value in [min, max). */
export function between(rand: Rand, min: number, max: number): number {
  return min + (max - min) * rand();
}

/** One of the items. */
export function oneOf<T>(rand: Rand, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length]!;
}
