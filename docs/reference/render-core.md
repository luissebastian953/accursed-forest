# Rendering: geometry, materials, animation, camera

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/render/Glow.ts`

Bloom (GDD 6.4 "Fire"): a post-processing pass that makes anything brighter
than white glow; the fire's HDR particles and nothing else, because lit
land never gets that bright. It costs a few full-screen passes, so the app
only renders through it while something is burning.

## `src/render/Renderer.ts`

Renderer setup (GDD 6.4): WebGPU with automatic WebGL 2 fallback, and a
`forceWebGL` switch so CI exercises the fallback path on purpose.

## `src/render/anim/easing.ts`

Easing curves (GDD 6.5). Every curve maps t in [0,1] to a value that starts at 0
and ends at 1; the "back", "elastic" and "bounce" families overshoot on the way.

This file is the CPU half of the curve library. `easingTSL.ts` holds the same
curves written as TSL nodes for GPU per-instance animation, and
`tests/render/easing-parity.test.ts` asserts the two agree at 32 sample points.
Change a curve here and you must change it there.

### Notes

- `squashStretch()`: volume-preserving squash and stretch (GDD 6.5).
  `curveValue` is the overshooting curve's output, and `f = curveValue - 1`
  is its deviation from rest, scaled by `amount`. The vertical scale is
  `sy = 1 + amount * f`, and the two horizontal axes take `1 / sqrt(sy)`, so
  `sy * sxz * sxz === 1`. This is a modulation around 1, applied on top of
  whatever base scale the animation already has, not the base scale itself.
  The abbreviated TSL sketch in GDD 6.5 folds the two together and is
  degenerate at t = 0, where `1 / sqrt(0)` is infinite.

## `src/render/anim/spring.ts`

Damped harmonic oscillator (GDD 6.5), integrated semi-implicit Euler.

Springs are for interruptible motion; hover, selection, squash settle;
where the target can change mid-flight. One-shot motion uses a curve from
`easing.ts` instead.

## `src/render/camera/MapRig.ts`

The orthographic map camera (GDD 6.2).

Fixed ~35° pitch; azimuth snapped to the four diagonals; zoom is the ortho
frustum size; pan by dragging the landscape. `MapControls` does the drag
and wheel handling; this class owns where the camera actually is, so
rotation snapping, bounds, and the focus tween are first-class.

The camera eases and never bounces (GDD 6.5): focus and rotation use
`easeOutCubic`; MapControls' own damping covers the pan.

## `src/render/geometry/boxBuilder.ts`

Everything in this game is boxes arranged well (GDD 6.1, GDD 6.3).

`BoxBuilder` accumulates non-indexed triangles so flat shading is free, and
tags every vertex with a `paletteU` instead of a UV (GDD 6.4). Geometry is built
once at startup and merged; nothing here runs per frame.

### Notes

- `addBox()`: `matrix` places the unit cube (centred on the origin, size 1)
  in local space, and `faces` gives the palette slot for each face. `skip`
  names faces to leave out: the column mesher culls every face that abuts a
  taller neighbour, which is most of them at estate scale.

## `src/render/geometry/forestTree.ts`

Reforestation, slot by slot. A block holds 144 planting slots, which is
palm spacing, so the forms are what grows in one slot:

sapling a planted sapling: a thin stem and a few leaves, tied to a
wooden stake in a ring of mulch, the way replanting crews
leave them;
tree one of the wild forest's own trees, at its own size; a young
one is the same mesh at a fraction of the scale;
shrub undergrowth: the saplings that lose the race for light.

Trees and shrubs are the scenery models the wild forest is drawn from,
built once with a fixed draw instead of per spot, so a block that has
grown back is the same forest as the one next door rather than a
lookalike. A wild forest block carries about a dozen trees and a few
bushes over its 144 columns, so `Palms.ts` lets about that many slots
reach the canopy and leaves the forest floor clear under them; drawing a
crown in every slot is what made a green mound of it.

## `src/render/geometry/palm.ts`

Procedural oil palm (GDD 6.3): a column of tapered boxes with a subtle S-bend
for the trunk, and 8-12 flat slabs radiating from the crown, drooping ~30
degrees and tapering toward the tip.

One generator, four parameter sets = the four growth stages. Scale is
1 world unit = 1 palm slot, so a mature palm stands about one slot and a
half with a crown that nearly touches its neighbours, and an old one
overtops it: the way a plantation reads from the air.

### Notes

- The frond's outer segments: a palm frond is pinnate, so past the middle it
  splits into leaflets. The second-last segment is drawn fanned either side
  of the spine (`FAN_MID`), and the tip twice as wide (`FAN_TIP`), so the
  crown reads as leaves rather than as paddles. The leaflets are narrower
  than the spine they hang off, so the gaps between them read at a distance.

## `src/render/geometry/terrain.ts`

Column terrain mesher (GDD 6.3, GDD 6.7).

The world is a grid of 1-unit columns whose heights are quantised to half-unit
steps. Top faces are painted by biome/height, exposed sides by depth. Only
faces exposed to a lower neighbour are emitted; at estate scale that culls
most of the geometry, which is what keeps a 48x48 chunk inside the
~6-10k triangle budget.

This runs in `workers/mesher.worker.ts` once chunk streaming lands; it is kept
dependency-light (no sim imports) so the worker can own it.

### Notes

- `ColumnField.inset`: columns within `inset` of the field's edge are
  neighbour context only. Their heights cull the faces of the columns beside
  them, but they are not emitted. A chunk builds with `inset: 1` so its
  border faces are culled against the next chunk rather than drawn as a wall
  down to the floor.

## `src/render/materials/palette.ts`

The palette strip (GDD 6.4).

Every vertex in the world carries a `paletteU` attribute instead of a UV.
The palette is a 256x2 texture: row 0 is the wet-season colour for each slot,
row 1 is the dry-season colour, and the alpha channel of both is how much
light the slot gives off rather than opacity. A single `season` uniform lerps between them,
and an event tint uniform (haze amber-grey, ash grey) is mixed on top, so the
whole world shifts mood with two floats.

Colours are the real-place set from GDD 6.1: saturated sawit green, yellow-green
young fronds, laterite red-orange soil, dark peat brown, ochre grassfield.

### Notes

- `EMISSION`: how much of its own light a slot gives off, 0 to 1, carried in
  the palette's alpha channel because nothing else uses it. The material
  turns it into an emissive term, which lifts these slots (coin, sparkle,
  golden capybara fur) past the bloom threshold: the gold things glow instead
  of sitting there as flat yellow paint.

## `src/render/materials/paletteMaterial.ts`

The one material everything static shares (GDD 6.4).

`colorNode` samples the palette strip at the vertex's `paletteU`, lerping the
wet-season row against the dry-season row with a `season` uniform, then mixes
an event tint (haze amber-grey, ash grey) on top. Two floats shift the mood of
the entire world.

Lambert, flat-shaded, no specular; GDD 6.1.

### Notes

- `PaletteUniforms`: `season` lerps the wet row against the dry row, and
  `tintColor` and `tintAmount` wash the result toward an event colour. The
  type is inferred from `createPaletteUniforms()` rather than spelled out, so
  the TSL node types stay whatever three says they are.
- `EMISSION_GAIN`: how hard a fully emissive slot lights itself. 0.55 is
  enough that gold lands just over the bloom threshold (1.1) and blooms in
  its own colour, and not so much that it burns out to white.
- `emissiveNode` in `createPaletteMaterial()`: the palette's alpha is an
  emission mask (see `palette.ts`). A slot that carries one lights itself in
  its own colour, which puts gold over the bloom threshold while leaving
  everything else exactly as it was. `emissiveNode` is typed on the standard
  material only, hence the cast; every node material honours it, because
  `NodeMaterial` reads it when it sets up lighting.

## `src/render/materials/paletteSlots.ts`

Palette slot indices (GDD 6.4).

Kept free of Three.js so the mesher worker and the chunk field builder can
import it without pulling the renderer into the worker bundle. The colours
for each slot, and the texture that carries them, live in `palette.ts`.

## `src/render/picking.ts`

Picking (GDD 6.6): raycast the terrain chunks for block selection. Per-palm
picking against the instanced meshes arrives with the palm panel (M1b+).

## `src/render/quality.ts`

Adaptive resolution (GDD 6.4). A laptop with an integrated GPU runs out of
pixels long before it runs out of triangles or CPU, and a Retina display asks
for four buffer pixels per CSS pixel, so the renderer starts at what the
display can do and gives pixels back when frames run long.

### Notes

- The verdict is on elapsed time, not a frame count. At two frames a second a
  count of sixty would take half a minute to notice the machine is drowning,
  which is exactly the machine that needs the help soonest.
- A frame over a second is a stall, not a slow machine: a backgrounded tab
  hands back enormous frames and must not cost the player resolution.
- Climbing back costs twice the patience once it has dropped, so a machine that
  is borderline settles rather than oscillating between two resolutions.

## `src/render/sync.ts`

From a tick's events to what the scene needs to redo (GDD 4.2 step 5).

A pure classifier: the app feeds the digest to the chunk manager, the palm
meshes, the persistence dirty set and the HUD. Keeping it here means the
event → visual mapping (GDD 6.5 "event wiring") has one home.
