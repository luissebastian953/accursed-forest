/**
 * Instanced palms (§6.6): one `InstancedMesh` per growth stage and variant,
 * plus stumps, rebuilt from sim state whenever a planted block changes. At
 * estate scale that is a few thousand matrices; cheap enough to redo
 * wholesale rather than track slots.
 *
 * Pop-in and grow animations run on the CPU here (§6.5 CPU timeline). The GPU
 * per-instance path (`InstanceAnim`) takes over when palm counts justify it.
 *
 * Reforested blocks reuse the palm meshes for now; the box-tree generator for
 * forest stages arrives with the forest-cover work.
 */

import { Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three/webgpu';

import { clamp01 } from '@shared/math';
import { WORLD } from '@sim/balance/world';
import { slotStage } from '@sim/palms';
import type { BlockId, SimState } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import { DURATION, cascadeDelay, easeOutBack, squashStretch } from '../anim/easing.ts';
import {
  PALM_STAGES,
  buildPalmGeometry,
  buildStumpGeometry,
  type PalmStage,
} from '../geometry/palm.ts';

import { terraceHeight } from './chunkField.ts';

interface Entry {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Wall-clock ms the pop-in started, or -1 when at rest. */
  animStart: number;
}

/** Mesh keys: `${stage}:healthy`, `${stage}:sick`, and `stump`. */
type MeshKey = `${PalmStage}:healthy` | `${PalmStage}:sick` | 'stump';

const INITIAL_CAPACITY = 24 * WORLD.blockSide * WORLD.blockSide;

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Deterministic 0..1 per slot so palms never all face the same way. */
function slotHash(block: BlockId, slot: number): number {
  const v = Math.sin(block * 12.9898 + slot * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function allKeys(): MeshKey[] {
  const keys: MeshKey[] = [];
  for (const stage of PALM_STAGES) keys.push(`${stage}:healthy`, `${stage}:sick`);
  keys.push('stump');
  return keys;
}

export class Palms {
  readonly group = new Group();
  private readonly meshes = new Map<MeshKey, InstancedMesh>();
  private readonly entries = new Map<MeshKey, Entry[]>();
  private animating = false;

  constructor(private readonly material: Material) {
    for (const key of allKeys()) {
      this.entries.set(key, []);
      this.ensureCapacity(key, key === 'stump' ? INITIAL_CAPACITY / 4 : INITIAL_CAPACITY);
    }
  }

  /**
   * Rebuild every instance from state. Blocks in `animateBlocks` pop in with
   * the row cascade; everything else lands at rest.
   */
  sync(state: SimState, world: World, nowMs: number, animateBlocks?: ReadonlySet<BlockId>): void {
    for (const list of this.entries.values()) list.length = 0;

    for (const [id, palms] of state.palms) {
      const block = state.blocks.get(id);
      if (!block || (block.phase !== 'planted' && block.phase !== 'reforesting')) continue;

      const [bx, by] = world.toXY(id);
      const originX = bx * WORLD.blockSide;
      const originZ = by * WORLD.blockSide;
      const y = terraceHeight(block.elevation);
      const animate = animateBlocks?.has(id) ?? false;

      for (let slot = 0; slot < palms.plantedAt.length; slot++) {
        const stage = slotStage(palms, slot, block.species, state.tick);
        if (stage === 'empty') continue;

        let key: MeshKey;
        if (stage === 'dead') key = 'stump';
        else key = `${stage}:${palms.ganoderma[slot] === 2 ? 'sick' : 'healthy'}`;

        const row = Math.floor(slot / WORLD.blockSide);
        const col = slot % WORLD.blockSide;
        // Alternate rows shift a quarter slot: real palms are on a triangle.
        const jitter = row % 2 === 0 ? -0.2 : 0.2;

        this.entries.get(key)!.push({
          x: originX + col + 0.5 + jitter,
          y,
          z: originZ + row + 0.5,
          yaw: slotHash(id, slot) * Math.PI * 2,
          animStart: animate && key !== 'stump' ? nowMs + cascadeDelay(row * 2 + col * 0.5) : -1,
        });
      }
    }

    for (const key of this.entries.keys()) {
      const list = this.entries.get(key)!;
      this.ensureCapacity(key, list.length);
      const mesh = this.meshes.get(key)!;
      mesh.count = list.length;
      for (let i = 0; i < list.length; i++) this.writeMatrix(mesh, i, list[i]!, nowMs);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }

    this.animating = animateBlocks !== undefined && animateBlocks.size > 0;
  }

  /** Advance pop-in animations. Cheap when nothing is animating. */
  update(nowMs: number): void {
    if (!this.animating) return;
    let still = false;

    for (const [key, list] of this.entries) {
      const mesh = this.meshes.get(key)!;
      let touched = false;
      for (let i = 0; i < list.length; i++) {
        const entry = list[i]!;
        if (entry.animStart < 0) continue;
        const t = (nowMs - entry.animStart) / DURATION.popIn;
        if (t >= 1) entry.animStart = -1;
        else still = true;
        this.writeMatrix(mesh, i, entry, nowMs);
        touched = true;
      }
      if (touched) mesh.instanceMatrix.needsUpdate = true;
    }

    this.animating = still;
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      mesh.dispose();
    }
    this.meshes.clear();
  }

  private writeMatrix(mesh: InstancedMesh, index: number, entry: Entry, nowMs: number): void {
    let scale = 1;
    let sy = 1;
    let sxz = 1;

    if (entry.animStart >= 0) {
      const t = clamp01((nowMs - entry.animStart) / DURATION.popIn);
      const curve = easeOutBack(t);
      const squash = squashStretch(curve, 0.9);
      scale = t <= 0 ? 0 : curve;
      sy = squash.sy;
      sxz = squash.sxz;
    }

    _p.set(entry.x, entry.y, entry.z);
    _q.setFromAxisAngle(UP, entry.yaw);
    _s.set(scale * sxz, scale * sy, scale * sxz);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(index, _m);
  }

  private geometryFor(key: MeshKey) {
    if (key === 'stump') return buildStumpGeometry();
    const [stage, variant] = key.split(':') as [PalmStage, 'healthy' | 'sick'];
    return buildPalmGeometry(stage, variant);
  }

  private ensureCapacity(key: MeshKey, needed: number): void {
    const existing = this.meshes.get(key);
    if (existing && existing.instanceMatrix.count >= needed) return;

    const capacity = Math.max(
      needed,
      existing ? existing.instanceMatrix.count * 2 : INITIAL_CAPACITY,
    );
    const geometry = existing?.geometry ?? this.geometryFor(key);
    const mesh = new InstancedMesh(geometry, this.material, capacity);
    mesh.frustumCulled = false;
    mesh.count = 0;

    if (existing) {
      this.group.remove(existing);
      existing.dispose();
    }
    this.group.add(mesh);
    this.meshes.set(key, mesh);
  }
}
