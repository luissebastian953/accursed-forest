# Simulation: world generation

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/sim/worldgen/biomes.ts`

Biome rules (§4.6).

A pure classifier: given the terrain samples for one cell it returns the
biome. Protected forest and villages are decided later by `features.ts`,
because they depend on the shape of the whole map rather than one cell.

## `src/sim/worldgen/elevation.ts`

Elevation layer (§4.6).

Continental noise (low frequency) plus hills (mid) plus detail (high),
combined into a continuous 0..1 height and quantised to `elevation` 0..3.
The continuous height is what the column mesher uses for the half-unit steps
inside a block; the quantised value is what the simulation reasons about.

Pure: `f(seed, x, y)` with no state beyond the noise functions themselves.

## `src/sim/worldgen/features.ts`

Map-scale features (§4.6): protected forest, and where the player starts.

Both need to see the whole map at once; the largest contiguous forest
cluster, and a start site with a river in reach; so unlike elevation and
moisture they are computed once when the world is created rather than
per-cell on demand.

## `src/sim/worldgen/index.ts`

World generation entry point (§4.6).

`createWorld(seed, width, height)` runs the map-scale passes once (rivers,
protected forest, start site) and returns a `World` whose `block(x, y)` is a
pure function of the seed and coordinates. Nothing about untouched land is
ever stored: `SimState.blocks` holds only blocks that diverged, and reading
any other block comes here.

Determinism: every random draw comes from streams forked off the seed with a
fixed tag, so the same seed always produces the same world regardless of what
the main simulation stream has done.

## `src/sim/worldgen/moisture.ts`

Moisture layer (§4.6).

Its own noise field, biased downward by elevation so lowlands are wetter.
Proximity to a river adds moisture on top, but that needs the traced river
cells, so it is applied by `worldgen/index.ts` once rivers exist.

## `src/sim/worldgen/rivers.ts`

River tracing (§4.6).

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
