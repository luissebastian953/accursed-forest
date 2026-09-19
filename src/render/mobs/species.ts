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
  /** Where the tail sits on the rump, as a fraction of body height. */
  tailAt?: number;
  ears?: boolean;
  /**
   * How far the head is carried above the barrel, as a fraction of body
   * height. A cow holds it high; a mouse holds it straight out in front.
   */
  headLift?: number;
  /** Holstein patches: slabs of this slot laid over the hide. */
  patches?: number;
  /**
   * Scales: staggered rows of small plates in this slot over the back and
   * down the tail, so a pangolin reads as armoured rather than as a brown pig.
   */
  scales?: number;
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
      at: [0, height * (options.headLift ?? 0.35), length / 2 + headSize * 0.35],
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

  if (options.patches !== undefined) {
    const slot = options.patches;
    // Each patch is a thin slab sitting just proud of the hide, so nothing
    // z-fights, and no two are mirrored: a Holstein is never symmetrical.
    const skin = 0.012;
    const flank = (name: string, side: number, y: number, z: number, h: number, d: number) => ({
      name,
      parent: 'body',
      at: [side * (width / 2 + skin), height * y, length * z] as [number, number, number],
      size: [skin * 2, height * h, length * d] as [number, number, number],
      slot,
      role: 'still' as PartRole,
    });
    const over = (name: string, x: number, z: number, w: number, d: number) => ({
      name,
      parent: 'body',
      at: [width * x, height / 2 + skin, length * z] as [number, number, number],
      size: [width * w, skin * 2, length * d] as [number, number, number],
      slot,
      role: 'still' as PartRole,
    });

    // The small slabs share an edge with the big ones, so each side reads as
    // one ragged patch rather than a row of windows.
    parts.push(
      flank('patchLA', -1, 0.06, -0.14, 0.5, 0.3),
      flank('patchLB', -1, -0.24, 0.1, 0.32, 0.18),
      flank('patchRA', 1, -0.04, 0.12, 0.46, 0.32),
      flank('patchRB', 1, 0.26, -0.11, 0.28, 0.16),
      over('patchBack', -0.04, 0.2, 0.6, 0.24),
      over('patchRump', 0.08, -0.3, 0.46, 0.2),
      {
        name: 'patchPoll',
        parent: 'head',
        at: [0, headSize / 2 + skin, -headSize * 0.12],
        size: [headSize * 0.8, skin * 2, headSize * 0.7],
        slot,
        role: 'still',
      },
    );
  }

  if (options.tail) {
    parts.push({
      name: 'tail',
      parent: 'body',
      at: [0, height * (options.tailAt ?? 0.2), -length / 2],
      size: [width * 0.12, width * 0.12, options.tail],
      slot: fur,
      role: 'tail',
    });
  }

  if (options.scales !== undefined) {
    const slot = options.scales;
    // Each plate is a thin slab just proud of the hide, laid in rows that
    // overlap like roof tiles: alternate rows are offset by half a plate, so
    // the back reads as armour rather than as a grid. Nine plates in all,
    // which lands the species exactly on the rig's part budget of 24; the
    // tail is too thin on screen for plates of its own to earn their cost.
    const skin = 0.012;
    const plateW = width * 0.34;
    const plateD = length * 0.24;
    const plate = (name: string, x: number, z: number) => ({
      name,
      parent: 'body',
      at: [width * x, height / 2 + skin, length * z] as [number, number, number],
      size: [plateW, skin * 2, plateD] as [number, number, number],
      slot,
      role: 'still' as PartRole,
    });
    const flank = (name: string, side: number, z: number) => ({
      name,
      parent: 'body',
      at: [side * (width / 2 + skin), height * 0.12, length * z] as [number, number, number],
      size: [skin * 2, height * 0.42, plateD] as [number, number, number],
      slot,
      role: 'still' as PartRole,
    });

    parts.push(
      plate('scaleA1', -0.3, 0.32),
      plate('scaleA2', 0.3, 0.32),
      plate('scaleB1', -0.6, 0.12),
      plate('scaleB2', 0, 0.12),
      plate('scaleB3', 0.6, 0.12),
      plate('scaleC1', -0.3, -0.08),
      plate('scaleC2', 0.3, -0.08),
      flank('scaleL', -1, 0.06),
      flank('scaleR', 1, 0.06),
    );
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
  /** What the right hand holds: an axe, a flamethrower, or a digger's shovel. */
  tool?: 'axe' | 'flamethrower' | 'shovel';
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

  if (options.tool === 'shovel') {
    // A shaft down from the fist with a broad blade on the end: the swing the
    // rig already plays for a chop reads as digging with it.
    parts.push(
      {
        name: 'shovelShaft',
        parent: 'armR',
        at: [0, -h * 0.3, h * 0.14],
        size: [h * 0.04, h * 0.04, h * 0.34],
        slot: Palette.PalmTrunk,
        role: 'still',
      },
      {
        name: 'shovelBlade',
        parent: 'armR',
        at: [0, -h * 0.31, h * 0.34],
        size: [h * 0.13, h * 0.03, h * 0.16],
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

/**
 * A great ape: upright on two short legs, with arms that nearly reach the
 * ground, a heavy belly it carries in front of it, and the bare grey face and
 * cheek flanges of an old male orangutan. Its legs take the biped roles, so
 * the rig swings them against the arms rather than against a second pair.
 */
function ape(options: {
  id: string;
  label: string;
  fur: number;
  bare: number;
  /** Standing height to the top of the head. */
  height: number;
  speed: number;
  cadence?: number;
  /** How wide it is against an orangutan: under 1 for a lighter build. */
  slim?: number;
  /** The bare chest and gut an orangutan carries; a lighter ape has none. */
  gut?: boolean;
  /** The cheek flanges of an old male. */
  flanges?: boolean;
  /** Tail length, if it has one: the apes do not, the monkeys do. */
  tail?: number;
}): SpeciesSpec {
  const { id, label, fur, bare } = options;
  const h = options.height;
  const slim = options.slim ?? 1;
  const legLength = h * 0.22;
  const torso = h * 0.46;
  const head = h * 0.3 * (slim < 1 ? 0.92 : 1);
  const width = h * 0.42 * slim;
  const armLength = h * 0.56;
  const limb = h * 0.13 * slim;

  const parts: SpeciesSpec['parts'] = [
    {
      name: 'body',
      at: [0, legLength + torso / 2, 0],
      size: [width, torso, width * 0.72],
      slot: fur,
      role: 'body',
    },
    {
      name: 'head',
      parent: 'body',
      at: [0, torso / 2 + head * 0.52, 0],
      size: [head * 0.94, head * 0.92, head * 0.72],
      slot: fur,
      role: 'head',
    },
    // The bare face.
    {
      name: 'face',
      parent: 'head',
      at: [0, -head * 0.06, head * 0.34],
      size: [head * 0.74, head * 0.74, head * 0.2],
      slot: bare,
      role: 'still',
    },
  ];

  // The bare front, in two boxes: a narrow chest above a gut that is wider
  // than it and carried further forward. Two boxes taper where one slab of
  // grey would read as a bib.
  if (options.gut ?? true) {
    parts.push(
      {
        name: 'chest',
        parent: 'body',
        at: [0, torso * 0.16, width * 0.2],
        size: [width * 0.58, torso * 0.34, width * 0.56],
        slot: bare,
        role: 'still',
      },
      {
        name: 'belly',
        parent: 'body',
        at: [0, -torso * 0.2, width * 0.26],
        size: [width * 0.82, torso * 0.52, width * 0.66],
        slot: bare,
        role: 'still',
      },
    );
  }

  // The cheek flanges an old male grows either side of its face.
  if (options.flanges ?? true) {
    for (const side of [-1, 1]) {
      parts.push({
        name: side < 0 ? 'cheekL' : 'cheekR',
        parent: 'head',
        at: [side * head * 0.66, -head * 0.05, 0],
        size: [head * 0.28, head * 0.86, head * 0.6],
        slot: fur,
        role: 'still',
      });
    }
  }

  // A tail, for the ones that have one. It starts behind the rump rather than
  // inside it, and droops as it goes: these legs are too short to hang a tail
  // from, and a rod through the middle of the body reads as a spit.
  if (options.tail) {
    const tail = options.tail;

    parts.push({
      name: 'tail',
      parent: 'body',
      // The root sits inside the rump, not against it: the droop turns the
      // tail about its middle, and a tail that starts at the back face swings
      // its near end out into the open.
      at: [0, -torso * 0.45, -(width * 0.12 + tail / 2)],
      size: [limb * 0.85, limb * 0.85, tail],
      slot: fur,
      role: 'tail',
      tilt: [-0.22, 0, 0],
    });
  }

  for (const side of [-1, 1]) {
    const arm = side < 0 ? 'armL' : 'armR';

    parts.push({
      name: arm,
      parent: 'body',
      // Clear of the torso by more than the arm's own thickness, so a light
      // build reads as a body with two arms beside it rather than one post.
      at: [side * (width / 2 + limb * 1.4), torso * 0.34, 0],
      size: [limb, armLength, limb * 1.08],
      slot: fur,
      role: side < 0 ? 'armL' : 'armR',
      pivot: 'top',
      tilt: [0, 0, side * 0.16],
    });
    parts.push({
      name: side < 0 ? 'handL' : 'handR',
      parent: arm,
      at: [0, -armLength - h * 0.035, h * 0.02],
      size: [limb, h * 0.09, h * 0.19 * slim],
      slot: bare,
      role: 'still',
    });
    parts.push({
      name: side < 0 ? 'legL' : 'legR',
      parent: 'body',
      at: [side * width * 0.23, -torso / 2, 0],
      size: [h * 0.19 * slim, legLength, h * 0.21 * slim],
      slot: fur,
      // A biped's two legs take the front roles: they swing against the arms.
      role: side < 0 ? 'legFL' : 'legFR',
      pivot: 'top',
    });
  }

  return {
    id,
    label,
    parts,
    speed: options.speed,
    swing: 0.5,
    bob: h * 0.02,
    cadence: options.cadence ?? 1.2,
    biped: true,
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
    // Low to the ground, nose out in front, tail dragging behind it.
    legLength: 0.06,
    headLift: 0,
    tail: 0.5,
    tailAt: -0.32,
    speed: 2,
    cadence: 3.6,
  }),
  cow: quadruped({
    id: 'cow',
    label: 'Cow',
    fur: Palette.FurCow,
    patches: Palette.FurCowSpot,
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
  // Built on the ape: upright, long-armed and short-legged like the orangutan,
  // but half its weight and with a tail to carry.
  monkey: ape({
    id: 'monkey',
    label: 'Monkey',
    fur: Palette.FurMonkey,
    bare: Palette.Skin,
    height: 1.05,
    slim: 0.72,
    flanges: false,
    tail: 0.85,
    speed: 2.2,
    cadence: 1.9,
  }),
  pangolin: quadruped({
    id: 'pangolin',
    label: 'Pangolin',
    // A pale hide under dark armour, and a tail as long as the body. The
    // plates carry the dark tone: light plates on a dark body read as
    // patches, dark plates on a light body read as scales.
    fur: Palette.FurPangolin,
    belly: Palette.FurPangolin,
    snout: Palette.FurPangolin,
    length: 0.95,
    height: 0.4,
    width: 0.42,
    headSize: 0.3,
    legLength: 0.16,
    tail: 0.9,
    // Dark plates over the light hide: the armour is what makes it a pangolin.
    scales: Palette.FurPangolinDark,
    speed: 0.9,
    swing: 0.4,
    cadence: 2.2,
  }),
  shinyCapybara: quadruped({
    id: 'shinyCapybara',
    label: 'Golden capybara',
    fur: Palette.FurCapybaraGold,
    belly: Palette.FurCapybaraGold,
    snout: Palette.FurCapybaraGold,
    length: 1.5,
    height: 0.75,
    width: 0.7,
    headSize: 0.6,
    legLength: 0.32,
    speed: 1.4,
    cadence: 1.4,
  }),
  orangutan: ape({
    id: 'orangutan',
    label: 'Orangutan',
    fur: Palette.FurOrangutan,
    bare: Palette.ApeGrey,
    // Big: it should read as the largest thing on four or two legs out here.
    height: 2.05,
    speed: 1.1,
    cadence: 1.1,
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
  digger: biped({
    id: 'digger',
    label: 'Excavation crew',
    cloth: Palette.HiVis,
    hat: Palette.ClothWorker,
    height: 1.7,
    speed: 1.6,
    tool: 'shovel',
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
