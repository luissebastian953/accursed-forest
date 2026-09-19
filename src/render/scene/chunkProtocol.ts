import type { DivergedBlockLite } from './chunkField.ts';

export interface BuildChunkRequest {
  type: 'build';
  requestId: number;
  seed: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
  diverged: DivergedBlockLite[];
}

export interface ChunkBuiltMessage {
  type: 'built';
  requestId: number;
  cx: number;
  cy: number;
  positions: Float32Array;
  normals: Float32Array;
  paletteU: Float32Array;
  triangles: number;
}

export type WorkerRequest = BuildChunkRequest;
export type WorkerResponse = ChunkBuiltMessage;
