/**
 * Procedural oil palm (§6.3): a column of tapered boxes with a subtle S-bend
 * for the trunk, and 8-12 flat slabs radiating from the crown, drooping ~30
 * degrees and tapering toward the tip.
 *
 * One generator, four parameter sets = the four growth stages. Scale is
 * 1 world unit = 1 palm slot = ~9 m of real spacing, so a mature palm at
 * ~0.65 units reads as the real 6 m tree next to its neighbours.
 */

import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from 'three';

import { Palette } from '../materials/paletteSlots.ts';

import { BoxBuilder } from './boxBuilder.ts';

export type PalmStage = 'seedling' | 'immature' | 'mature' | 'senile';

export const PALM_STAGES: readonly PalmStage[] = ['seedling', 'immature', 'mature', 'senile'];

interface PalmParams {
  /** Height of the woody trunk in world units. */
  trunkHeight: number;
  trunkRadius: number;
  /** Number of segments the trunk is split into (the S-bend needs a few). */
  trunkSegments: number;
  frondCount: number;
  frondLength: number;
  frondWidth: number;
  /** Downward tilt of the fronds, radians. */
  droop: number;
  frondSlot: number;
  /** Ripe bunches sit under the crown; only mature palms carry them. */
  bunches: number;
}

const PARAMS: Record<PalmStage, PalmParams> = {
  seedling: {
    trunkHeight: 0,
    trunkRadius: 0.035,
    trunkSegments: 1,
    frondCount: 5,
    frondLength: 0.2,
    frondWidth: 0.055,
    droop: 0.32,
    frondSlot: Palette.PalmFrondYoung,
    bunches: 0,
  },
  immature: {
    trunkHeight: 0.3,
    trunkRadius: 0.065,
    trunkSegments: 3,
    frondCount: 8,
    frondLength: 0.34,
    frondWidth: 0.07,
    droop: 0.48,
    frondSlot: Palette.PalmFrondYoung,
    bunches: 0,
  },
  mature: {
    trunkHeight: 0.92,
    trunkRadius: 0.085,
    trunkSegments: 6,
    frondCount: 11,
    frondLength: 0.4,
    frondWidth: 0.075,
    droop: 0.5,
    frondSlot: Palette.PalmFrond,
    bunches: 3,
  },
  senile: {
    trunkHeight: 1.7,
    trunkRadius: 0.075,
    trunkSegments: 10,
    frondCount: 9,
    frondLength: 0.38,
    frondWidth: 0.07,
    droop: 0.6,
    frondSlot: Palette.PalmFrondSenile,
    bunches: 1,
  },
};

export function palmParams(stage: PalmStage): Readonly<PalmParams> {
  return PARAMS[stage];
}

/** Height of the crown for a stage — where bunches hang and wind bob pivots. */
export function palmCrownHeight(stage: PalmStage): number {
  return PARAMS[stage].trunkHeight;
}

const _euler = new Euler();
const _quat = new Quaternion();
const _scale = new Vector3();
const _pos = new Vector3();
const _m = new Matrix4();

function place(pos: Vector3, euler: Euler, scale: Vector3): Matrix4 {
  return _m.compose(pos, _quat.setFromEuler(euler), scale);
}

export function buildPalmGeometry(stage: PalmStage): BufferGeometry {
  const p = PARAMS[stage];
  const b = new BoxBuilder();

  // ── Trunk: tapered boxes with a subtle S-bend ────────────────────────────
  if (p.trunkHeight > 0 && p.trunkSegments > 0) {
    const segH = p.trunkHeight / p.trunkSegments;
    for (let i = 0; i < p.trunkSegments; i++) {
      const t = (i + 0.5) / p.trunkSegments;
      // taper toward the crown, and lean back and forth once over the height
      const radius = p.trunkRadius * (1 - 0.28 * t);
      const bend = Math.sin(t * Math.PI * 1.15) * p.trunkHeight * 0.045;
      _pos.set(bend, segH * (i + 0.5), 0);
      _euler.set(0, 0, -Math.cos(t * Math.PI * 1.15) * 0.06);
      _scale.set(radius * 2, segH * 1.02, radius * 2);
      b.addBox(place(_pos, _euler, _scale), { side: Palette.PalmTrunk });
    }
  }

  // ── Crown: slabs radiating outward, tapering along their length ──────────
  const crownY = p.trunkHeight;
  const segments = 3;
  for (let f = 0; f < p.frondCount; f++) {
    const yaw = (f / p.frondCount) * Math.PI * 2 + (f % 2) * 0.11;
    // alternate fronds droop a little differently so the crown is not a disc
    const droop = p.droop * (f % 2 === 0 ? 1 : 0.82);

    for (let s = 0; s < segments; s++) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      const tMid = (t0 + t1) / 2;

      const reach = p.frondLength * tMid;
      const width = p.frondWidth * (1 - 0.62 * tMid);
      const segLen = p.frondLength / segments;

      // droop increases along the frond, so the tip hangs lowest
      const localDroop = droop * tMid * 1.4;
      const y = crownY + Math.sin(-localDroop) * reach + p.frondLength * 0.06;
      const horizontal = Math.cos(-localDroop) * reach;

      _pos.set(Math.cos(yaw) * horizontal, y, Math.sin(yaw) * horizontal);
      _euler.set(0, -yaw, -localDroop, 'YZX');
      _scale.set(segLen * 1.05, p.frondWidth * 0.22, width * 2);
      b.addBox(place(_pos, _euler, _scale), { side: p.frondSlot });
    }
  }

  // ── Ripe bunches tucked under the crown ──────────────────────────────────
  for (let i = 0; i < p.bunches; i++) {
    const yaw = (i / Math.max(1, p.bunches)) * Math.PI * 2 + 0.6;
    const r = p.trunkRadius + 0.05;
    _pos.set(Math.cos(yaw) * r, crownY - 0.06, Math.sin(yaw) * r);
    _euler.set(0, -yaw, 0);
    _scale.set(0.1, 0.085, 0.1);
    b.addBox(place(_pos, _euler, _scale), { side: Palette.PalmBunch });
  }

  return b.build();
}
