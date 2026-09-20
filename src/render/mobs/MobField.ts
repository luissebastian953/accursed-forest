import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { Mob as SimMob, SimState } from '@sim/types';

import { BoxBuilder } from '../geometry/boxBuilder.ts';
import { Palette } from '../materials/paletteSlots.ts';

import { partGeometry, partOrder, pose, type PoseInput, type SpeciesSpec } from './rig.ts';
import { SPECIES, type SpeciesId } from './species.ts';

export type MobMode = 'nodes' | 'merged';

export interface MobFieldOptions {
  material: Material;
  /** Ghosts need their own, see-through material. */
  spectralMaterial: Material;
  /** Where the POC's wanderers may roam, in world units. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Ground height under a point, in world units. */
  groundAt(x: number, z: number): number;
}

interface Mob {
  /** Sim id, or negative for the POC's own. */
  id: number;
  species: SpeciesSpec;
  x: number;
  z: number;
  facing: number;
  /** Where it is heading. */
  targetX: number;
  targetZ: number;
  /** Seconds left standing still (POC wanderers). */
  rest: number;
  phase: number;
  age: number;
  gait: number;
  /** How far reared up, 0..1. */
  stand: number;
  /** Sim-driven mobs glide; POC mobs walk at their species' speed. */
  glide: boolean;
  /** What the sim says it is doing, and how far the body has got there (0..1 each). */
  wants: { sleep: number; crouch: number; work: number; sit: number; climb: number };
  sleep: number;
  crouch: number;
  work: number;
  sit: number;
  /** How far up a trunk the body has climbed, 0..1; the lift is applied here. */
  climb: number;
  /** World-unit height of the body's top, for the Zs. */
  crown: number;
  /** 1 normally; counts down to 0 while the mob fades out of the world. */
  fade: number;
  /** Seconds left of a run before the fade starts; 0 when it is not bolting. */
  bolting: number;
  /** `nodes` mode only: the part nodes, parent-first. */
  nodes?: Object3D[];
}

/** A part's box as flat arrays, ready to be transformed into the shared buffer. */
interface PartArrays {
  positions: Float32Array;
  normals: Float32Array;
  paletteU: Float32Array;
  vertices: number;
}

/** One dynamic mesh: all the mobs sharing a material. */
class Sheet {
  readonly mesh: Mesh;
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private paletteU = new Float32Array(0);
  /** Vertices written this frame. */
  used = 0;

