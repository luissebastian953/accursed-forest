import { Group, Mesh, type Material, type Object3D, type OrthographicCamera } from 'three/webgpu';

import type { GroundRect } from '@render/camera/MapRig';
import { BoxBuilder } from '@render/geometry/boxBuilder';
import {
  FOREST_SPECIES,
  buildForestTreeGeometry,
  buildSaplingGeometry,
  buildShrubGeometry,
} from '@render/geometry/forestTree';
import { PALM_STAGES, buildPalmGeometry, buildStumpGeometry } from '@render/geometry/palm';
import { Palette } from '@render/materials/paletteSlots';
import { MobField } from '@render/mobs/MobField';
import { SPECIES_IDS, SPECIES } from '@render/mobs/species';
import { MODELS, ModelKit, type ModelId } from '@render/models/index';
import { Clouds } from '@render/scene/Clouds';
import { Coins } from '@render/scene/Coins';
import {
  buildGuardPostGeometry,
  buildKopdesGeometry,
  type KopdesLevel,
} from '@render/scene/Kopdes';
import { Skulls } from '@render/scene/Skulls';
import { Sparkles } from '@render/scene/Sparkles';

/** The shared vocabulary of things a subject may be able to do. */
export const ACTIONS = [
  'walk',
  'idle',
  'sit',
  'climb',
  'sleep',
  'rear',
  'work',
  'burst',
  'reset',
] as const;
export type ActionId = (typeof ACTIONS)[number];

export interface SubjectContext {
  /** The world material: everything in the game is drawn with it. */
  material: Material;
  /** The see-through one, for ghosts, glints and clouds. */
  spectral: Material;
  /** The barely see-through one, for a body rather than an apparition. */
  shrouded: Material;
  /** Ground height under a point, which on the bench is always flat. */
  groundAt: (x: number, z: number) => number;
  /** The stage camera, for the few effects that are placed against the view. */
  camera: OrthographicCamera;
  /** What the camera can see, in world units. */
  view: GroundRect;
}

export interface SubjectHandle {
  /** What to add to the scene. */
  object: Object3D;
  /** Stepped every frame while this subject is on the bench. */
  update?: (dtSeconds: number, nowMs: number) => void;
  /** What this one can be asked to do; anything missing greys its button out. */
  actions?: Partial<Record<ActionId, () => void>>;
  dispose: () => void;
}

export interface Subject {
  id: string;
  label: string;
  /** How the panel groups them. */
  group: 'Scenery' | 'Plants' | 'Mobs' | 'Effects';
  build: (ctx: SubjectContext) => SubjectHandle;
}

/** A plain mesh subject: geometry in, nothing to drive. */
function meshSubject(
  id: string,
  label: string,
  group: Subject['group'],
  geometry: (ctx: SubjectContext) => Mesh,
): Subject {
  return {
    id,
    label,
    group,
    build(ctx) {
      const mesh = geometry(ctx);

      return {
        object: mesh,
        dispose: () => mesh.geometry.dispose(),
      };
    },
  };
}

/** Scenery models, drawn the way `props.ts` draws them, three to a subject. */
function modelSubject(id: ModelId): Subject {
  return meshSubject(`model:${id}`, MODELS[id].name, 'Scenery', (ctx) => {
    const builder = new BoxBuilder();
    const kit = new ModelKit(builder);

    for (let v = 0; v < 3; v++) {
      let n = (v + 1) * 7919;
      const rand = (): number => (n = (n * 1103515245 + 12345) % 2147483648) / 2147483648;

      kit.at({ x: (v - 1) * 4.5, y: 0, z: 0, scale: 1, turn: v * 0.9 });
      MODELS[id].build(kit, rand);
    }

    return new Mesh(builder.build(), ctx.material);
  });
}

/** One mob, on its own, with every state the rig knows how to hold. */
function mobSubject(id: string): Subject {
  return {
    id: `mob:${id}`,
    label: SPECIES[id]?.label ?? id,
    group: 'Mobs',
    build(ctx) {
      const field = new MobField({
        material: ctx.material,
        spectralMaterial: ctx.spectral,
        denseMaterial: ctx.shrouded,
        bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 },
        groundAt: ctx.groundAt,
      });
      // One sim-shaped mob, driven from here rather than from a simulation.
      const mob = field.addBenchMob(id);
      const set = (wants: Partial<Record<'sleep' | 'crouch' | 'work' | 'sit' | 'climb', number>>) =>
        field.setBenchWants(mob, wants);

      // A bare trunk, shown only while the mob climbs: a whole tree would hide the thing on show.
      const trunk = new BoxBuilder();

      // Set back a little, so the climber is seen from the front rather than
      // through the bark.
      trunk.addAABox(0, 3.6, -0.6, 0.7, 7.2, 0.7, { side: Palette.PalmTrunk });

      const tree = new Mesh(trunk.build(), ctx.material);

      tree.visible = false;

      const group = new Group();

      group.add(field.group, tree);

      const down = (): void => {
        tree.visible = false;
      };

      return {
        object: group,
        update: (dt) => field.update(dt, 1),
        actions: {
          walk: () => {
            down();
            set({ climb: 0, sit: 0, sleep: 0 });
            field.setBenchWalking(mob, true);
          },
          idle: () => {
            down();
            field.setBenchWalking(mob, false);
            set({ sleep: 0, crouch: 0, work: 0, sit: 0, climb: 0 });
          },
          sit: () => {
            down();
            field.setBenchWalking(mob, false);
            set({ sit: 1, sleep: 0, climb: 0 });
          },
          climb: () => {
            field.setBenchWalking(mob, false);
            field.placeBenchMob(mob, 0, 0);
            tree.visible = true;
            set({ climb: 1, sit: 0, sleep: 0 });
          },
          sleep: () => {
            down();
            field.setBenchWalking(mob, false);
            set({ sleep: 1, sit: 0, climb: 0 });
          },
          rear: () => field.setBenchStanding(mob, true),
          work: () => set({ work: 1 }),
          reset: () => {
            down();
            field.setBenchWalking(mob, false);
            field.setBenchStanding(mob, false);
            field.placeBenchMob(mob, 0, 0);
            set({ sleep: 0, crouch: 0, work: 0, sit: 0, climb: 0 });
          },
        },
        dispose: () => {
          tree.geometry.dispose();
          field.dispose();
        },
      };
    },
  };
}

