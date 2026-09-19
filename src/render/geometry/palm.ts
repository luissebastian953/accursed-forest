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
    trunkHeight: 1.24,
    trunkRadius: 0.085,
    trunkSegments: 6,
    frondCount: 10,
    frondLength: 0.64,
    frondWidth: 0.125,
    droop: 0.5,
    frondSlot: Palette.PalmFrond,
    bunches: 3,
  },
  senile: {
    trunkHeight: 2.15,
    trunkRadius: 0.075,
    trunkSegments: 9,
    frondCount: 9,
    frondLength: 0.74,
    frondWidth: 0.135,
    droop: 0.62,
    frondSlot: Palette.PalmFrondSenile,
    bunches: 1,
  },
};

export function palmParams(stage: PalmStage): Readonly<PalmParams> {
  return PARAMS[stage];
}

/** Height of the crown for a stage; where bunches hang and wind bob pivots. */
export function palmCrownHeight(stage: PalmStage): number {
  return PARAMS[stage].trunkHeight;
}

/**
 * How the outer segments fan into leaflets, in radians either side of the
 * spine: a little at the middle of the frond, wider at the tip.
 */
const FAN_MID = [-0.13, 0, 0.13] as const;
const FAN_TIP = [-0.26, 0, 0.26] as const;

const _euler = new Euler();
const _quat = new Quaternion();
const _scale = new Vector3();
const _pos = new Vector3();
const _m = new Matrix4();

function place(pos: Vector3, euler: Euler, scale: Vector3): Matrix4 {
  return _m.compose(pos, _quat.setFromEuler(euler), scale);
}

/** Healthy, or visibly sick with Ganoderma: yellowed fronds, a dark rot band at the base (§6.4). */
export type PalmVariant = 'healthy' | 'sick';

export function buildPalmGeometry(
  stage: PalmStage,
  variant: PalmVariant = 'healthy',
): BufferGeometry {
  const p = PARAMS[stage];
  const b = new BoxBuilder();
  const frondSlot = variant === 'sick' ? Palette.PalmFrondSenile : p.frondSlot;

  if (variant === 'sick' && p.trunkHeight > 0) {
    // Basal stem rot: a dark collar where the trunk meets the ground.
    b.addAABox(0, 0.06, 0, p.trunkRadius * 2.6, 0.12, p.trunkRadius * 2.6, {
      side: Palette.Charcoal,
    });
  }

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
    // alternate fronds droop a long way differently, so the crown is a head of
    // separate leaves rather than a disc
    const droop = p.droop * (f % 2 === 0 ? 1.15 : 0.62);

    for (let s = 0; s < segments; s++) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      const tMid = (t0 + t1) / 2;

      const reach = p.frondLength * tMid;
      const width = p.frondWidth * (1 - 0.55 * tMid);
      const segLen = p.frondLength / segments;

      // droop increases along the frond, so the tip hangs lowest
      const localDroop = droop * tMid * 1.4;
      const y = crownY + Math.sin(-localDroop) * reach + p.frondLength * 0.06;
      const horizontal = Math.cos(-localDroop) * reach;

      // A palm frond is pinnate: past the middle it splits into leaflets. The
      // outer segment is drawn as a pair fanned either side of the spine, so
      // the crown reads as leaves rather than as paddles.
      const tip = s === segments - 1;
      const split = tip ? FAN_TIP : s === segments - 2 ? FAN_MID : [0];
      for (const fan of split) {
        _pos.set(
          Math.cos(yaw + fan) * horizontal,
          y - Math.abs(fan) * reach * 0.18,
          Math.sin(yaw + fan) * horizontal,
        );
        _euler.set(0, -(yaw + fan), -localDroop * (1 + Math.abs(fan) * 0.6), 'YZX');
        // The leaflets are narrower than the spine they hang off, so the gaps
        // between them read at a distance.
        _scale.set(
          segLen * (fan === 0 ? 1.05 : tip ? 1.3 : 1.1),
          p.frondWidth * 0.2,
          width * (fan === 0 ? 1.3 : 0.85),
        );
        b.addBox(place(_pos, _euler, _scale), { side: frondSlot });
      }
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

/** What a dead or removed palm leaves behind until the ground is cleared. */
export function buildStumpGeometry(): BufferGeometry {
  const b = new BoxBuilder();
  b.addAABox(0, 0.13, 0, 0.16, 0.26, 0.16, { side: Palette.Stump });
  return b.build();
}
