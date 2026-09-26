import { Matrix4, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';

import { Palette } from '@render/materials/paletteSlots.ts';
import { MobField } from '@render/mobs/MobField.ts';
import { partGeometry, partOrder, pose, triangleCount } from '@render/mobs/rig.ts';
import { SPECIES, SPECIES_IDS } from '@render/mobs/species.ts';
import type { SimState } from '@sim/types.ts';

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

  it('the new arrivals have bodies: a pangolin and the golden capybara', () => {
    for (const id of ['pangolin', 'shinyCapybara']) {
      const spec = SPECIES[id];

      expect(spec, id).toBeDefined();
      expect(spec!.parts.length, id).toBeGreaterThanOrEqual(6);
      expect(partOrder(spec!)[0]!.part.role, id).toBe('body');
    }

    // The golden one is the capybara in another coat, not another animal.
    expect(SPECIES['shinyCapybara']!.parts.length).toBe(SPECIES['capybara']!.parts.length);
    expect(SPECIES['shinyCapybara']!.parts[0]!.slot).not.toBe(SPECIES['capybara']!.parts[0]!.slot);
  });

  it('the dead have bodies too: red eyes on the ghost, and a pocong with no arms or legs', () => {
    const ghost = SPECIES['ghost']!;
    const eyes = ghost.parts.filter((p) => p.name === 'eyeL' || p.name === 'eyeR');

    expect(ghost.spectral).toBe(true);
    expect(eyes).toHaveLength(2);

    // The eyes are the one solid thing on a see-through body, and they glow red.
    for (const eye of eyes) {
      expect(eye.opaque).toBe(true);
      expect(eye.slot).toBe(Palette.GhostEye);
      expect(eye.parent).toBe('head');
    }

    const pocong = SPECIES['pocong']!;
    const roles = new Set(pocong.parts.map((p) => p.role));

    expect(pocong.spectral).toBe(true);
    expect(roles.has('armL') || roles.has('legFL') || roles.has('legBL')).toBe(false);
    expect(pocong.parts.find((p) => p.name === 'face')?.opaque).toBe(true);

    // The knot above the head flares as it goes up: three tiers, each wider than the last.
    const knot = ['knotA', 'knotB', 'knotC'].map((n) => pocong.parts.find((p) => p.name === n)!);

    expect(knot[0]!.size[0]).toBeLessThan(knot[1]!.size[0]);
    expect(knot[1]!.size[0]).toBeLessThan(knot[2]!.size[0]);
    expect(knot[0]!.at[1]).toBeLessThan(knot[2]!.at[1]);
    // No legs to swing: the whole body hops instead.
    expect(pocong.swing).toBe(0);
    expect(pocong.bob).toBeGreaterThan(SPECIES['ghost']!.bob * 5);
  });

  it('a hop lifts the whole body on the step, and a drift floats it standing still', () => {
    const pocong = SPECIES['pocong']!;
    const body = pocong.parts[0]!;
    const m = new Matrix4();
    const heights: number[] = [];

    for (let t = 0; t < 1; t += 0.05) {
      pose(pocong, body, { time: t, gait: 1, phase: 0 }, m);
      heights.push(m.elements[13]!);
    }

    // Moving: it rises and falls by about its bob, never below the ground it rests on.
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(pocong.bob * 0.8);
    expect(Math.min(...heights)).toBeGreaterThan(0);
  });

  it('sitting and climbing move the body: back tips up, and the climber rises', () => {
    const monkey = SPECIES['monkey']!;
    const body = monkey.parts[0]!;
    const m = new Matrix4();
    /** The body's pitch and height this pose. */
    const read = (input: Parameters<typeof pose>[2]): { pitch: number; y: number } => {
      pose(monkey, body, input, m);

      const e = m.elements;

      return { pitch: Math.atan2(-e[9]!, e[10]!), y: e[13]! };
    };

    const still = read({ time: 0, gait: 0, phase: 0 });
    const sitting = read({ time: 0, gait: 0, phase: 0, sit: 1 });
    const climbing = read({ time: 0, gait: 0, phase: 0, climb: 1 });

    // Sitting tips the chest up a little; climbing swings it upright and lifts it.
    expect(sitting.pitch).toBeLessThan(still.pitch);
    expect(climbing.pitch).toBeLessThan(sitting.pitch);
    expect(climbing.y).toBeGreaterThan(still.y);
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
    const crowd = (): void => {
      for (let mob = 0; mob < 500; mob++) {
        const spec = SPECIES[SPECIES_IDS[mob % SPECIES_IDS.length]!]!;

        for (const part of spec.parts)
          pose(spec, part, { time: mob * 0.01, gait: 1, phase: mob }, m);
      }
    };

    // Warm the JIT first; the cold run measures compilation, not posing. The
    // real number is ~1 ms; the budget leaves room for a busy test machine.
    crowd();

    const t0 = performance.now();

    crowd();

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

describe('a mob that bolts (GDD 6.5)', () => {
  /** A field with stub materials: nothing here touches the GPU. */
  function field() {
    const material = new MeshBasicMaterial();

    return new MobField({
      material,
      spectralMaterial: material,
      groundAt: () => 0,
      bounds: { minX: 0, maxX: 64, minZ: 0, maxZ: 64 },
    });
  }

  /** One sim mob, standing still on a block the player owns. */
  function state(mobs: unknown[]): SimState {
    return { mobs, blocks: new Map(), tick: 0 } as unknown as SimState;
  }

  const pig = {
    id: 7,
    species: 'babiNgepet',
    x: 4.5,
    z: 4.5,
    tx: 4.5,
    tz: 4.5,
    intent: 'wander',
    standing: false,
    hired: false,
    phase: 0.2,
    until: 50,
    climb: 0,
    target: null,
    shiny: false,
  };

  it('splits the dead across the sheets: the body veiled, the eyes and face solid', () => {
    const mobs = field();
    const [solid, spectral, dense] = mobs.group.children;
    const ghost = { ...pig, id: 9, species: 'ghost', intent: 'idle' };
    const pocong = { ...pig, id: 11, species: 'pocong', intent: 'idle' };

    // A ghost: see-through body on the spectral sheet, eyes on the solid one.
    mobs.syncSim(state([ghost]));
    mobs.update(0.1, 1);
    expect(solid?.visible).toBe(true);
    expect(spectral?.visible).toBe(true);
    expect(dense?.visible).toBe(false);

    // A pocong is barely see-through, so its body goes on its own sheet.
    mobs.syncSim(state([pocong]));
    mobs.update(0.1, 1);
    mobs.update(1, 1);
    expect(dense?.visible).toBe(true);
    expect(spectral?.visible).toBe(false);
    expect(solid?.visible).toBe(true);

    // A plain animal is all one sheet.
    mobs.syncSim(state([pig]));
    mobs.update(0.1, 1);
    mobs.update(1, 1);
    expect(solid?.visible).toBe(true);
    expect(spectral?.visible).toBe(false);
    expect(dense?.visible).toBe(false);
  });

  it('runs for a moment, fades out, and does not come back', () => {
    const mobs = field();

    mobs.syncSim(state([pig]));
    expect(mobs.positionOf(pig.id)).not.toBeNull();

    // Tapped: it bolts. It is still there while it runs.
    mobs.flee(pig.id, 0.5);
    mobs.update(0.3, 1);
    expect(mobs.positionOf(pig.id), 'gone before it had time to run').not.toBeNull();

    // Then it fades, and once it has faded it is out of the world.
    mobs.update(0.4, 1);
    mobs.update(1, 1);
    expect(mobs.positionOf(pig.id)).toBeNull();

    // The sim is still walking it to the edge of the map; it stays gone.
    mobs.syncSim(state([pig]));
    expect(mobs.positionOf(pig.id), 'it came back').toBeNull();

    // And when the sim finally drops it, the field forgets it too, so a new
    // mob that happens to reuse the id is drawn normally.
    mobs.syncSim(state([]));
    mobs.syncSim(state([pig]));
    expect(mobs.positionOf(pig.id)).not.toBeNull();
  });
});
