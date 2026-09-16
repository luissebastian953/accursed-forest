import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';

import { partGeometry, partOrder, pose, triangleCount } from '@render/mobs/rig.ts';
import { SPECIES, SPECIES_IDS } from '@render/mobs/species.ts';

describe('mob rig (POC)', () => {
  it('every species is a tree of parts, parents before children, with a body at the root', () => {
    for (const id of SPECIES_IDS) {
      const spec = SPECIES[id]!;
      const order = partOrder(spec);
      expect(order[0]!.parent, id).toBe(-1);
      expect(order[0]!.part.role, id).toBe('body');
      order.forEach(({ parent }, i) => {
        if (parent >= 0) expect(parent, `${id}: part ${i}`).toBeLessThan(i);
      });
      expect(spec.parts.length, id).toBeGreaterThanOrEqual(6);
      expect(spec.parts.length, id).toBeLessThanOrEqual(24);
      expect(triangleCount(spec)).toBe(spec.parts.length * 12);
    }
  });

  it('a walk swings the legs out of phase and never breaks the rig', () => {
    const boar = SPECIES['wildBoar']!;
    const fl = boar.parts.find((p) => p.role === 'legFL')!;
    const fr = boar.parts.find((p) => p.role === 'legFR')!;
    const m = new Matrix4();
    const angle = (part: typeof fl, time: number): number => {
      pose(boar, part, { time, gait: 1, phase: 0 }, m);
      // Rotation about X shows up in the second column's Z component.
      return Math.asin(-m.elements[9]!);
    };
    let opposite = 0;
    for (let t = 0; t < 2; t += 0.05) {
      const a = angle(fl, t);
      const b = angle(fr, t);
      if (Math.sign(a) !== Math.sign(b) || Math.abs(a) < 0.02) opposite += 1;
      expect(Math.abs(a)).toBeLessThanOrEqual(boar.swing + 1e-6);
    }
    expect(opposite).toBeGreaterThan(30);
  });

  it('standing still, nothing swings', () => {
    const cow = SPECIES['cow']!;
    const m = new Matrix4();
    for (const part of cow.parts) {
      if (part.role !== 'legFL' && part.role !== 'body') continue;
      pose(cow, part, { time: 3.3, gait: 0, phase: 1 }, m);
      const rest = new Matrix4().makeTranslation(...part.at);
      for (let i = 0; i < 16; i++) expect(m.elements[i]).toBeCloseTo(rest.elements[i]!, 5);
    }
  });

  it('the babi ngepet rears up: its body pitches back and lifts', () => {
    const babi = SPECIES['babiNgepet']!;
    const body = babi.parts[0]!;
    const down = new Matrix4();
    const up = new Matrix4();
    pose(babi, body, { time: 0, gait: 0, phase: 0, stand: 0 }, down);
    pose(babi, body, { time: 0, gait: 0, phase: 0, stand: 1 }, up);
    expect(up.elements[13]).toBeGreaterThan(down.elements[13]! + 0.3);
    expect(Math.abs(up.elements[9]!)).toBeGreaterThan(0.8);
  });

  it('posing a crowd is cheap: 500 mobs of every part in well under a frame', () => {
    const m = new Matrix4();
    const t0 = performance.now();
    for (let mob = 0; mob < 500; mob++) {
      const spec = SPECIES[SPECIES_IDS[mob % SPECIES_IDS.length]!]!;
      for (const part of spec.parts) pose(spec, part, { time: mob * 0.01, gait: 1, phase: mob }, m);
    }
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(16);
  });

  it('part geometry hangs off its pivot the way the role needs', () => {
    const leg = SPECIES['pig']!.parts.find((p) => p.role === 'legFL')!;
    const geometry = partGeometry(leg);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(0, 6);
    expect(geometry.boundingBox!.min.y).toBeCloseTo(-leg.size[1], 6);
  });
});
