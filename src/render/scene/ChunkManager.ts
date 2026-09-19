import { Group, Mesh, type BufferGeometry, type Material } from 'three/webgpu';

import { WORLD } from '@sim/balance/world';
import type { Block, BlockId } from '@sim/types';
import type { World } from '@sim/worldgen/index';

import type { GroundRect } from '../camera/MapRig.ts';
import { geometryFromArrays } from '../geometry/boxBuilder.ts';

import { CHUNK_COLUMNS, chunkOfBlock, toLite } from './chunkField.ts';
import type { BuildChunkRequest, WorkerResponse } from './chunkProtocol.ts';

export interface ChunkManagerOptions {
  world: World;
  material: Material;
  /** The estate's diverged blocks; the worker needs them for terraces. */
  getDiverged: () => Iterable<Readonly<Block>>;
  /** Current sim tick, so the worker can paint ash windows. */
  getTick: () => number;
  /** Blocks under flood water right now. */
  getFlooded?: () => ReadonlySet<number>;
  /** The palms on each block, so the ground can show which slots are empty. */
  getPalms?: () => ReadonlyMap<number, { plantedAt: ArrayLike<number> }>;
  createWorker?: () => Worker;
  maxInFlight?: number;
  lruSize?: number;
  /** How long a chunk may be off-screen before it is unloaded. */
  unloadDelayMs?: number;
  /** Extra chunks around the visible set. */
  margin?: number;
}

interface Loaded {
  mesh: Mesh;
  lastVisibleMs: number;
  dirty: boolean;
}

export class ChunkManager {
  readonly group = new Group();

  private readonly world: World;
  private readonly material: Material;
  private readonly getDiverged: () => Iterable<Readonly<Block>>;
  private readonly getTick: () => number;
  private readonly getFlooded: () => ReadonlySet<number>;
  private readonly getPalms: () => ReadonlyMap<number, { plantedAt: ArrayLike<number> }>;
  private readonly worker: Worker;
  private readonly maxInFlight: number;
  private readonly lruSize: number;
  private readonly unloadDelayMs: number;
  private readonly margin: number;

  private readonly loaded = new Map<string, Loaded>();
  /** Evicted geometries kept for a quick return. Insertion order = age. */
  private readonly lru = new Map<string, BufferGeometry>();
  private readonly inFlight = new Map<number, string>();
  private readonly pendingDirty = new Set<string>();
  private queue: string[] = [];
  private nextRequestId = 1;
  private readonly chunksX: number;
  private readonly chunksY: number;

