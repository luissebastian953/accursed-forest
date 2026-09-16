/**
 * The mob rig (POC).
 *
 * A mob is a tree of box parts — body, head, legs, tail — each with a pivot
 * and a role. `pose()` is the whole animation system: it reads the clock, the
 * mob's phase and how fast it is moving, and returns a local transform per
 * part. A walk is legs swinging out of phase, a body bobbing on the step, a
 * head that sways and a tail that wags.
 *
 * Nothing here touches the scene graph, so the same rig drives both ways of
 * drawing a crowd:
 *
 *   - `MobNodes`: one `Object3D` per part, three.js composes the matrices.
 *   - `MobInstances`: one `InstancedMesh` per part, matrices composed here.
 *
 * `MobField` measures the two against each other; see `app/MobPoc.ts`.
 */

import type { Matrix4 } from 'three';
import { Euler, Quaternion, Vector3, type BufferGeometry } from 'three';

import { BoxBuilder } from '../geometry/boxBuilder.ts';

/** What a part does when the mob moves. */
export type PartRole =
  | 'body'
  | 'head'
  | 'legFL'
  | 'legFR'
  | 'legBL'
  | 'legBR'
  | 'armL'
  | 'armR'
  | 'tail'
  | 'ear'
  | 'prop'
  | 'still';

export interface PartSpec {
  name: string;
  /** Parent part; the first part has none and is the mob's root. */
  parent?: string;
  /** Offset from the parent's pivot, in mob units. */
  at: [x: number, y: number, z: number];
  size: [w: number, h: number, d: number];
  slot: number;
  role?: PartRole;
  /** Where the box hangs off its pivot. Legs and arms swing from the top. */
  pivot?: 'centre' | 'top' | 'bottom';
  /** Resting rotation, radians. */
  tilt?: [x: number, y: number, z: number];
}

export interface SpeciesSpec {
  id: string;
  label: string;
  parts: PartSpec[];
  /** World units per second at a walk. */
  speed: number;
  /** How far the legs swing, radians. */
  swing: number;
  /** How far the body rises on each step. */
  bob: number;
  /** Steps per second at full speed. */
  cadence: number;
  /** Floats instead of walking, and draws see-through. */
  spectral?: boolean;
  /** Stands and walks on two feet. */
  biped?: boolean;
}

/** Everything `pose` needs to know about the mob this frame. */
export interface PoseInput {
  /** Seconds since the mob spawned. */
  time: number;
  /** 0 standing, 1 walking flat out. */
  gait: number;
  /** Per-mob offset so a herd does not march in step. */
  phase: number;
  /** 0 on all fours, 1 reared up on the hind legs (the babi ngepet's trick). */
  stand?: number;
}

const LEG_PHASE: Partial<Record<PartRole, number>> = {
  legFL: 0,
  legBR: 0,
  legFR: Math.PI,
  legBL: Math.PI,
  armL: Math.PI,
  armR: 0,
};

const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3(1, 1, 1);

/** The local transform of one part this frame. Written into `out`. */
export function pose(spec: SpeciesSpec, part: PartSpec, input: PoseInput, out: Matrix4): Matrix4 {
  const [x, y, z] = part.at;
  const [tx, ty, tz] = part.tilt ?? [0, 0, 0];
  const step = input.time * spec.cadence * Math.PI * 2 + input.phase;
  const px = x;
  let py = y;
  let pz = z;
  let rx = tx;
  let ry = ty;
  const rz = tz;

  const stand = input.stand ?? 0;

  switch (part.role) {
    case 'body':
      // The body rises on the step, and leans into a run.
      py += Math.abs(Math.sin(step)) * spec.bob * input.gait;
      rx += Math.sin(step * 2) * 0.04 * input.gait;
      if (spec.spectral) py += Math.sin(input.time * 1.6 + input.phase) * 0.12;
      // Reared up: the barrel pitches back and lifts, the hind legs carry it.
      if (stand > 0) {
        rx -= stand * 1.25;
        py += stand * part.size[2] * 0.45;
        pz -= stand * part.size[2] * 0.25;
      }
      break;
    case 'head':
      ry += Math.sin(input.time * 0.7 + input.phase) * 0.35 * (1 - input.gait * 0.6);
      rx += Math.sin(step) * 0.05 * input.gait;
      break;
    case 'tail':
      ry += Math.sin(step * 1.5) * 0.5 * (0.35 + input.gait);
      break;
    case 'ear':
      rx += Math.sin(step * 2 + 1) * 0.25 * input.gait;
      break;
    case 'legFL':
    case 'legFR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait;
      // Standing, the forelegs hang like arms and swing against the stride.
      rx += stand * 0.9;
      break;
    case 'legBL':
    case 'legBR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait;
      // ...and the hind legs straighten under the body.
      rx += stand * 1.25;
      break;
    case 'armL':
    case 'armR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait;
      break;
    case 'prop':
      py += Math.sin(step + 0.5) * 0.04 * input.gait;
      break;
    default:
      break;
  }

  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return out.compose(_v.set(px, py, pz), _q, _s);
}

/** A part's box, built so the pivot sits where the part swings from. */
export function partGeometry(part: PartSpec): BufferGeometry {
  const [w, h, d] = part.size;
  const pivot = part.pivot ?? 'centre';
  const cy = pivot === 'top' ? -h / 2 : pivot === 'bottom' ? h / 2 : 0;
  return new BoxBuilder().addAABox(0, cy, 0, w, h, d, { side: part.slot }).build();
}

/** Parts in parent-before-child order, with each parent's index. */
export function partOrder(spec: SpeciesSpec): { part: PartSpec; parent: number }[] {
  const index = new Map<string, number>();
  spec.parts.forEach((part, i) => index.set(part.name, i));
  return spec.parts.map((part) => ({
    part,
    parent: part.parent === undefined ? -1 : (index.get(part.parent) ?? -1),
  }));
}

/** Triangles one mob of this species costs. */
export function triangleCount(spec: SpeciesSpec): number {
  return spec.parts.length * 12;
}
