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
  | 'zzz'
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
  /** Drawn solid even on a see-through body: a ghost's eyes, a pocong's face. */
  opaque?: boolean;
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
  /** See-through, but barely: a body rather than an apparition. */
  dense?: boolean;
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
  /** 0 up, 1 lying on its side asleep. */
  sleep?: number;
  /** 0 upright, 1 crouched low (the thief in the trees and on the dash). */
  crouch?: number;
  /** 0 hands down, 1 swinging an axe or a torch at the block. */
  work?: number;
  /** 0 on all fours, 1 sitting up on the haunches. */
  sit?: number;
  /** 0 on the ground, 1 clinging to a trunk. The lift itself is the field's. */
  climb?: number;
}

/** The chop cycle: a slow lift, a fast drop, 0..1 raised. */
function chopLift(time: number, phase: number): number {
  const w = (((time * 1.1 + phase) % 1) + 1) % 1;

  return w < 0.7
    ? (1 - Math.cos((w / 0.7) * Math.PI)) / 2
    : (1 + Math.cos(((w - 0.7) / 0.3) * Math.PI)) / 2;
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

  const stand = input.stand ?? 0;
  const sleep = input.sleep ?? 0;
  const crouch = input.crouch ?? 0;
  const work = input.work ?? 0;
  const sit = input.sit ?? 0;
  const climb = input.climb ?? 0;
  const breath = Math.sin(input.time * 1.3 + input.phase);
  let rz = tz;

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

      // Asleep: rolled onto one side on the ground, the flank rising with each breath.
      if (sleep > 0) {
        rz += sleep * 1.45;
        py += sleep * (part.size[0] / 2 + 0.02 - y) + sleep * breath * 0.015;
      }

      // Crouched: sunk at the knees and bent forward.
      if (crouch > 0) {
        py -= crouch * part.size[1] * 0.45;
        rx += crouch * 0.55;
      }

      // Work swings the arms only: a pitching body read as falling over. Sitting: on four
      // legs up on the haunches, back sloped; on two down on the ground, hips dropped.
      if (sit > 0) {
        if (spec.biped) {
          py -= sit * Math.max(0, y - part.size[1] * 0.75);
          rx -= sit * 0.12;
        } else {
          rx -= sit * 0.55;
          py -= sit * part.size[1] * 0.12;
          pz -= sit * part.size[2] * 0.1;
        }
      }

      // Up a trunk: head up, belly to the bark, swaying with the tree. An ape
      // climbs upright, so it leans in rather than lying along the bark.
      if (climb > 0) {
        rx -= climb * (spec.biped ? 0.3 : 1.15);
        py += climb * part.size[2] * 0.3;
        rz += climb * Math.sin(input.time * 0.9 + input.phase) * 0.06;
      }

      break;
    case 'head':
      ry += Math.sin(input.time * 0.7 + input.phase) * 0.35 * (1 - input.gait * 0.6);
      rx += Math.sin(step) * 0.05 * input.gait;
      // Asleep the head rests down; crouched it looks up from under the brim;
      // climbing it comes back up to look along the trunk.
      rx += sleep * 0.4 - crouch * 0.35 - climb * 0.75 + sit * 0.3;
      break;
    case 'tail':
      ry += Math.sin(step * 1.5) * 0.5 * (0.35 + input.gait) * (1 - sleep);
      // Hooked round the trunk, or curled along the ground behind a sitter.
      rx += climb * 0.7 + sit * 0.4;
      break;
    case 'ear':
      rx += Math.sin(step * 2 + 1) * 0.25 * input.gait;
      break;
    case 'legFL':
    case 'legFR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait;
      // Standing, the forelegs hang like arms and swing against the stride.
      rx += stand * 0.9;
      // Asleep the legs tuck in; crouched (a biped's legs) they fold.
      rx += sleep * 1.3 - crouch * 0.9;

      if (spec.biped) {
        // These are the only legs there are: they fold out in front to sit,
        // and tuck up under the body on a trunk.
        rx -= sit * 1.2;
        rx += climb * 0.55;
        rz += (part.role === 'legFL' ? -1 : 1) * climb * 0.28;
      } else {
        // Sitting, the forelegs prop the chest; climbing, they reach round the trunk.
        rx -= sit * 0.5;
        rx -= climb * 1.5;
        rz += (part.role === 'legFL' ? -1 : 1) * climb * 0.35;
      }

      break;
    case 'legBL':
    case 'legBR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait;
      // ...and the hind legs straighten under the body.
      rx += stand * 1.25 + sleep * 1.3;
      // Sitting, they fold under; climbing, they grip lower down the trunk.
      rx += sit * 1.3 + climb * 0.9;
      rz += (part.role === 'legBL' ? -1 : 1) * climb * 0.3;
      break;
    case 'armL':
    case 'armR':
      rx += Math.sin(step + (LEG_PHASE[part.role] ?? 0)) * spec.swing * input.gait * (1 - work);
      // Crouched, the arms come forward to steady; working, both swing the tool.
      rx -= crouch * 0.6;
      // Climbing, the arms reach overhead and round the bark; asleep, they tuck in. Sitting,
      // an ape's arms outreach the drop to the ground, so they come forward, not through it.
      rx -= climb * 2.05;
      rx -= sit * (spec.biped ? 0.5 : 0.4);
      rx -= sleep * 0.35;
      rz += (part.role === 'armL' ? -1 : 1) * (climb * 0.3 + (spec.biped ? sit * 0.14 : 0));

      if (work > 0) {
        const lift = chopLift(input.time, input.phase);

        rx -= work * (0.5 + lift * 2.1) * (part.role === 'armR' ? 1 : 0.85);
      }

      break;
    case 'prop':
      py += Math.sin(step + 0.5) * 0.04 * input.gait;
      break;
    case 'zzz':
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
