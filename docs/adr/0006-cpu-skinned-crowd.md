# 0006. The crowd is CPU-skinned into two draw calls

Date: 2026-09-19. Status: accepted. Recorded from the reasoning that lived at
the top of `src/render/mobs/MobField.ts` before file headers moved to
[the module reference](../reference/render-mobs.md).

## Context

Mobs are trees of box parts posed by `rig.ts` every frame. Two ways to draw a
crowd were built and measured against each other on the `?mobs` page:

- **Instanced**: one `InstancedMesh` per species part, the pose written into
  each instance matrix. On paper the cheapest: the GPU does the work.
- **CPU-skinned**: every frame the rig poses each part, the part's box is
  transformed into one shared vertex buffer, and the whole crowd is one
  dynamic mesh per material, drawn with the terrain's own shader.

## Decision

CPU skinning. Two draw calls for the entire crowd, solid and spectral.

## Why

three's node renderer keys a compiled program on each instanced object, so
every part of every species that first appeared compiled a fresh shader:
seconds of stall each on the software renderer, a visible hitch on real
GPUs, and it happened at the worst moment, when something new walked on.
Skinning into a shared buffer costs a little CPU per frame and compiles
nothing new, ever. The crowd is small enough that the CPU cost is not the
bottleneck.

## Consequences

- Adding a species costs no shader compile and no new mesh.
- `MobField.update` is per-frame CPU work proportional to the crowd; at the
  caps in `src/sim/balance/mobs.ts` it is well under a millisecond.
- A `nodes` draw mode (a scene node per part) is kept only for the proof of
  concept's comparison and is not used by the game.
- Anyone tempted to "optimise" back to `InstancedMesh` should reproduce the
  stall on the `?mobs` page first.
