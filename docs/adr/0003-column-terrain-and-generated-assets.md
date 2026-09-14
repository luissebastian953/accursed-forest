# 3. Boxy low-poly on column terrain, with all geometry generated in code

Status: accepted

## Context

The estate is read at two scales: a whole block grid, and individual palms. A
smooth or faceted heightfield was tried and dropped — it did not sit with the
boxy props.

## Decision

Terrain is a grid of 1-unit columns quantised to half-unit steps, meshed per
chunk with faces culled against lower neighbours. Palms, props, buildings and
debris are boxes and slabs generated at startup by `render/geometry/*`, each
vertex carrying a `paletteU` attribute instead of a UV. There is no Blender
pipeline; a GLB can replace any generator later as long as it carries `paletteU`.

One shared TSL material samples a 256x2 palette texture — a wet row and a dry
row lerped by a `season` uniform, with an event tint mixed on top — so the whole
world changes mood with two floats.

## Consequences

- Elevation is literally visible: slopes are staircases, a landslide is columns
  dropping a step.
- Season and haze cost two uniform writes, not a re-material.
- The height field feeding the mesher must be spatially coherent. Per-column
  noise produces one-column pits whose walls the mesher then correctly draws,
  which reads as speckle; this was hit and fixed in the first spike.
