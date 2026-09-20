import { RIVERS } from '../balance/world.ts';
import { forkRng, nextInt, type RngState } from '../rng.ts';

import { NOISE_TAG, noiseFor, type ElevationField } from './elevation.ts';

export interface RiverField {
  /** Cell keys (`y * width + x`) that are open water. */
  water: Set<number>;
  /** Blocks from the nearest water cell; `Infinity` beyond the search range. */
  distance: Float32Array;
  count: number;
  /** Each river's cells, source first to coast; the renderer smooths these into a channel. */
  paths: number[][];
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function traceRivers(
  seed: number,
  width: number,
  height: number,
  elevation: ElevationField,
  maxDistance: number,
): RiverField {
  const rng: RngState = forkRng(seed, NOISE_TAG.rivers);
  const count = RIVERS.min + nextInt(rng, RIVERS.max - RIVERS.min + 1);
  const water = new Set<number>();
  const paths: number[][] = [];

  // Ridge candidates: highest interior cells; a border source makes a stub river.
  const marginX = Math.floor(width * RIVERS.sourceMargin);
  const marginY = Math.floor(height * RIVERS.sourceMargin);
  const candidates: { x: number; y: number; h: number }[] = [];

  for (let y = marginY; y < height - marginY; y += 3) {
    for (let x = marginX; x < width - marginX; x += 3) {
      candidates.push({ x, y, h: elevation.height01(x, y) });
    }
  }

  candidates.sort((a, b) => b.h - a.h);

  const coast = findCoast(width, height, elevation);
  const wobble = noiseFor(seed, NOISE_TAG.riverWobble);
  const enterCost = (x: number, y: number): number =>
    RIVERS.stepCost +
    elevation.height01(x, y) * RIVERS.heightWeight +
    (wobble(x * RIVERS.wobbleScale, y * RIVERS.wobbleScale) + 1) * 0.5 * RIVERS.wobbleWeight;

  // Draw without replacement so two rivers never share a source.
  const sources = candidates.slice(0, Math.max(count * 4, count));

  for (let i = 0; i < count && sources.length > 0; i++) {
    const [source] = sources.splice(nextInt(rng, sources.length), 1);

    if (!source) continue;

    const path = leastCostPath(source.x, source.y, width, height, coast, enterCost);

    for (const key of path) water.add(key);
    paths.push(path);
  }

  return { water, distance: distanceField(water, width, height, maxDistance), count, paths };
}

type Edge = 'north' | 'south' | 'west' | 'east';

/** The border edge with the lowest mean height: where the rivers drain to. */
function findCoast(width: number, height: number, elevation: ElevationField): Edge {
  const mean = (cells: [number, number][]): number =>
    cells.reduce((sum, [x, y]) => sum + elevation.height01(x, y), 0) / cells.length;

  const edges: [Edge, number][] = [
    ['north', mean(Array.from({ length: width }, (_, x) => [x, 0]))],
    ['south', mean(Array.from({ length: width }, (_, x) => [x, height - 1]))],
    ['west', mean(Array.from({ length: height }, (_, y) => [0, y]))],
    ['east', mean(Array.from({ length: height }, (_, y) => [width - 1, y]))],
  ];

  edges.sort((a, b) => a[1] - b[1]);
  return edges[0]![0];
}

function onCoast(x: number, y: number, width: number, height: number, coast: Edge): boolean {
  switch (coast) {
    case 'north':
      return y === 0;
    case 'south':
      return y === height - 1;
    case 'west':
      return x === 0;
    case 'east':
      return x === width - 1;
  }
}

/**
 * Dijkstra from the source to the cheapest coast cell. Returns the path
 * source-first. The grid is connected, so a path always exists.
 */
function leastCostPath(
  startX: number,
  startY: number,
  width: number,
  height: number,
  coast: Edge,
  enterCost: (x: number, y: number) => number,
): number[] {
  const size = width * height;
  const cost = new Float64Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const settled = new Uint8Array(size);
  const heap = new MinHeap();

  const startKey = startY * width + startX;

  cost[startKey] = 0;
  heap.push(startKey, 0);

  let goal = -1;

  while (heap.size > 0) {
    const key = heap.pop();

    if (settled[key] === 1) continue;
    settled[key] = 1;

    const x = key % width;
    const y = (key - x) / width;

    if (onCoast(x, y, width, height, coast)) {
      goal = key;
      break;
    }

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const nKey = ny * width + nx;

      if (settled[nKey] === 1) continue;

      const next = cost[key]! + enterCost(nx, ny);

      if (next < cost[nKey]!) {
        cost[nKey] = next;
        cameFrom[nKey] = key;
        heap.push(nKey, next);
      }
    }
  }

  const path: number[] = [];

  for (let key = goal; key !== -1; key = cameFrom[key]!) path.push(key);
  return path.reverse();
}

/** Binary min-heap over (key, priority) pairs. Lazy deletion; see `settled`. */
class MinHeap {
  private keys: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, priority: number): void {
    this.keys.push(key);
    this.priorities.push(priority);

    let i = this.keys.length - 1;

    while (i > 0) {
      const parent = (i - 1) >> 1;

      if (this.priorities[parent]! <= this.priorities[i]!) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.keys[0]!;
    const lastKey = this.keys.pop()!;
    const lastPriority = this.priorities.pop()!;

    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.priorities[0] = lastPriority;

      let i = 0;

      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;

        if (left < this.keys.length && this.priorities[left]! < this.priorities[smallest]!)
          smallest = left;
        if (right < this.keys.length && this.priorities[right]! < this.priorities[smallest]!)
          smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }

    return top;
  }

  private swap(a: number, b: number): void {
    const k = this.keys[a]!;

    this.keys[a] = this.keys[b]!;
    this.keys[b] = k;

    const p = this.priorities[a]!;

    this.priorities[a] = this.priorities[b]!;
    this.priorities[b] = p;
  }
}

/** Multi-source BFS out to `maxDistance` blocks. */
function distanceField(
  water: Set<number>,
  width: number,
  height: number,
  maxDistance: number,
): Float32Array {
  const distance = new Float32Array(width * height).fill(Infinity);
  let frontier: number[] = [];

  for (const key of water) {
    distance[key] = 0;
    frontier.push(key);
  }

  for (let d = 1; d <= maxDistance && frontier.length > 0; d++) {
    const next: number[] = [];

    for (const key of frontier) {
      const x = key % width;
      const y = (key - x) / width;

      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const nKey = ny * width + nx;

        if (distance[nKey] !== Infinity) continue;
        distance[nKey] = d;
        next.push(nKey);
      }
    }

    frontier = next;
  }

  return distance;
}
