# Rendering: the scene

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/render/scene/Ceremony.ts`

The certificate ceremony at the Kopdes (GDD 3.8, GDD 6.5): a banner on two poles pops in
with `easeOutBack`, and fireworks burst over the roof for a few seconds.
Clean or dirty, it is the same ceremony; the epilogue tells the difference.

## `src/render/scene/ChunkManager.ts`

Chunk streaming (GDD 6.7).

Each frame: project the camera's ground rectangle onto chunk coordinates
(plus a one-chunk margin), queue missing chunks nearest-first, ask the
mesher worker for at most `maxInFlight` at a time, and drop chunks that
have been out of view for a while into an LRU so a quick pan back is free.
A dirty chunk is rebuilt and swapped in atomically when its mesh arrives.

The far-LOD heatmap tiles (GDD 6.6) are not here yet; zoom is clamped by the
MapRig so the near ring stays inside the budget meanwhile.

## `src/render/scene/Clouds.ts`

Clouds (GDD 6.1): small white chunks drifting over the estate, see-through
enough that the land reads through them. They are scenery, not weather:
the sky's own mood is `Sky.ts`.

They drift down and to the left of the screen whichever way the camera is
turned, so the direction is taken from the camera each frame rather than
fixed in the world. They live on a tile that follows the view and wraps,
so a handful of them covers any amount of panning.

### Notes

- `cloudGeometry()`: one cloud is slabs that sit against each other rather
  than through each other. Two translucent faces over the same pixel blend
  twice and read as a hard cut across the cloud, so nothing overlaps: the
  tiers stack on the slab below, and the lobes stand beside it.

## `src/render/scene/Coins.ts`

Gold coins (GDD 6.5): a handful thrown into the air that arc, spin, land and
settle into the grass before they wink out. Anything that pays out on the
map borrows this: a golden capybara spotted, a babi ngepet caught with its
takings.

One instanced mesh stepped on the CPU, with a fixed pool: a burst is a
dozen coins and they last a second and a half, so the pool is never the
thing that breaks. A burst past the pool drops its extra coins rather than
growing the buffer mid-frame.

## `src/render/scene/Excavator.ts`

The excavator (GDD 3.6.2): the machine that comes with the crew when a
landslide is dug out. It crawls onto the block, swings its boom into the
spoil, lifts, turns to dump, and goes back for more, for as long as the
crew is on the block.

One machine at a time, like the motorcade: the estate never has two slides
being dug at once often enough to be worth the parts.

## `src/render/scene/Fires.ts`

Fire on burning blocks (GDD 6.4 "Fire"): glowing box particles.

Each burning block holds a few flame sources, more at higher intensity.
Every source keeps emitting cubes that rise, swell and shrink as they cool
from white-hot through yellow and orange to deep red; embers drift higher
and wink out; smoke rolls off the top. Flame colours are brighter than
white, so the bloom pass (`render/Glow.ts`) makes them glow. Under each
fire an additive glow patch warms the ground, and a small pool of point
lights (always present, so shaders never recompile) lights the trees
beside the brightest fires.

Purely visual: nothing here feeds back into the simulation.

## `src/render/scene/Kopdes.ts`

The Kopdes building (GDD 6.3): chunky box body, oversized pitched-roof slab,
a flag block. Level-ups add a wing (M1b). Hiring a security guard puts a
small post hut on the corner of the block, where the guard waits between
patrols.

### Notes

- `buildKopdesGeometry()`: the building grows in one direction (GDD 6.3). A
  one-room shop under a single fall of roof becomes a co-op: the ridge rises,
  the far slope reaches out past the walls, and what it covers is open ground
  on timber posts. That open hall is what the upgrades buy, so the shape says
  the level out loud. West is -x and holds the ridge; the roof falls east
  over the walls. Every eave and post is worked out from the two lines of the
  roof rather than placed by hand, so the posts meet what they carry.
- `plane()`: a roof plane laid between two points, seen side on. The box is
  as long as the run between them plus the overhang at each end, and sits on
  the line rather than across it: it is lifted half its thickness along its
  own normal.
- `gableWall()`, the height of each step: the tallest point of a step is its
  uphill edge, so that is the height it takes, less a finger's width (0.16).
  Any more and the corner of the step stands proud of the roof it is meant to
  be holding up, or fights it for the same pixels.
- The windows, from level 2: they go in the blank east wall, not the front.
  The front is the door, the step and the annex, and a pane there ends up
  under the eave or behind the annex roof.
- The dormer: it sits on the slope, not in it. Its walls stand clear of the
  roof at the uphill edge and are tucked under it at the downhill edge, so
  the box is as tall as the roof falls across it, plus the part that shows.

## `src/render/scene/Lightning.ts`

Lightning (GDD 3.6): a boxy bolt over the block a storm just hit, fading in a
few hundred milliseconds. Unlit and brighter than white, so it glows; and
blooms when the glow pass is on. `Sky.flash` lights the rest of the world.

## `src/render/scene/Motorcade.ts`

The presidential motorcade (GDD 3.8, GDD 6.5): when the estate certifies, a long
black car with two flags on the bonnet comes up the road between two white
escorts and stops in front of the Kopdes porch. The President steps out,
walks to the door, and tells you your palms will do the country a favour;
the epilogue card opens once he is there. Only for the win; nobody comes
for a bankruptcy. Purely visual, and driven by the App's clock, not the
sim's: the sim has already ended.

## `src/render/scene/Overlays.ts`

In-scene overlays (GDD 8 #11, #21): the selection ring, the Kopdes range ring
and the fire-spread preview. The selection ring is a flat glowing frame
that pops in with `easeOutBack`; the others float just above the block so
they read on any terrain.

### Notes

- `overlayHeight()`: an overlay sits just above the highest point of the
  land the mesher draws on the block, sampled at its centre and near its four
  corners. Blended wild land (and a block being cleared) is not flat, so the
  terrace height alone buried the ring on the high side.
- `SelectionRing`: the selection ring (GDD 8 #11) is a flat blue frame on the
  block with an additive halo glowing out of it, pulsing gently. It is unlit
  and brighter than white, so it reads against any ground, and it blooms when
  the glow pass is on.
- `SelectionRing.update()`, `pulsing`: false holds the glow steady, for a
  paused estate where nothing at all should be moving. The pop-in still
  runs: the ring is the cursor, and a click has to answer even with the clock
  stopped.
- `RangeRing`: the Kopdes range ring (GDD 8 panel 21) is a thin frame on
  every block the Kopdes can sell for, drawn while the shop is open. It is
  rebuilt when the Kopdes moves or levels up; a few hundred boxes at most.
- `RangeRing`'s materials: the same flat, self-lit treatment as the
  selection ring, a shade deeper and a good deal thinner. Many of these are
  on screen at once, and they are the estate's edges, not the block the
  player is looking at.

## `src/render/scene/Palms.ts`

Instanced palms (GDD 6.6): one `InstancedMesh` per growth stage and variant,
plus stumps, rebuilt from sim state whenever a planted block changes. At
estate scale that is a few thousand matrices; cheap enough to redo
wholesale rather than track slots.

Pop-in and grow animations run on the CPU here (GDD 6.5 CPU timeline). The GPU
per-instance path (`InstanceAnim`) takes over when palm counts justify it.

Reforested blocks draw forest trees instead (`geometry/forestTree.ts`): a
staked sapling, a young tree, a small mature tree, in two variants, with a
little jitter, scale and yaw per slot so the block reads as woodland and
not as a second plantation.

### Notes

- `CANOPY_SHARE` and `SHRUB_SHARE`: a wild forest block carries about a
  dozen trees and a few bushes over its 144 columns (`props.ts`: 36 spots, a
  third of them trees), so a block that has grown back aims for the same,
  with 9% of its slots reaching the canopy and 12% left as shrubs. The rest
  of the slots are bare forest floor once the canopy closes.

## `src/render/scene/Police.ts`

Police cars at the Kopdes (GDD 3.9, GDD 6.3): boxy bodies and cabins with a light
bar that blinks. They drive up while an investigation is open, and a
SWAT-style truck joins them at the arrest.

## `src/render/scene/Rain.ts`

Rain (GDD 6.1): streaks falling over the part of the world in view, as thick
as the day's rain. One instanced mesh; positions are stepped on the CPU;
a couple of thousand drops is nothing next to the terrain.

### Notes

- `update()`: `rain` is today's rain, 0 to 1. `sky` is what the day is
  called (GDD 3.6), and only rain and storms fall. `view` is the ground in
  view, which drops respawn over. `running` is false while paused, and the
  drops hang where they are.
- `update()`, whether it rains at all: the sky decides, not the number
  behind it. A damp day the HUD calls cloudy must not have rain falling on
  it. Past that, the shower thickens with the day's rain, from a drizzle at
  `SKY.rainAbove` up to the full count.

## `src/render/scene/Sky.ts`

Sky, fog and lights driven by weather (GDD 6.4). Built before anything else
because it carries the game's atmosphere.

The season lerps the palette and the sky; rain darkens both; smoke and ash
wash the world toward amber-grey or neutral grey and close the fog in. The
smoke and ash amounts ease toward their targets, so a haze season settles
over the estate rather than switching on.

## `src/render/scene/Sparkles.ts`

Sparkles (GDD 6.5): a few glints turning over something worth a click, so a
golden capybara in the grass or a babi ngepet up on two legs reads as
"this one, now" rather than as scenery.

One instanced mesh, a fixed ring of glints per point, stepped on the CPU.
The caller hands in the points every frame; nothing is kept between them.

`SparkleBurst` is the other half: one throw of glints that arc out, turn
over and go. It is for a moment rather than a state, such as the Kopdes
coming back bigger after an upgrade.

## `src/render/scene/Timber.ts`

Trees coming down (GDD 6.5): while a forest block is being chopped, its trees
go one at a time; each quarter of the job fells another; and the last
one drops when the block clears and the chunk remeshes. A tree tips slowly
at first, gathers speed, hits the ground with a shudder, lies a moment, and
settles into the earth. Purely visual.

## `src/render/scene/Wisps.ts`

Wisps (GDD 6.5): the smoke that hangs around a babi ngepet. In the stories the
thing arrives in a haze and leaves in one, so smoke is how you know the pig
crossing your land is not a pig.

One instanced mesh, a fixed column of puffs per point, stepped on the CPU
the way `Sparkles` is. The caller hands in the points every frame, and each
puff rises, spreads and fades on its own loop.

## `src/render/scene/WorkSite.ts`

The work site (GDD 6.5): while a crew is chopping or burning a block, four
timber pillars go up at its corners with ropes strung between them; the
crew's scaffolding and cordon. Up when the work starts, gone when the block
clears or the crew walks off. A fire with no crew (lightning, a spread, a
wildfire) is just a fire. Purely visual; one mesh per worked block.

## `src/render/scene/chunkField.ts`

From world + estate to a column field for one chunk (GDD 6.3, GDD 6.7).

Column height for wild land is the bilinear blend of the four nearest
blocks' continuous heights, quantised to half-unit steps; smooth ground
that reads as staircases, and never a one-column pit (bilinear is monotone
between samples; the art spike learned that lesson the hard way). Planted,
cleared and Kopdes blocks are levelled terraces at the block's base height,
cut into whatever the land around them does. Water sits a step below,
along the smoothed channel of `riverChannel.ts` rather than the river's
blocks, and wild ground is tinted and its biome edges warped by noise so
the land does not read as a checkerboard. Trees and rocks grow on top.

Runs in the mesher worker, so it imports nothing that touches the renderer.

### Notes

- `DivergedBlockLite.planted`: which of the block's slots have something
  standing in them, one byte per slot, or null for a block with no palms at
  all. The ground grid is one column per slot, so an empty slot is a column
  of bare earth: a hectare planted with half the bibit it needed looks half
  planted.
- `landHeight()`: the height of the land the mesher draws under world point
  (x, z). It is a flat terrace on the `TERRACED` phases (cleared, planted,
  reforesting and Kopdes blocks), and otherwise the same bilinear blend of
  neighbouring block heights the columns use, snapped to the same quantum.
  Anything standing on the ground (mobs, cars, felled trees) must use this,
  or it floats or sinks wherever the two formulas disagree. The river's cut
  is not applied; nothing should be standing in the river.
- The bare-slot check in the top-slot pass: a planted hectare is only green
  where something stands. The ground grid is one column per slot, so an empty
  slot is its own column of bare earth, and a half-planted block reads as
  half planted. Burning, flooded and slid ground keeps its own colour.
- `warpedBiome()`: the biome whose colour a wild column shows, which is its
  own, or a wild neighbour's when the warped sample point lands there, so
  edges between wild biomes wander instead of following the block grid.
  Estate blocks stay crisp.

## `src/render/scene/chunkProtocol.ts`

Messages between `ChunkManager` and the mesher worker (GDD 6.7).

The worker owns its own `World` (rebuilt from the seed on first use) and
receives only the diverged blocks it needs, so the main thread never ships
terrain. Mesh arrays come back as transferables.

## `src/render/scene/props.ts`

Where the scenery grows (GDD 6.1, GDD 6.3). The models live in `render/models/`;
this file is the ecology; which of them each kind of land carries, and
how thickly.

- forest: rainforest trees, the odd emergent giant hung with vines, fallen
  logs, understory bushes and flowers, a weeping fig or a wood cabin now and then
- protected forest: the same, denser and older, more giants
- riverbank: willows, reeds at the water's edge, flowers
- grassland: tufts, wildflowers, bushes, a lone tree, rarely an abandoned house
- scrub: dry bushes, dead trees, cactus, tumbleweed, rocks
- hills: pines and boulders; spires and caves on the high ridges
- villages: stilt houses around a weeping fig
- burning, or burned within the ash window: charred snags on charred ground

Props are merged into the chunk mesh the worker builds, so they stream and
rebuild with the terrain: chop a forest block and its chunk is remeshed
without the trees. Each block visits a jittered grid of spots, asks what the
ground there shows (the same warped edges the ground colour uses, so forest
edges wander across the block grid), and rolls that land's table. A hash of
(seed, block, draw) makes a block always grow the same things.

### Notes

- `growFence()`: the fence between the planted rows and the ground nothing
  stands on (GDD 6.3). It is drawn only where a planted slot meets an empty
  one inside the same hectare, which is the line a grower would actually
  fence: the edge of the crop. Block boundaries are already drawn by the
  terrain, so nothing is doubled up there. Posts are set at one end of each
  run so neighbouring segments share them, and the rails are two thin bars,
  which is enough to read as a fence from the height the camera sits at.

## `src/render/scene/riverChannel.ts`

The river as it is drawn (GDD 6.1): a smooth, meandering channel instead of
the block staircase the simulation reasons about.

Each river's cell path becomes a polyline through block centres, is rounded
with Chaikin corner cutting, resampled, and pushed sideways by low-frequency
noise so long runs bend. The channel widens from source to mouth. The
mesher asks one question per column; how far is it from the water's edge;
which a per-block bucket of nearby segments answers cheaply.

Only the picture changes. Which blocks are river is still `world.rivers`;
the mesher confines the water to blocks at most two cells from it.