  constructor(material: Material) {
    this.mesh = new Mesh(new BufferGeometry(), material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.visible = false;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  /** Make room for `vertices`; the buffers grow in steps so a new arrival rarely reallocates. */
  reserve(vertices: number): void {
    if (vertices <= this.positions.length / 3) return;

    const size = Math.max(4096, 1 << Math.ceil(Math.log2(vertices)));

    this.positions = new Float32Array(size * 3);
    this.normals = new Float32Array(size * 3);
    this.paletteU = new Float32Array(size);

    const geometry = this.mesh.geometry;

    geometry.dispose();

    const next = new BufferGeometry();
    // `BufferAttribute`, not `Float32BufferAttribute`: the latter copies the
    // array it is given, and these must stay the very arrays `append` writes.
    const attribute = (array: Float32Array, itemSize: number) => {
      const a = new BufferAttribute(array, itemSize);

      a.setUsage(DynamicDrawUsage);
      return a;
    };

    next.setAttribute('position', attribute(this.positions, 3));
    next.setAttribute('normal', attribute(this.normals, 3));
    next.setAttribute('paletteU', attribute(this.paletteU, 1));
    this.mesh.geometry = next;
  }

  begin(): void {
    this.used = 0;
  }

  /** Append a part's box under a world matrix. */
  append(part: PartArrays, m: Matrix4): void {
    if ((this.used + part.vertices) * 3 > this.positions.length) return;

    const e = m.elements;
    const p = this.positions;
    const n = this.normals;
    const src = part.positions;
    const srcN = part.normals;
    let o = this.used * 3;

    for (let i = 0; i < src.length; i += 3) {
      const x = src[i]!;
      const y = src[i + 1]!;
      const z = src[i + 2]!;

      p[o] = e[0]! * x + e[4]! * y + e[8]! * z + e[12]!;
      p[o + 1] = e[1]! * x + e[5]! * y + e[9]! * z + e[13]!;
      p[o + 2] = e[2]! * x + e[6]! * y + e[10]! * z + e[14]!;

      const nx = srcN[i]!;
      const ny = srcN[i + 1]!;
      const nz = srcN[i + 2]!;
      // The rig's matrices are rotations, translations and mild scales, so the
      // upper-left 3×3 does for normals once renormalised.
      const wx = e[0]! * nx + e[4]! * ny + e[8]! * nz;
      const wy = e[1]! * nx + e[5]! * ny + e[9]! * nz;
      const wz = e[2]! * nx + e[6]! * ny + e[10]! * nz;
      const len = Math.hypot(wx, wy, wz) || 1;

      n[o] = wx / len;
      n[o + 1] = wy / len;
      n[o + 2] = wz / len;
      o += 3;
    }

    this.paletteU.set(part.paletteU, this.used);
    this.used += part.vertices;
  }

  end(): void {
    const geometry = this.mesh.geometry;

    geometry.setDrawRange(0, this.used);
    // An empty sheet stays out of the render list, so its program is not
    // compiled until something actually needs it (the ghost's, possibly never).
    this.mesh.visible = this.used > 0;
    if (this.used === 0) return;

    for (const name of ['position', 'normal', 'paletteU'] as const) {
      const attribute = geometry.getAttribute(name) as BufferAttribute;

      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.used * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

const _local = new Matrix4();
const _facing = new Matrix4();
const _at = new Vector3();
const _size = new Vector3();
const _spin = new Quaternion();
const _up = new Vector3(0, 1, 0);
/** Seconds a mob takes to fade out of the world when something makes it vanish. */
const FADE_SECONDS = 0.7;
const _root = new Matrix4();
/** Scratch world matrices, one per part; no rig is anywhere near this deep. */
const _worlds = Array.from({ length: 64 }, () => new Matrix4());

/**
 * How the sim's species are drawn: the babi ngepet passes for a pig on all
 * fours, and a crew carries an axe on a chop and a flamethrower on a burn.
 */
function drawnAs(mob: SimMob, state: SimState): SpeciesId {
  if (mob.species === 'babiNgepet' && !mob.standing) return 'pig';
  if (mob.species === 'capybara' && mob.shiny) return 'shinyCapybara';

  if (mob.species === 'crew') {
    const block = mob.target === null ? undefined : state.blocks.get(mob.target);

    if (block && block.excavateUntil > state.tick) return 'digger';
    return block?.burning ? 'burner' : 'chopper';
  }

  return mob.species;
}

/** What the body should be doing for a sim intent. */
function wantsFor(mob: SimMob): Mob['wants'] {
  const thief = mob.species === 'thief';
  const climbing = mob.intent === 'climb' || mob.intent === 'climbJump';

  return {
    sleep: mob.intent === 'sleep' ? 1 : 0,
    crouch:
      thief && (mob.intent === 'hide' || mob.intent === 'raid' || mob.intent === 'flee') ? 1 : 0,
    work: mob.intent === 'work' ? (mob.species === 'crew' ? 1 : 0.6) : 0,
    sit: mob.intent === 'sit' ? 1 : 0,
    climb: climbing ? Math.max(0, Math.min(1, mob.climb)) : 0,
  };
}

/** How tall a species stands, for floating things above it. */
function crownOf(spec: SpeciesSpec): number {
  let top = 0;

  for (const part of spec.parts) {
    if (part.parent !== undefined && part.parent !== 'body') continue;
    top = Math.max(
      top,
      part.at[1] + part.size[1] / 2 + (part.parent === 'body' ? spec.parts[0]!.at[1] : 0),
    );
  }

  return top;
}

/** A "Z", three thin bars, about 0.5 units tall; three of them drift up from a sleeper. */
function zGeometry(): PartArrays {
  const b = new BoxBuilder();
  const slot = Palette.Ghost;

  b.addAABox(0, 0.42, 0, 0.36, 0.08, 0.08, { side: slot });
  b.addAABox(0, 0, 0, 0.36, 0.08, 0.08, { side: slot });

  const m = new Matrix4().makeRotationZ(0.86).setPosition(0, 0.21, 0);

  b.addBox(m.multiply(new Matrix4().makeScale(0.08, 0.5, 0.08)), { side: slot });

  const geometry = b.build();
  const positions = geometry.getAttribute('position').array as Float32Array;

  return {
    positions,
    normals: geometry.getAttribute('normal').array as Float32Array,
    paletteU: geometry.getAttribute('paletteU').array as Float32Array,
    vertices: positions.length / 3,
  };
}

/** World units from the ground to the canopy a climber settles in. */
const CANOPY_LIFT = 4.2;
const Z_COUNT = 3;
const Z_PERIOD = 2.4;
const _zMatrix = new Matrix4();
const _zScale = new Vector3();
const _zPos = new Vector3();
const _zQuat = new Quaternion();
const _zEuler = new Euler();

export class MobField {
  readonly group = new Group();
  private readonly mobs: Mob[] = [];
  private readonly byId = new Map<number, Mob>();
  private readonly geometry = new Map<string, BufferGeometry[]>();
  private readonly arrays = new Map<string, PartArrays[]>();
  private readonly orders = new Map<string, ReturnType<typeof partOrder>>();
  private readonly solid: Sheet;
  private readonly spectral: Sheet;
  /** Mobs that have bolted out of sight and must not be drawn again. */
  private readonly fled = new Set<number>();
  private readonly z = zGeometry();
  private mode: MobMode = 'merged';
  private nextPocId = -1;
  /** Milliseconds the last update spent posing mobs. */
  lastUpdateMs = 0;

  constructor(private readonly options: MobFieldOptions) {
    this.solid = new Sheet(options.material);
    this.spectral = new Sheet(options.spectralMaterial);
    this.group.add(this.solid.mesh, this.spectral.mesh);
  }

  get count(): number {
    return this.mobs.length;
  }

  get renderMode(): MobMode {
    return this.mode;
  }

  setMode(mode: MobMode): void {
    if (mode === this.mode) return;
    this.mode = mode;

    const again = this.mobs.map((m) => m.species.id as SpeciesId);

    this.clear();
    for (const id of again) this.spawn(id);

    if (mode === 'nodes') {
      this.solid.begin();
      this.solid.end();
      this.spectral.begin();
      this.spectral.end();
    }
  }

  // ── Geometry ───────────────────────────────────────────────────────────

  private partsOf(spec: SpeciesSpec): BufferGeometry[] {
    let parts = this.geometry.get(spec.id);

    if (!parts) {
      parts = spec.parts.map((part) => partGeometry(part));
      this.geometry.set(spec.id, parts);
    }

    return parts;
  }

  private arraysOf(spec: SpeciesSpec): PartArrays[] {
    let arrays = this.arrays.get(spec.id);

    if (!arrays) {
      arrays = this.partsOf(spec).map((geometry) => {
        const positions = geometry.getAttribute('position').array as Float32Array;

        return {
          positions,
          normals: geometry.getAttribute('normal').array as Float32Array,
          paletteU: geometry.getAttribute('paletteU').array as Float32Array,
          vertices: positions.length / 3,
        };
      });
      this.arrays.set(spec.id, arrays);
    }

    return arrays;
  }

  private orderOf(spec: SpeciesSpec) {
    let order = this.orders.get(spec.id);

    if (!order) {
      order = partOrder(spec);
      this.orders.set(spec.id, order);
    }

    return order;
  }

  private attach(mob: Mob): void {
    if (this.mode === 'nodes') {
      const spec = mob.species;
      const material = spec.spectral ? this.options.spectralMaterial : this.options.material;
      const parts = this.partsOf(spec);
      const nodes = parts.map((geometry) => new Mesh(geometry, material) as Object3D);

      spec.parts.forEach((part, i) => {
        const node = nodes[i]!;

        if (part.parent === undefined) this.group.add(node);
        else nodes[spec.parts.findIndex((p) => p.name === part.parent)]!.add(node);
      });
      mob.nodes = nodes;
    }

    this.mobs.push(mob);
    this.byId.set(mob.id, mob);
  }

  /** Where a mob is being drawn, for an effect that lands on it. */
  positionOf(id: number): { x: number; y: number; z: number } | null {
    const mob = this.byId.get(id);

    return mob ? { x: mob.x, y: this.options.groundAt(mob.x, mob.z), z: mob.z } : null;
  }

  /** Shrink a mob out of the world over the next moment, then drop it. */
  vanish(id: number): void {
    const mob = this.byId.get(id);

    if (mob && mob.fade >= 1) mob.fade = 0.999;
  }

  /** Bolt for a moment, then fade where it got to; the sim may keep walking it, unseen. */
  flee(id: number, seconds = 0.9): void {
    const mob = this.byId.get(id);

    if (!mob || mob.bolting > 0 || mob.fade < 1) return;
    mob.bolting = seconds;
    // It does not come back, whatever the sim does with it afterwards.
    this.fled.add(id);
  }

  private detach(mob: Mob): void {
    if (mob.nodes) for (const node of mob.nodes) node.removeFromParent();

    const i = this.mobs.indexOf(mob);

    if (i >= 0) this.mobs.splice(i, 1);
    this.byId.delete(mob.id);
  }

  // ── The workbench ───────────────────────────────────────────────────────

  /**
   * One mob of a species, standing at the origin and driven by hand: the
   * workbench has no simulation to take its orders from. Returns its id.
   */
  addBenchMob(species: SpeciesId): number {
    const spec = SPECIES[species];

    if (!spec) throw new Error(`no such species: ${species}`);

    const id = this.nextPocId--;

    this.attach({
      id,
      species: spec,
      x: 0,
      z: 0,
      facing: Math.PI * 0.75,
      targetX: 0,
      targetZ: 0,
      rest: 0,
      phase: 0,
      age: 0,
      gait: 0,
      stand: 0,
      glide: true,
      wants: { sleep: 0, crouch: 0, work: 0, sit: 0, climb: 0 },
      sleep: 0,
      crouch: 0,
      work: 0,
      sit: 0,
      climb: 0,
      crown: crownOf(spec),
      fade: 1,
      bolting: 0,
    });
    return id;
  }

  /** On the bench: what the body should be doing. */
  setBenchWants(id: number, wants: Partial<Mob['wants']>): void {
    const mob = this.byId.get(id);

    if (mob) mob.wants = { ...mob.wants, ...wants };
  }

  /** On the bench: wandering inside the bench's bounds, or standing still. */
  setBenchWalking(id: number, walking: boolean): void {
    const mob = this.byId.get(id);

    if (!mob) return;
    mob.glide = false;

    if (walking) {
      // Rest spent and a target in reach: the wander picks the next one itself,
      // always inside the bench, so it never walks out of frame.
      const { bounds } = this.options;

      mob.rest = 0;
      mob.targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
      mob.targetZ = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    } else {
      mob.rest = Number.POSITIVE_INFINITY;
      mob.targetX = mob.x;
      mob.targetZ = mob.z;
    }
  }

  /** On the bench: put it back where it started. */
  placeBenchMob(id: number, x: number, z: number): void {
    const mob = this.byId.get(id);

    if (!mob) return;
    mob.x = x;
    mob.z = z;
    mob.targetX = x;
    mob.targetZ = z;
    mob.gait = 0;
  }

  /** On the bench: reared up on the hind legs. */
  setBenchStanding(id: number, standing: boolean): void {
    const mob = this.byId.get(id);

    if (mob) mob.stand = standing ? 1 : 0;
  }

  // ── The POC's wanderers ────────────────────────────────────────────────

  spawn(id: SpeciesId): void {
    const spec = SPECIES[id]!;
    const { bounds } = this.options;
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);

    this.attach({
      id: this.nextPocId--,
      species: spec,
      x,
      z,
      facing: Math.random() * Math.PI * 2,
      targetX: x,
      targetZ: z,
      rest: Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      age: Math.random() * 10,
      gait: 0,
      stand: 0,
      glide: false,
      wants: { sleep: 0, crouch: 0, work: 0, sit: 0, climb: 0 },
      sleep: 0,
      crouch: 0,
      work: 0,
      sit: 0,
      climb: 0,
      crown: crownOf(spec),
      fade: 1,
      bolting: 0,
    });
  }

  clear(): void {
    for (const mob of [...this.mobs]) this.detach(mob);
  }

  // ── The game's mobs ────────────────────────────────────────────────────

  /** Read the sim's mobs: new ones appear where they are, gone ones vanish, the rest get a new target. */
  syncSim(state: SimState): void {
    const seen = new Set<number>();
    const side = WORLD.blockSide;

    for (const sim of state.mobs) {
      seen.add(sim.id);
      // One that bolted stays gone, even though the sim is still walking it
      // to the edge of the map.
      if (this.fled.has(sim.id)) continue;

      const spec = SPECIES[drawnAs(sim, state)]!;
      let mob = this.byId.get(sim.id);

      if (mob && mob.species !== spec) {
        // The babi ngepet stood up: same mob, different body.
        this.detach(mob);
        mob = undefined;
      }

      if (!mob) {
        mob = {
          id: sim.id,
          species: spec,
          x: sim.x * side,
          z: sim.z * side,
          facing: Math.atan2(sim.tx - sim.x, sim.tz - sim.z),
          targetX: sim.x * side,
          targetZ: sim.z * side,
          rest: 0,
          phase: sim.phase * Math.PI * 2,
          age: sim.phase * 10,
          gait: 0,
          stand: sim.standing ? 1 : 0,
          glide: true,
          wants: wantsFor(sim),
          sleep: 0,
          crouch: 0,
          work: 0,
          sit: 0,
          climb: 0,
          crown: crownOf(spec),
          fade: 1,
          bolting: 0,
        };
        this.attach(mob);
      }

      mob.targetX = sim.x * side;
      mob.targetZ = sim.z * side;
      mob.stand = sim.standing ? 1 : 0;
      mob.wants = wantsFor(sim);
    }

    for (const mob of [...this.mobs]) {
      // A mob the sim has dropped goes at once, unless it is still fading out.
      if (mob.id > 0 && !seen.has(mob.id) && mob.fade >= 1) this.detach(mob);
    }

    // Once the sim has let one go, it can be forgotten here too.
    for (const id of [...this.fled]) if (!seen.has(id)) this.fled.delete(id);
  }

  // ── Per frame ──────────────────────────────────────────────────────────

  /**
   * @param tickSeconds the sim day's length in real time: a sim-driven mob spreads its walk
   *   over it instead of dashing it and then standing still.
   */
  update(dtSeconds: number, tickSeconds = 0.5): void {
    const started = performance.now();
    const tick = Number.isFinite(tickSeconds) && tickSeconds > 0 ? tickSeconds : 10;
    const { bounds, groundAt } = this.options;

    if (this.mode === 'merged') {
      let solid = 0;
      let spectral = 0;

      for (const mob of this.mobs) {
        const vertices = this.arraysOf(mob.species).reduce((sum, p) => sum + p.vertices, 0);

        if (mob.species.spectral) spectral += vertices;
        else solid += vertices;
        if (mob.sleep > 0 || mob.wants.sleep > 0) spectral += this.z.vertices * Z_COUNT;
      }

      this.solid.reserve(solid);
      this.spectral.reserve(spectral);
      this.solid.begin();
      this.spectral.begin();
    }

    for (const mob of this.mobs) {
      mob.age += dtSeconds;

      const dx = mob.targetX - mob.x;
      const dz = mob.targetZ - mob.z;
      const distance = Math.hypot(dx, dz);

      // Ease the body into what the sim says it is doing: lying down takes a
      // moment, standing up from a crouch is quicker.
      mob.sleep += (mob.wants.sleep - mob.sleep) * Math.min(1, dtSeconds * 1.5);
      mob.crouch += (mob.wants.crouch - mob.crouch) * Math.min(1, dtSeconds * 4);
      mob.work += (mob.wants.work - mob.work) * Math.min(1, dtSeconds * 3);
      mob.sit += (mob.wants.sit - mob.sit) * Math.min(1, dtSeconds * 2.5);

      if (mob.bolting > 0) {
        mob.bolting -= dtSeconds;
        if (mob.bolting <= 0) mob.fade = 0.999;
      }

      if (mob.fade < 1) {
        mob.fade -= dtSeconds / FADE_SECONDS;

        if (mob.fade <= 0) {
          this.detach(mob);
          continue;
        }
      }

      // Up and down a trunk is a climb, not a jump cut.
      mob.climb += (mob.wants.climb - mob.climb) * Math.min(1, dtSeconds * 0.9);

      if (mob.glide) {
        // Sim-driven: spread the gap over the rest of the day, so a slow day is a slow walk;
        // past the species' pace only when the clock has run ahead of the legs.
        if (distance > 0.05 && mob.wants.sleep === 0) {
          const pace = mob.species.speed;
          const speed = Math.max(pace * 0.15, Math.min(pace, (distance / tick) * 1.15));
          const step = Math.min(distance, Math.max(speed, distance * 1.5) * dtSeconds);

          mob.x += (dx / distance) * step;
          mob.z += (dz / distance) * step;
          mob.facing = Math.atan2(dx, dz);

          const gait = Math.min(1, step / dtSeconds / pace);

          mob.gait += (gait - mob.gait) * Math.min(1, dtSeconds * 5);
        } else {
          mob.gait += (0 - mob.gait) * Math.min(1, dtSeconds * 4);
        }
      } else if (mob.rest > 0) {
        mob.rest -= dtSeconds;
        mob.gait += (0 - mob.gait) * Math.min(1, dtSeconds * 6);
      } else if (distance < 0.6) {
        mob.rest = 1 + Math.random() * 3;
        mob.targetX = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        mob.targetZ = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
      } else {
        const speed = mob.species.speed;

        mob.x += (dx / distance) * speed * dtSeconds;
        mob.z += (dz / distance) * speed * dtSeconds;
        mob.facing = Math.atan2(dx, dz);
        mob.gait += (1 - mob.gait) * Math.min(1, dtSeconds * 4);

        // The POC's babi ngepet rears up now and then, and walks on like that.
        if (mob.species.id === 'babiNgepet') {
          const wants = Math.sin(mob.age * 0.35 + mob.phase) > 0.2 ? 1 : 0;

          mob.stand += (wants - mob.stand) * Math.min(1, dtSeconds * 2);
        }
      }

      const y = groundAt(mob.x, mob.z) + mob.climb * CANOPY_LIFT;
      const input: PoseInput = {
        time: mob.age,
        gait: mob.gait,
        phase: mob.phase,
        stand: mob.stand,
        sleep: mob.sleep,
        crouch: mob.crouch,
        work: mob.work,
        sit: mob.sit,
        climb: mob.climb,
      };

      _facing.compose(
        _at.set(mob.x, y, mob.z),
        _spin.setFromAxisAngle(_up, mob.facing),
        _size.setScalar(mob.fade),
      );

      if (mob.nodes) {
        const parts = mob.species.parts;

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]!;

          pose(mob.species, part, input, _local);

          const node = mob.nodes[i]!;

          node.matrixAutoUpdate = false;
          if (part.parent === undefined) node.matrix.copy(_root.multiplyMatrices(_facing, _local));
          else node.matrix.copy(_local);
          node.matrixWorldNeedsUpdate = true;
        }

        continue;
      }

      const sheet = mob.species.spectral ? this.spectral : this.solid;
      const order = this.orderOf(mob.species);
      const arrays = this.arraysOf(mob.species);

      for (let i = 0; i < order.length; i++) {
        const { part, parent } = order[i]!;

        pose(mob.species, part, input, _local);

        const world = _worlds[i]!;

        if (parent < 0) world.multiplyMatrices(_facing, _local);
        else world.multiplyMatrices(_worlds[parent]!, _local);
        sheet.append(arrays[i]!, world);
      }

      if (mob.sleep > 0.5) this.appendZs(mob, y);
    }

    if (this.mode === 'merged') {
      this.solid.end();
      this.spectral.end();
    }

    this.lastUpdateMs = performance.now() - started;
  }

  /** Three Zs rising and growing from the sleeper's head, staggered, on a loop. */
  private appendZs(mob: Mob, groundY: number): void {
    const base = groundY + mob.species.parts[0]!.size[0] / 2 + 0.3;

    for (let i = 0; i < Z_COUNT; i++) {
      const t = (((mob.age / Z_PERIOD + i / Z_COUNT + mob.phase) % 1) + 1) % 1;
      const scale = (0.35 + t * 0.9) * mob.sleep;
      const drift = Math.sin(t * Math.PI * 2 + i) * 0.25;

      _zPos.set(mob.x + 0.4 + drift, base + t * 1.6, mob.z + 0.2 + i * 0.12);
      _zEuler.set(0, mob.facing + 0.8 + t * 0.6, 0);
      _zQuat.setFromEuler(_zEuler);
      _zScale.set(scale, scale, scale);
      _zMatrix.compose(_zPos, _zQuat, _zScale);
      this.spectral.append(this.z, _zMatrix);
    }
  }

  dispose(): void {
    this.clear();
    for (const parts of this.geometry.values()) for (const geometry of parts) geometry.dispose();
    this.geometry.clear();
    this.arrays.clear();
    this.solid.dispose();
    this.spectral.dispose();
  }
}