  constructor(options: ChunkManagerOptions) {
    this.world = options.world;
    this.material = options.material;
    this.getDiverged = options.getDiverged;
    this.getTick = options.getTick;
    this.getFlooded = options.getFlooded ?? (() => new Set());
    this.getPalms = options.getPalms ?? (() => new Map());
    this.maxInFlight = options.maxInFlight ?? 2;
    this.lruSize = options.lruSize ?? 64;
    this.unloadDelayMs = options.unloadDelayMs ?? 2000;
    this.margin = options.margin ?? 1;
    this.chunksX = Math.ceil(this.world.width / WORLD.chunkSide);
    this.chunksY = Math.ceil(this.world.height / WORLD.chunkSide);

    this.worker =
      options.createWorker?.() ??
      new Worker(new URL('../../workers/mesher.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.onBuilt(event.data);
  }

  stats(): { loaded: number; inFlight: number; queued: number; cached: number } {
    return {
      loaded: this.loaded.size,
      inFlight: this.inFlight.size,
      queued: this.queue.length,
      cached: this.lru.size,
    };
  }

  /** Something on this block changed its terrain look (phase, fire, elevation). */
  markBlockDirty(block: BlockId): void {
    const [cx, cy] = chunkOfBlock(this.world, block);
    this.markDirty(`${cx}:${cy}`);
    // A terrace edge changes the neighbour's border culling too.
    const [bx, by] = this.world.toXY(block);
    if (bx % WORLD.chunkSide === 0 && cx > 0) this.markDirty(`${cx - 1}:${cy}`);
    if (bx % WORLD.chunkSide === WORLD.chunkSide - 1 && cx < this.chunksX - 1)
      this.markDirty(`${cx + 1}:${cy}`);
    if (by % WORLD.chunkSide === 0 && cy > 0) this.markDirty(`${cx}:${cy - 1}`);
    if (by % WORLD.chunkSide === WORLD.chunkSide - 1 && cy < this.chunksY - 1)
      this.markDirty(`${cx}:${cy + 1}`);
  }

  private markDirty(key: string): void {
    this.lru.get(key)?.dispose();
    this.lru.delete(key);
    const loaded = this.loaded.get(key);
    if (loaded) {
      loaded.dirty = true;
      this.pendingDirty.add(key);
    }
  }

  update(visible: GroundRect, nowMs: number): void {
    const minCx = Math.max(0, Math.floor(visible.minX / CHUNK_COLUMNS) - this.margin);
    const maxCx = Math.min(
      this.chunksX - 1,
      Math.floor(visible.maxX / CHUNK_COLUMNS) + this.margin,
    );
    const minCy = Math.max(0, Math.floor(visible.minZ / CHUNK_COLUMNS) - this.margin);
    const maxCy = Math.min(
      this.chunksY - 1,
      Math.floor(visible.maxZ / CHUNK_COLUMNS) + this.margin,
    );

    const centreX = (visible.minX + visible.maxX) / 2 / CHUNK_COLUMNS;
    const centreY = (visible.minZ + visible.maxZ) / 2 / CHUNK_COLUMNS;

    const wanted: { key: string; distance: number }[] = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx}:${cy}`;
        const loaded = this.loaded.get(key);
        if (loaded) {
          loaded.lastVisibleMs = nowMs;
          continue;
        }
        if (this.isInFlight(key)) continue;
        const dx = cx + 0.5 - centreX;
        const dy = cy + 0.5 - centreY;
        wanted.push({ key, distance: dx * dx + dy * dy });
      }
    }
    wanted.sort((a, b) => a.distance - b.distance);
    this.queue = wanted.map((w) => w.key);

    // Dirty rebuilds first: a planted block should not wait behind scenery.
    for (const key of this.pendingDirty) {
      if (this.inFlight.size >= this.maxInFlight) break;
      if (this.isInFlight(key)) continue;
      this.pendingDirty.delete(key);
      this.request(key);
    }

    while (this.inFlight.size < this.maxInFlight && this.queue.length > 0) {
      const key = this.queue.shift()!;
      const cached = this.lru.get(key);
      if (cached) {
        this.lru.delete(key);
        this.adopt(key, cached, nowMs);
        continue;
      }
      this.request(key);
    }

    for (const [key, loaded] of this.loaded) {
      if (nowMs - loaded.lastVisibleMs > this.unloadDelayMs) this.unload(key, loaded);
    }
  }

  dispose(): void {
    this.worker.terminate();
    for (const loaded of this.loaded.values()) {
      this.group.remove(loaded.mesh);
      loaded.mesh.geometry.dispose();
    }
    this.loaded.clear();
    for (const geometry of this.lru.values()) geometry.dispose();
    this.lru.clear();
  }

  private isInFlight(key: string): boolean {
    for (const value of this.inFlight.values()) if (value === key) return true;
    return false;
  }

  private request(key: string): void {
    const [cx, cy] = key.split(':').map(Number) as [number, number];
    const requestId = this.nextRequestId++;
    this.inFlight.set(requestId, key);

    const diverged = [];
    const tick = this.getTick();
    const flooded = this.getFlooded();
    const palms = this.getPalms();
    for (const block of this.getDiverged())
      diverged.push(toLite(block, tick, flooded.has(block.id), palms.get(block.id)));

    const request: BuildChunkRequest = {
      type: 'build',
      requestId,
      seed: this.world.params.seed,
      width: this.world.width,
      height: this.world.height,
      cx,
      cy,
      diverged,
    };
    this.worker.postMessage(request);
  }

  private onBuilt(message: WorkerResponse): void {
    if (message.type !== 'built') return;
    const key = this.inFlight.get(message.requestId);
    this.inFlight.delete(message.requestId);
    if (!key) return;

    const geometry = geometryFromArrays({
      positions: message.positions,
      normals: message.normals,
      paletteU: message.paletteU,
      triangles: message.triangles,
    });

    const existing = this.loaded.get(key);
    if (existing) {
      // Atomic swap for a dirty rebuild.
      existing.mesh.geometry.dispose();
      existing.mesh.geometry = geometry;
      existing.dirty = false;
      return;
    }
    this.adopt(key, geometry, performance.now());
  }

  private adopt(key: string, geometry: BufferGeometry, nowMs: number): void {
    const mesh = new Mesh(geometry, this.material);
    mesh.frustumCulled = true;
    this.group.add(mesh);
    this.loaded.set(key, { mesh, lastVisibleMs: nowMs, dirty: false });
  }

  private unload(key: string, loaded: Loaded): void {
    this.group.remove(loaded.mesh);
    this.loaded.delete(key);
    this.pendingDirty.delete(key);

    if (loaded.dirty) {
      loaded.mesh.geometry.dispose();
      return;
    }
    this.lru.set(key, loaded.mesh.geometry);
    while (this.lru.size > this.lruSize) {
      const oldest = this.lru.keys().next().value;
      if (oldest === undefined) break;
      this.lru.get(oldest)?.dispose();
      this.lru.delete(oldest);
    }
  }
}
