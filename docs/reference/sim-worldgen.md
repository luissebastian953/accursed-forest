# Simulation: world generation

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/sim/worldgen/biomes.ts`

Biome rules (GDD 4.6).

A pure classifier: given the terrain samples for one cell it returns the
biome. Protected forest and villages are decided later by `features.ts`,
because they depend on the shape of the whole map rather than one cell.

## `src/sim/worldgen/elevation.ts`

Elevation layer (GDD 4.6).

Continental noise (low frequency) plus hills (mid) plus detail (high),
combined into a continuous 0..1 height and quantised to `elevation` 0..3.
The continuous height is what the column mesher uses for the half-unit steps
inside a block; the quantised value is what the simulation reasons about.

Pure: `f(seed, x, y)` with no state beyond the noise functions themselves.

## `src/sim/worldgen/features.ts`

Map-scale features (GDD 4.6): protected forest, and where the player starts.

Both need to see the whole map at once; the largest contiguous forest
cluster, and a start site with a river in reach; so unlike elevation and
moisture they are computed once when the world is created rather than
per-cell on demand.

### Notes

- `findProtectedForest()`: the largest contiguous cluster of high forest, plus a
  one-block buffer ring, becomes protected forest: the map's fixed boundary. It
  returns an empty set if no cluster reaches the minimum size, which is a
  legitimate world.
- `findStartSite()`: searches outward from the map centre for somewhere to put
  the estate: a core that is plantable, off the slopes, clear of protected
  forest and water, with a river within reach and standing forest in or around
  it. It always returns a site; if nothing scores well the best candidate found
  wins, because a world with nowhere to start is not playable.
- `findVillages()`: villages (GDD 4.6) are a few clusters of village land near
  the rivers, placed after the start site and kept clear of it, so they never
  change where the estate begins. It returns the cells, which become the
  `village` biome.

## `src/sim/worldgen/index.ts`

World generation entry point (GDD 4.6).

`createWorld(seed, width, height)` runs the map-scale passes once (rivers,
protected forest, start site) and returns a `World` whose `block(x, y)` is a
pure function of the seed and coordinates. Nothing about untouched land is
ever stored: `SimState.blocks` holds only blocks that diverged, and reading
any other block comes here.

Determinism: every random draw comes from streams forked off the seed with a
fixed tag, so the same seed always produces the same world regardless of what
the main simulation stream has done.

### Notes

- `createWorld()` terrain cache: per-cell terrain is cached in a flat array,
  which is cheaper than an LRU here: at 64x64 the full cache is 4,096 entries,
  and the render worker regenerates chunks on demand anyway.
- `seedFromEstateCode()`: any words name a world (GDD 4.6). Seven code symbols
  are read as a code, so a shared estate comes back exactly; anything else is
  hashed, so a player can type what they like. Case, spacing and punctuation
  are ignored either way: "PENYAWIT-HANDAL", "penyawit handal" and "Penyawit
  Handal" are one estate. Only nothing at all is nothing: an empty box means a
  random world.

## `src/sim/worldgen/moisture.ts`

Moisture layer (GDD 4.6).

Its own noise field, biased downward by elevation so lowlands are wetter.
Proximity to a river adds moisture on top, but that needs the traced river
cells, so it is applied by `worldgen/index.ts` once rivers exist.

## `src/sim/worldgen/rivers.ts`

River tracing (GDD 4.6).

One to three rivers run from interior ridge cells to the coast, one block
wide. The coast is the border edge with the lowest mean height; all of a
map's drainage heads the same way, as a real kabupaten's does. Each river is
the least-cost path from its source to any coast cell, where the cost of
entering a cell is a step charge plus its weighted height plus a small
deterministic wobble; the height term makes the channel follow valleys and
the wobble keeps it from running dead straight across flat ground.

Three walkers were tried before this one and dropped: pure steepest descent
stalled in the first local minimum after a dozen cells; a no-backtrack
"lowest unvisited neighbour" walk curled into itself and trapped a river in
three mid-map; a backtracking depth-first search reached the edge every time
but wandered through basins on the way, leaving 500-cell lakes. Dijkstra is
the only one whose output looks like a river on every seed.

Rivers reaching the edge is what the riverbank strip, the start-site search
and the tests all rely on. The result is a set of water cells plus a distance
field, which biome selection uses for the riverbank strip and moisture uses
for the wetness boost. Unlike elevation and moisture this cannot be a pure
per-cell function; a river is a path; so it is computed once per world.

### Notes

- `RiverField.paths`: each river's cells, source first, ending on the coast.
  The simulation only needs `water`; the renderer draws a smoothed, meandering
  channel along these instead of the block staircase.
- `traceRivers()` ridge candidates: the sources are chosen from the highest
  cells of the map's interior, sampled coarsely so sources spread out. Sources
  near the border make stub rivers that leave the map after a dozen cells; the
  interior margin keeps every river long enough to shape the land it crosses.
