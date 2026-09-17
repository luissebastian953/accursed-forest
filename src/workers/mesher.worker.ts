/**
 * Mesher worker (§6.7): builds one chunk's column mesh per request and posts
 * the arrays back as transferables. World generation happens here too; the
 * worker has the same seeded generator, so the main thread never serialises
 * terrain.
 */

import { buildChunkArrays, type DivergedBlockLite } from '@render/scene/chunkField';
import type { WorkerRequest, WorkerResponse } from '@render/scene/chunkProtocol';
import { createWorld, type World } from '@sim/worldgen/index';

// The DOM lib types `self` as a Window; a worker's `postMessage` takes a
// transfer list as its second argument. Narrow to what is actually used.
interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
}
const scope = self as unknown as WorkerScope;

const worlds = new Map<string, World>();

function worldFor(seed: number, width: number, height: number): World {
  const key = `${seed}:${width}:${height}`;
  let world = worlds.get(key);
  if (!world) {
    world = createWorld(seed, width, height);
    worlds.set(key, world);
  }
  return world;
}

scope.onmessage = (event) => {
  const request = event.data;
  if (request.type !== 'build') return;

  const world = worldFor(request.seed, request.width, request.height);
  const diverged = new Map<number, DivergedBlockLite>();
  for (const block of request.diverged) diverged.set(block.id, block);

  const arrays = buildChunkArrays(world, request.cx, request.cy, diverged);

  scope.postMessage(
    {
      type: 'built',
      requestId: request.requestId,
      cx: request.cx,
      cy: request.cy,
      positions: arrays.positions,
      normals: arrays.normals,
      paletteU: arrays.paletteU,
      triangles: arrays.triangles,
    },
    [arrays.positions.buffer, arrays.normals.buffer, arrays.paletteU.buffer],
  );
};
