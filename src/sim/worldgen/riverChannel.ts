import { WORLD } from '../balance/world.ts';

import { NOISE_TAG, noiseFor } from './elevation.ts';
import type { World } from './index.ts';

const SIDE = WORLD.blockSide;

export const RIVER_SHAPE = {
  chaikinPasses: 3,
  /** Resample spacing along the channel, in columns. */
  step: 2,
  /** Meander: sideways push in columns, and its wavelength along the channel. */
  meanderAmplitude: 3.5,
  meanderWavelength: 42,
  wiggleAmplitude: 1,
  wiggleWavelength: 13,
  /** Half-width of the water, in columns, at the source and at the mouth. */
  halfWidthSource: 2.5,
  halfWidthMouth: 4.5,
  /** Segments are bucketed into every block within this many columns of them. */
  reach: 10,
} as const;

export interface RiverChannel {
  /**
   * Signed distance, in columns, from the centre of column (gx, gz) to the
   * water's edge: negative in the water. `Infinity` far from any river.
   */
  edge(gx: number, gz: number): number;
}

interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
}

type Point = [number, number];

function chaikin(points: readonly Point[]): Point[] {
  if (points.length < 3) return [...points];

  const out: Point[] = [points[0]!];

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;

    out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
    out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
  }

  out.push(points.at(-1)!);
  return out;
}

function resample(points: readonly Point[], step: number): { p: Point; s: number }[] {
  const out: { p: Point; s: number }[] = [{ p: points[0]!, s: 0 }];
  let travelled = 0;
  let carry = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const length = Math.hypot(bx - ax, bz - az);
    let t = step - carry;

    while (t <= length) {
      const f = t / length;

      out.push({ p: [ax + (bx - ax) * f, az + (bz - az) * f], s: travelled + t });
      t += step;
    }

    carry = length - (t - step);
    travelled += length;
  }

  const last = points.at(-1)!;

  out.push({ p: last, s: travelled });
  return out;
}

export function buildRiverChannel(world: World): RiverChannel {
  const meander = noiseFor(world.params.seed, NOISE_TAG.riverMeander);
  const buckets = new Map<number, Segment[]>();
  const bucketKey = (bx: number, by: number): number => by * (world.width + 2) + bx;

  world.rivers.paths.forEach((path, index) => {
    if (path.length < 2) return;

    let points: Point[] = path.map((key) => {
      const [x, y] = world.toXY(key);

      return [(x + 0.5) * SIDE, (y + 0.5) * SIDE];
    });
    // Run the mouth off the edge of the map so the channel does not end in a cap.
    const [px, pz] = points.at(-2)!;
    const [lx, lz] = points.at(-1)!;

    points.push([lx + (lx - px) * 1.5, lz + (lz - pz) * 1.5]);

    for (let i = 0; i < RIVER_SHAPE.chaikinPasses; i++) points = chaikin(points);

    const samples = resample(points, RIVER_SHAPE.step);
    const total = samples.at(-1)!.s || 1;

    const bent: Point[] = samples.map(({ p, s }, i) => {
      const prev = samples[Math.max(0, i - 1)]!.p;
      const next = samples[Math.min(samples.length - 1, i + 1)]!.p;
      const tx = next[0] - prev[0];
      const tz = next[1] - prev[1];
      const length = Math.hypot(tx, tz) || 1;
      // Pinned at the source, free along the run.
      const pin = Math.min(1, s / (SIDE * 2));
      const push =
        pin *
        (meander(s / RIVER_SHAPE.meanderWavelength, index * 7.31) * RIVER_SHAPE.meanderAmplitude +
          meander(s / RIVER_SHAPE.wiggleWavelength, index * 3.17 + 50) *
            RIVER_SHAPE.wiggleAmplitude);

      return [p[0] + (-tz / length) * push, p[1] + (tx / length) * push];
    });

    for (let i = 0; i < bent.length - 1; i++) {
      const [ax, az] = bent[i]!;
      const [bx, bz] = bent[i + 1]!;
      const t = samples[i]!.s / total;
      const segment: Segment = {
        ax,
        az,
        bx,
        bz,
        halfWidth:
          RIVER_SHAPE.halfWidthSource +
          (RIVER_SHAPE.halfWidthMouth - RIVER_SHAPE.halfWidthSource) * t,
      };
      const r = RIVER_SHAPE.reach;
      const x0 = Math.floor((Math.min(ax, bx) - r) / SIDE);
      const x1 = Math.floor((Math.max(ax, bx) + r) / SIDE);
      const z0 = Math.floor((Math.min(az, bz) - r) / SIDE);
      const z1 = Math.floor((Math.max(az, bz) + r) / SIDE);

      for (let by = z0; by <= z1; by++) {
        for (let bx2 = x0; bx2 <= x1; bx2++) {
          if (bx2 < -1 || by < -1 || bx2 > world.width || by > world.height) continue;

          const key = bucketKey(bx2 + 1, by + 1);
          let list = buckets.get(key);

          if (!list) buckets.set(key, (list = []));
          list.push(segment);
        }
      }
    }
  });

  return {
    edge(gx, gz) {
      const list = buckets.get(bucketKey(Math.floor(gx / SIDE) + 1, Math.floor(gz / SIDE) + 1));

      if (!list) return Infinity;

      const px = gx + 0.5;
      const pz = gz + 0.5;
      let best = Infinity;

      for (const s of list) {
        const dx = s.bx - s.ax;
        const dz = s.bz - s.az;
        const lengthSq = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / lengthSq));
        const d = Math.hypot(px - (s.ax + dx * t), pz - (s.az + dz * t)) - s.halfWidth;

        if (d < best) best = d;
      }

      return best;
    },
  };
}

const CHANNELS = new WeakMap<World, RiverChannel>();

/** The world's channel, built once. Where the water is, to both layers. */
export function riverChannel(world: World): RiverChannel {
  let channel = CHANNELS.get(world);

  if (!channel) {
    channel = buildRiverChannel(world);
    CHANNELS.set(world, channel);
  }

  return channel;
}
