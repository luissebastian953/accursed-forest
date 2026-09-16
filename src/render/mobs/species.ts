/**
 * The cast (POC): who walks around the estate.
 *
 * Every one is the same handful of boxes in a different arrangement — a
 * quadruped body with four swinging legs, or a biped with two arms — so they
 * all animate from the one rig in `rig.ts`. Sizes are in world units, where a
 * palm slot is 1 and a mature palm stands about 4.
 */

import { Palette } from '../materials/paletteSlots.ts';

import type { PartRole, SpeciesSpec } from './rig.ts';

/**
 * A four-legged body: barrel, head, snout, four legs, tail, ears. `fur` and
 * `belly` paint it, and the numbers stretch it from a mouse to a cow.
 */
function quadruped(options: {
  id: string;
  label: string;
  fur: number;
  belly?: number;
  snout?: number;
  length: number;
  height: number;
  width: number;
  headSize: number;
  legLength: number;
  tail?: number;
  ears?: boolean;
  speed: number;
  swing?: number;
  cadence?: number;
}): SpeciesSpec {
  const { id, label, fur, length, height, width, headSize, legLength } = options;
  const belly = options.belly ?? fur;
  const snout = options.snout ?? Palette.Snout;
  const legX = width / 2 - width * 0.18;
  const legZ = length / 2 - length * 0.22;
  const bodyY = legLength + height / 2;

  const parts: SpeciesSpec['parts'] = [
    {
      name: 'body',
      at: [0, bodyY, 0],
      size: [width, height, length],
      slot: fur,
      role: 'body',
    },
    {
      name: 'belly',
      parent: 'body',
      at: [0, -height * 0.3, 0],
      size: [width * 0.9, height * 0.45, length * 0.85],
      slot: belly,
      role: 'still',
    },
    {
      name: 'head',
      parent: 'body',
      at: [0, height * 0.35, length / 2 + headSize * 0.35],
      size: [headSize, headSize, headSize],
      slot: fur,
      role: 'head',
    },
    {
      name: 'snout',
      parent: 'head',
      at: [0, -headSize * 0.15, headSize * 0.6],
      size: [headSize * 0.45, headSize * 0.4, headSize * 0.5],
      slot: snout,
      role: 'still',
    },
  ];

  if (options.ears !== false) {
    for (const side of [-1, 1]) {
      parts.push({
        name: side < 0 ? 'earL' : 'earR',
        parent: 'head',
        at: [side * headSize * 0.42, headSize * 0.45, -headSize * 0.1],
        size: [headSize * 0.22, headSize * 0.35, headSize * 0.12],
        slot: fur,
        role: 'ear',
        pivot: 'bottom',
      });
    }
  }

  const legs: [PartRole & `leg${string}`, number, number][] = [
    ['legFL', -legX, legZ],
    ['legFR', legX, legZ],
    ['legBL', -legX, -legZ],
    ['legBR', legX, -legZ],
  ];
  for (const [name, x, z] of legs) {
    parts.push({
      name,
      parent: 'body',
      at: [x, -height / 2, z],
      size: [width * 0.22, legLength, width * 0.22],
      slot: fur,
      role: name,
      pivot: 'top',
    });
    parts.push({
      name: `${name}Hoof`,
      parent: name,
      at: [0, -legLength, 0],
      size: [width * 0.26, legLength * 0.18, width * 0.28],
      slot: Palette.Hoof,
      role: 'still',
      pivot: 'bottom',
    });
  }

  if (options.tail) {
    parts.push({
      name: 'tail',
      parent: 'body',
      at: [0, height * 0.2, -length / 2],
      size: [width * 0.12, width * 0.12, options.tail],
      slot: fur,
      role: 'tail',
    });
  }

  return {
    id,
    label,
    parts,
    speed: options.speed,
    swing: options.swing ?? 0.55,
    bob: height * 0.08,
    cadence: options.cadence ?? 1.8,
  };
}

