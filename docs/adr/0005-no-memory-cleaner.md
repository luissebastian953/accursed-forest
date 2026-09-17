# 5. No memory cleaner: caps and dispose, measured

Status: accepted

## Context

JavaScript collects its own garbage, but WebGL and WebGPU resources are not
JavaScript. A `BufferGeometry`, a texture and a compiled shader program each own
memory on the GPU that is only freed by an explicit `dispose()`. Dropping the
last reference to a mesh frees the JS object and leaks everything behind it.

The estate rebuilds a lot while a run is going: terrain chunks stream in and out
as the camera moves, a block's mesh is rebuilt whenever it changes, palms are
rebuilt whenever a stage does, trees fall, crews come and go, and a rewind
throws the whole world away and builds another. A long session at 50x is
thousands of rebuilds. The question was whether the game needs something that
periodically sweeps and frees, and the answer had to be measured rather than
guessed.

## Decision

No sweeper, no periodic cleaner, no cache flush on a timer. Every producer of a
GPU resource disposes it, and every cache that can grow has a cap:

- `ChunkManager` keeps live chunk geometries in `loaded` and evicted ones in an
  LRU capped at `lruSize`. Past the cap the oldest is disposed. A chunk that was
  dirty when it unloaded is disposed instead of cached, because it would be
  rebuilt anyway. `dispose()` terminates the mesher worker as well.
- Meshes that are rebuilt in place (`Palms`, `WorkSite`, `Timber`, the rings)
  dispose the geometry they are replacing before they replace it.
- Effects that fire repeatedly (`Coins`, `Sparkles`, `Rain`, `Fires`, `Clouds`)
  are pooled `InstancedMesh`es built once, never per event.
- `switchSim` (rewind, sandbox) disposes the old `ChunkManager`, worker and all,
  before building the next one.

## Evidence

Measured on the WebGL fallback, which is the worse case.

A run of about twelve sim years at 50x, panning the camera so chunks stream
continuously:

| sim day | geometries | textures | programs | GPU memory |
| ------: | ---------: | -------: | -------: | ---------: |
|      12 |         54 |        3 |       22 |      45 MB |
|     769 |         86 |       16 |       40 |      99 MB |
|    1512 |        113 |       16 |       40 |     115 MB |
|    2592 |        103 |       16 |       40 |     108 MB |
|    4268 |         99 |       16 |       40 |     106 MB |

Everything plateaus and then comes back down: the rise is the working set
filling, not a leak. Textures and shader programs stop growing once every
variant has been compiled. The JS heap sat at 92.9 MB throughout.

Swapping subjects on the workbench fifteen times, across a mob, an effect and a
tree, returns every counter to exactly its starting value. That is the tightest
version of the test, and `e2e/workbench.spec.ts` keeps it honest.

## Consequences

- A leak shows up as a number that climbs rather than as a tab that dies an hour
  later: the workbench prints geometries, textures, programs and total GPU bytes
  live, and `?debug` exposes the same numbers as `__sawit.gpu()`.
- Anything new that builds a geometry or a material owns disposing it. A cache
  without a cap is a leak with a slower fuse.
- The steady state is around 110 MB of GPU memory on a busy estate. If that ever
  needs to come down, the chunk LRU is the dial, not a sweeper.
