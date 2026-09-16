/**
 * A crowd of mobs, drawn two ways (POC).
 *
 * The behaviour is deliberately simple: pick a spot, walk to it, pause, pick
 * another; a thief walks at the Kopdes instead. What the prototype is really
 * measuring is the cost of drawing and animating them:
 *
 *   - `nodes`: one `Object3D` per part. three.js walks the tree and issues a
 *     draw call per part — the way you would write it first, and the way that
 *     falls over with a crowd.
 *   - `instanced`: one `InstancedMesh` per species part. The rig composes the
 *     matrices here and writes them into the instance buffers, so a hundred
 *     boars cost one draw call per part rather than a hundred.
 *
 * Both run the same rig, so the comparison is honest.
 */

import type { Object3D } from 'three/webgpu';
import { Group, InstancedMesh, Matrix4, Mesh, type Material } from 'three/webgpu';

import { partGeometry, partOrder, pose, type PoseInput, type SpeciesSpec } from './rig.ts';
import { SPECIES, type SpeciesId } from './species.ts';

export type MobMode = 'nodes' | 'instanced';

export interface MobFieldOptions {
  material: Material;
  /** Ghosts need their own, see-through material. */
  spectralMaterial: Material;
  /** Where mobs may wander, in world units. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Ground height under a point. */
  groundAt(x: number, z: number): number;
  /** Instance capacity per species part. */
  capacity?: number;
}

interface Mob {
  species: SpeciesSpec;
  x: number;
  z: number;
  facing: number;
  /** Where it is heading. */
  targetX: number;
  targetZ: number;
  /** Seconds left standing still. */
  rest: number;
  phase: number;
  age: number;
  gait: number;
  /** How far reared up, 0..1; only the babi ngepet does this. */
  stand: number;
  /** `nodes` mode only: the part nodes, parent-first. */
  nodes?: Object3D[];
}

interface Slot {
  meshes: InstancedMesh[];
  count: number;
}

const _local = new Matrix4();
const _facing = new Matrix4();
const _root = new Matrix4();
/** Scratch world matrices, one per part; no rig is anywhere near this deep. */
const _worlds = Array.from({ length: 64 }, () => new Matrix4());

export class MobField {
  readonly group = new Group();
  private readonly mobs: Mob[] = [];
  private readonly slots = new Map<string, Slot>();
  private readonly geometry = new Map<string, ReturnType<typeof partGeometry>[]>();
  private readonly orders = new Map<string, ReturnType<typeof partOrder>>();
  private readonly capacity: number;
  private mode: MobMode = 'instanced';
  /** Milliseconds the last update spent posing mobs. */
  lastUpdateMs = 0;

  constructor(private readonly options: MobFieldOptions) {
    this.capacity = options.capacity ?? 512;
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
    const species = this.mobs.map((m) => m.species.id as SpeciesId);
    this.clear();
    for (const id of species) this.spawn(id);
  }

  /** Geometry for a species' parts, built once. */
  private partsOf(spec: SpeciesSpec) {
    let parts = this.geometry.get(spec.id);
    if (!parts) {
      parts = spec.parts.map((part) => partGeometry(part));
      this.geometry.set(spec.id, parts);
    }
    return parts;
  }

  /** Parent-before-child order for a species, worked out once. */
  private orderOf(spec: SpeciesSpec) {
    let order = this.orders.get(spec.id);
    if (!order) {
      order = partOrder(spec);
      this.orders.set(spec.id, order);
    }
    return order;
  }

  private slotOf(spec: SpeciesSpec): Slot {
    let slot = this.slots.get(spec.id);
    if (!slot) {
      const material = spec.spectral ? this.options.spectralMaterial : this.options.material;
      const meshes = this.partsOf(spec).map((geometry) => {
        const mesh = new InstancedMesh(geometry, material, this.capacity);
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return mesh;
      });
      slot = { meshes, count: 0 };
      this.slots.set(spec.id, slot);
    }
    return slot;
  }

  spawn(id: SpeciesId): void {
    const spec = SPECIES[id]!;
    const { bounds } = this.options;
    const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
    const mob: Mob = {
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
    };

    if (this.mode === 'nodes') {
      const material = spec.spectral ? this.options.spectralMaterial : this.options.material;
      const parts = this.partsOf(spec);
      const nodes = parts.map((geometry) => new Mesh(geometry, material) as Object3D);
      spec.parts.forEach((part, i) => {
        const node = nodes[i]!;
        if (part.parent === undefined) this.group.add(node);
        else nodes[spec.parts.findIndex((p) => p.name === part.parent)]!.add(node);
      });
      mob.nodes = nodes;
    } else {
      const slot = this.slotOf(spec);
      slot.count += 1;
      for (const mesh of slot.meshes) mesh.count = slot.count;
    }

    this.mobs.push(mob);
  }

  clear(): void {
    for (const mob of this.mobs) {
      if (!mob.nodes) continue;
      for (const node of mob.nodes) node.removeFromParent();
    }
    this.mobs.length = 0;
    for (const slot of this.slots.values()) {
      slot.count = 0;
      for (const mesh of slot.meshes) mesh.count = 0;
    }
  }

  /** Walk everyone, then pose them. */
  update(dtSeconds: number): void {
    const started = performance.now();
    const { bounds, groundAt } = this.options;
    const counters = new Map<string, number>();

    for (const mob of this.mobs) {
      mob.age += dtSeconds;

      // ── Behaviour: wander, rest, wander ────────────────────────────────
      const dx = mob.targetX - mob.x;
      const dz = mob.targetZ - mob.z;
      const distance = Math.hypot(dx, dz);
      if (mob.rest > 0) {
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
      }

      // The babi ngepet rears up now and then, and walks on like that.
      if (mob.species.id === 'babiNgepet') {
        const wants = Math.sin(mob.age * 0.35 + mob.phase) > 0.2 ? 1 : 0;
        mob.stand += (wants - mob.stand) * Math.min(1, dtSeconds * 2);
      }

      const y = groundAt(mob.x, mob.z);
      const input: PoseInput = {
        time: mob.age,
        gait: mob.gait,
        phase: mob.phase,
        stand: mob.stand,
      };
      _facing.makeRotationY(mob.facing);
      _facing.setPosition(mob.x, y, mob.z);

      if (mob.nodes) {
        // three.js composes the tree; we only set the local transforms.
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

      const slot = this.slots.get(mob.species.id)!;
      const index = counters.get(mob.species.id) ?? 0;
      counters.set(mob.species.id, index + 1);
      const order = this.orderOf(mob.species);
      for (let i = 0; i < order.length; i++) {
        const { part, parent } = order[i]!;
        pose(mob.species, part, input, _local);
        const world = _worlds[i]!;
        if (parent < 0) world.multiplyMatrices(_facing, _local);
        else world.multiplyMatrices(_worlds[parent]!, _local);
        slot.meshes[i]!.setMatrixAt(index, world);
      }
    }

    for (const slot of this.slots.values()) {
      for (const mesh of slot.meshes) mesh.instanceMatrix.needsUpdate = true;
    }
    this.lastUpdateMs = performance.now() - started;
  }

  dispose(): void {
    this.clear();
    for (const parts of this.geometry.values()) for (const geometry of parts) geometry.dispose();
    this.geometry.clear();
    this.slots.clear();
  }
}