/** A two-legged body: torso, head, arms that swing against the legs. */
function biped(options: {
  id: string;
  label: string;
  cloth: number;
  skin?: number;
  hat?: number;
  height: number;
  speed: number;
  carries?: number;
  /** What the right hand holds: an axe for the chop, a flamethrower for the burn. */
  tool?: 'axe' | 'flamethrower';
  spectral?: boolean;
}): SpeciesSpec {
  const skin = options.skin ?? Palette.Skin;
  const h = options.height;
  const legLength = h * 0.42;
  const torso = h * 0.34;
  const head = h * 0.17;
  const width = h * 0.3;

  const parts: SpeciesSpec['parts'] = [
    {
      name: 'body',
      at: [0, legLength + torso / 2, 0],
      size: [width, torso, width * 0.6],
      slot: options.cloth,
      role: 'body',
    },
    {
      name: 'head',
      parent: 'body',
      at: [0, torso / 2 + head * 0.5, 0],
      size: [head, head, head],
      slot: options.spectral ? options.cloth : skin,
      role: 'head',
    },
  ];

  if (options.hat !== undefined) {
    parts.push({
      name: 'hat',
      parent: 'head',
      at: [0, head * 0.55, 0],
      size: [head * 1.25, head * 0.3, head * 1.25],
      slot: options.hat,
      role: 'still',
    });
  }

  for (const side of [-1, 1]) {
    parts.push({
      name: side < 0 ? 'armL' : 'armR',
      parent: 'body',
      at: [side * (width / 2 + h * 0.03), torso * 0.38, 0],
      size: [h * 0.09, h * 0.3, h * 0.09],
      slot: options.cloth,
      role: side < 0 ? 'armL' : 'armR',
      pivot: 'top',
    });
    parts.push({
      name: side < 0 ? 'legL' : 'legR',
      parent: 'body',
      at: [side * width * 0.24, -torso / 2, 0],
      size: [h * 0.1, legLength, h * 0.11],
      slot: options.spectral ? options.cloth : Palette.ClothWorker,
      role: side < 0 ? 'legFL' : 'legFR',
      pivot: 'top',
    });
  }

  if (options.carries !== undefined) {
    parts.push({
      name: 'sack',
      parent: 'armR',
      at: [h * 0.06, -h * 0.3, 0],
      size: [h * 0.22, h * 0.24, h * 0.18],
      slot: options.carries,
      role: 'prop',
    });
  }

  if (options.tool === 'axe') {
    // Handle forward from the fist, head at its end; the arm's swing carries it.
    parts.push(
      {
        name: 'axeHandle',
        parent: 'armR',
        at: [0, -h * 0.3, h * 0.2],
        size: [h * 0.045, h * 0.045, h * 0.42],
        slot: Palette.PalmTrunk,
        role: 'still',
      },
      {
        name: 'axeHead',
        parent: 'armR',
        at: [0, -h * 0.3 - h * 0.03, h * 0.38],
        size: [h * 0.05, h * 0.16, h * 0.11],
        slot: Palette.Steel,
        role: 'still',
      },
    );
  }

  if (options.tool === 'flamethrower') {
    // A tank on the back, a nozzle in the fist, and the tongue of flame at its end.
    parts.push(
      {
        name: 'tank',
        parent: 'body',
        at: [0, 0, -width * 0.48],
        size: [width * 0.75, torso * 0.85, width * 0.38],
        slot: Palette.Steel,
        role: 'still',
      },
      {
        name: 'nozzle',
        parent: 'armR',
        at: [0, -h * 0.3, h * 0.22],
        size: [h * 0.06, h * 0.06, h * 0.46],
        slot: Palette.Charcoal,
        role: 'still',
      },
      {
        name: 'flame',
        parent: 'armR',
        at: [0, -h * 0.3, h * 0.55],
        size: [h * 0.1, h * 0.1, h * 0.2],
        slot: Palette.Fire,
        role: 'prop',
      },
    );
  }

  return {
    id: options.id,
    label: options.label,
    parts,
    speed: options.speed,
    swing: 0.7,
    bob: h * 0.02,
    cadence: 1.6,
    biped: true,
    ...(options.spectral ? { spectral: true } : {}),
  };
}