/** The sky, brought down to the size of the bench. */
const CLOUD_STAGE_SCALE = 0.06;

export const SUBJECTS: readonly Subject[] = [
  // ── Plants ──────────────────────────────────────────────────────────────
  ...PALM_STAGES.map((stage) =>
    meshSubject(
      `palm:${stage}`,
      `Palm, ${stage}`,
      'Plants',
      (ctx) => new Mesh(buildPalmGeometry(stage), ctx.material),
    ),
  ),
  meshSubject(
    'palm:sick',
    'Palm, sick',
    'Plants',
    (ctx) => new Mesh(buildPalmGeometry('mature', 'sick'), ctx.material),
  ),
  meshSubject(
    'palm:stump',
    'Palm stump',
    'Plants',
    (ctx) => new Mesh(buildStumpGeometry(), ctx.material),
  ),
  meshSubject(
    'forest:sapling',
    'Forest sapling',
    'Plants',
    (ctx) => new Mesh(buildSaplingGeometry('a'), ctx.material),
  ),
  meshSubject(
    'forest:shrub',
    'Undergrowth',
    'Plants',
    (ctx) => new Mesh(buildShrubGeometry('a'), ctx.material),
  ),
  ...FOREST_SPECIES.map((species) =>
    meshSubject(
      `forest:${species}`,
      `Forest tree, ${species}`,
      'Plants',
      (ctx) => new Mesh(buildForestTreeGeometry(species), ctx.material),
    ),
  ),

  // ── Scenery ─────────────────────────────────────────────────────────────
  ...([1, 2, 3, 4] as KopdesLevel[]).map((level) =>
    meshSubject(
      `kopdes:${level}`,
      `Kopdes, level ${level}`,
      'Scenery',
      (ctx) => new Mesh(buildKopdesGeometry(level), ctx.material),
    ),
  ),
  meshSubject(
    'kopdes:guard',
    'Guard post',
    'Scenery',
    (ctx) => new Mesh(buildGuardPostGeometry(), ctx.material),
  ),
  ...(Object.keys(MODELS) as ModelId[]).map(modelSubject),

  // ── Mobs ────────────────────────────────────────────────────────────────
  ...SPECIES_IDS.map(mobSubject),

  // ── Effects ─────────────────────────────────────────────────────────────
  {
    id: 'fx:coins',
    label: 'Gold coins',
    group: 'Effects',
    build(ctx) {
      const coins = new Coins(ctx.material);
      const group = new Group();

      group.add(coins.mesh);
      coins.burst(0, 1, 0, 12);
      return {
        object: group,
        update: (dt) => coins.update(dt),
        actions: {
          burst: () => coins.burst(0, 1, 0, 12),
          reset: () => coins.clear(),
        },
        dispose: () => coins.dispose(),
      };
    },
  },
  {
    id: 'fx:skulls',
    label: 'Skull, burned alive',
    group: 'Effects',
    build(ctx) {
      const skulls = new Skulls(ctx.spectral);
      const group = new Group();

      group.add(skulls.mesh);
      skulls.raise(0, 0, 0);
      return {
        object: group,
        update: (dt) => skulls.update(dt, ctx.camera),
        actions: {
          burst: () => skulls.raise(0, 0, 0),
          reset: () => skulls.clear(),
        },
        dispose: () => skulls.dispose(),
      };
    },
  },
  {
    id: 'fx:sparkles',
    label: 'Sparkles',
    group: 'Effects',
    build(ctx) {
      const sparkles = new Sparkles(ctx.spectral);
      const group = new Group();

      group.add(sparkles.mesh);
      return {
        object: group,
        update: (_dt, nowMs) => sparkles.update([{ x: 0, y: 0, z: 0 }], nowMs),
        dispose: () => sparkles.dispose(),
      };
    },
  },
  {
    id: 'fx:clouds',
    label: 'Clouds',
    group: 'Effects',
    build(ctx) {
      const clouds = new Clouds(ctx.spectral);
      const group = new Group();

      group.add(clouds.mesh);
      // They fly 60 units up over a 320-unit tile: at estate scale they would
      // fill the stage, so the whole sky is shrunk onto the plinth.
      group.scale.setScalar(CLOUD_STAGE_SCALE);
      return {
        object: group,
        update: (dt) => clouds.update(dt, ctx.camera, ctx.view),
        dispose: () => clouds.dispose(),
      };
    },
  },
];

export const SUBJECT_GROUPS = ['Plants', 'Scenery', 'Mobs', 'Effects'] as const;