export const SPECIES: Record<string, SpeciesSpec> = {
  wildBoar: quadruped({
    id: 'wildBoar',
    label: 'Wild boar',
    fur: Palette.FurBoar,
    belly: Palette.FurDark,
    length: 1.9,
    height: 0.85,
    width: 0.8,
    headSize: 0.62,
    legLength: 0.5,
    tail: 0.35,
    speed: 2.2,
    cadence: 2,
  }),
  pig: quadruped({
    id: 'pig',
    label: 'Pig',
    fur: Palette.FurPig,
    length: 1.6,
    height: 0.8,
    width: 0.75,
    headSize: 0.55,
    legLength: 0.4,
    tail: 0.25,
    speed: 1.6,
  }),
  mouse: quadruped({
    id: 'mouse',
    label: 'Mouse',
    fur: Palette.FurMouse,
    length: 0.5,
    height: 0.28,
    width: 0.26,
    headSize: 0.24,
    legLength: 0.12,
    tail: 0.5,
    speed: 2,
    cadence: 3.6,
  }),
  cow: quadruped({
    id: 'cow',
    label: 'Cow',
    fur: Palette.FurCow,
    belly: Palette.FurCowSpot,
    length: 2.6,
    height: 1.25,
    width: 1.05,
    headSize: 0.8,
    legLength: 0.95,
    tail: 0.7,
    speed: 1.3,
    cadence: 1.2,
  }),
  capybara: quadruped({
    id: 'capybara',
    label: 'Capybara',
    fur: Palette.FurCapybara,
    length: 1.5,
    height: 0.75,
    width: 0.7,
    headSize: 0.6,
    legLength: 0.32,
    tail: 0,
    speed: 1.4,
    cadence: 1.4,
  }),
  monkey: quadruped({
    id: 'monkey',
    label: 'Monkey',
    fur: Palette.FurMonkey,
    length: 0.8,
    height: 0.5,
    width: 0.45,
    headSize: 0.42,
    legLength: 0.35,
    tail: 1.1,
    speed: 2.2,
    cadence: 2.6,
  }),
  orangutan: quadruped({
    id: 'orangutan',
    label: 'Orangutan',
    fur: Palette.FurOrangutan,
    belly: Palette.FurDark,
    length: 1.2,
    height: 0.95,
    width: 0.85,
    headSize: 0.62,
    legLength: 0.45,
    speed: 1.1,
    cadence: 1.1,
    swing: 0.45,
  }),
  thief: biped({
    id: 'thief',
    label: 'Thief',
    cloth: Palette.ClothThief,
    hat: Palette.ClothThief,
    height: 1.7,
    speed: 2.6,
    carries: Palette.Sack,
  }),
  plantDoctor: biped({
    id: 'plantDoctor',
    label: 'Plant doctor',
    cloth: Palette.ClothDoctor,
    hat: Palette.ClothDoctor,
    height: 1.7,
    speed: 1.6,
    carries: Palette.Steel,
  }),
  security: biped({
    id: 'security',
    label: 'Security',
    cloth: Palette.ClothSecurity,
    hat: Palette.HiVis,
    height: 1.75,
    speed: 1.5,
  }),
  sanitizer: biped({
    id: 'sanitizer',
    label: 'Sanitation crew',
    cloth: Palette.HiVis,
    hat: Palette.ClothWorker,
    height: 1.7,
    speed: 1.6,
    carries: Palette.Sack,
  }),
  chopper: biped({
    id: 'chopper',
    label: 'Clearing crew',
    cloth: Palette.HiVis,
    hat: Palette.ClothWorker,
    height: 1.7,
    speed: 1.6,
    tool: 'axe',
  }),
  burner: biped({
    id: 'burner',
    label: 'Burn crew',
    cloth: Palette.HiVis,
    hat: Palette.Charcoal,
    height: 1.7,
    speed: 1.6,
    tool: 'flamethrower',
  }),
  babiNgepet: quadruped({
    id: 'babiNgepet',
    label: 'Babi ngepet',
    fur: Palette.FurDark,
    belly: Palette.FurBoar,
    snout: Palette.FurDark,
    length: 1.7,
    height: 0.85,
    width: 0.8,
    headSize: 0.62,
    legLength: 0.55,
    tail: 0.3,
    speed: 2.4,
    cadence: 2,
  }),
  ghost: biped({
    id: 'ghost',
    label: 'Ghost',
    cloth: Palette.Ghost,
    height: 1.6,
    speed: 0.5,
    spectral: true,
  }),
};

export type SpeciesId = keyof typeof SPECIES;

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[];
