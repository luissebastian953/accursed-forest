# Rendering: the scene

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/render/scene/Ceremony.ts`

The ISPO ceremony at the Kopdes (§3.8, §6.5): a banner on two poles pops in
with `easeOutBack`, and fireworks burst over the roof for a few seconds.
Clean or dirty, it is the same ceremony; the epilogue tells the difference.

## `src/render/scene/ChunkManager.ts`

Chunk streaming (§6.7).

Each frame: project the camera's ground rectangle onto chunk coordinates
(plus a one-chunk margin), queue missing chunks nearest-first, ask the
mesher worker for at most `maxInFlight` at a time, and drop chunks that
have been out of view for a while into an LRU so a quick pan back is free.
A dirty chunk is rebuilt and swapped in atomically when its mesh arrives.

The far-LOD heatmap tiles (§6.6) are not here yet; zoom is clamped by the
MapRig so the near ring stays inside the budget meanwhile.

## `src/render/scene/Clouds.ts`

Clouds (§6.1): small white chunks drifting over the estate, see-through
enough that the land reads through them. They are scenery, not weather:
the sky's own mood is `Sky.ts`.

They drift down and to the left of the screen whichever way the camera is
turned, so the direction is taken from the camera each frame rather than
fixed in the world. They live on a tile that follows the view and wraps,
so a handful of them covers any amount of panning.

## `src/render/scene/Coins.ts`

Gold coins (§6.5): a handful thrown into the air that arc, spin, land and
settle into the grass before they wink out. Anything that pays out on the
map borrows this: a golden capybara spotted, a babi ngepet caught with its
takings.

One instanced mesh stepped on the CPU, with a fixed pool: a burst is a
dozen coins and they last a second and a half, so the pool is never the
thing that breaks. A burst past the pool drops its extra coins rather than
growing the buffer mid-frame.

## `src/render/scene/Excavator.ts`

The excavator (§3.6.2): the machine that comes with the crew when a
landslide is dug out. It crawls onto the block, swings its boom into the
spoil, lifts, turns to dump, and goes back for more, for as long as the
crew is on the block.

One machine at a time, like the motorcade: the estate never has two slides
being dug at once often enough to be worth the parts.

## `src/render/scene/Fires.ts`

Fire on burning blocks (§6.4 "Fire"): glowing box particles.

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

The Kopdes building (§6.3): chunky box body, oversized pitched-roof slab,
a flag block. Level-ups add a wing (M1b). Hiring a security guard puts a
small post hut on the corner of the block, where the guard waits between
patrols.

## `src/render/scene/Lightning.ts`

Lightning (§3.6): a boxy bolt over the block a storm just hit, fading in a
few hundred milliseconds. Unlit and brighter than white, so it glows; and
blooms when the glow pass is on. `Sky.flash` lights the rest of the world.

## `src/render/scene/Motorcade.ts`

The presidential motorcade (§3.8, §6.5): when the estate certifies, a long
black car with two flags on the bonnet comes up the road between two white
escorts and stops in front of the Kopdes porch. The President steps out,
walks to the door, and tells you your palms will do the country a favour;
the epilogue card opens once he is there. Only for the win; nobody comes
for a bankruptcy. Purely visual, and driven by the App's clock, not the
sim's: the sim has already ended.

## `src/render/scene/Overlays.ts`

In-scene overlays (§8 #11, #21): the selection ring, the Kopdes range ring
and the fire-spread preview. The selection ring is a flat glowing frame
that pops in with `easeOutBack`; the others float just above the block so
they read on any terrain.

## `src/render/scene/Palms.ts`

Instanced palms (§6.6): one `InstancedMesh` per growth stage and variant,
plus stumps, rebuilt from sim state whenever a planted block changes. At
estate scale that is a few thousand matrices; cheap enough to redo
wholesale rather than track slots.

Pop-in and grow animations run on the CPU here (§6.5 CPU timeline). The GPU
per-instance path (`InstanceAnim`) takes over when palm counts justify it.

Reforested blocks draw forest trees instead (`geometry/forestTree.ts`): a
staked sapling, a young tree, a small mature tree, in two variants, with a
little jitter, scale and yaw per slot so the block reads as woodland and
not as a second plantation.

## `src/render/scene/Police.ts`

Police cars at the Kopdes (§3.9, §6.3): boxy bodies and cabins with a light
bar that blinks. They drive up while an investigation is open, and a
SWAT-style truck joins them at the arrest.

## `src/render/scene/Rain.ts`

Rain (§6.1): streaks falling over the part of the world in view, as thick
as the day's rain. One instanced mesh; positions are stepped on the CPU;
a couple of thousand drops is nothing next to the terrain.

## `src/render/scene/Sky.ts`

Sky, fog and lights driven by weather (§6.4). Built before anything else
because it carries the game's atmosphere.

The season lerps the palette and the sky; rain darkens both; smoke and ash
wash the world toward amber-grey or neutral grey and close the fog in. The
smoke and ash amounts ease toward their targets, so a haze season settles
over the estate rather than switching on.

## `src/render/scene/Sparkles.ts`

Sparkles (§6.5): a few glints turning over something worth a click, so a
golden capybara in the grass or a babi ngepet up on two legs reads as
"this one, now" rather than as scenery.

One instanced mesh, a fixed ring of glints per point, stepped on the CPU.
The caller hands in the points every frame; nothing is kept between them.

`SparkleBurst` is the other half: one throw of glints that arc out, turn
over and go. It is for a moment rather than a state, such as the Kopdes
coming back bigger after an upgrade.

## `src/render/scene/Timber.ts`

Trees coming down (§6.5): while a forest block is being chopped, its trees
go one at a time; each quarter of the job fells another; and the last
one drops when the block clears and the chunk remeshes. A tree tips slowly
at first, gathers speed, hits the ground with a shudder, lies a moment, and
settles into the earth. Purely visual.

## `src/render/scene/Wisps.ts`

Wisps (§6.5): the smoke that hangs around a babi ngepet. In the stories the
thing arrives in a haze and leaves in one, so smoke is how you know the pig
crossing your land is not a pig.

One instanced mesh, a fixed column of puffs per point, stepped on the CPU
the way `Sparkles` is. The caller hands in the points every frame, and each
puff rises, spreads and fades on its own loop.

## `src/render/scene/WorkSite.ts`

The work site (§6.5): while a crew is chopping or burning a block, four
timber pillars go up at its corners with ropes strung between them; the
crew's scaffolding and cordon. Up when the work starts, gone when the block
clears or the crew walks off. A fire with no crew (lightning, a spread, a
wildfire) is just a fire. Purely visual; one mesh per worked block.

## `src/render/scene/chunkField.ts`

From world + estate to a column field for one chunk (§6.3, §6.7).

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

## `src/render/scene/chunkProtocol.ts`

Messages between `ChunkManager` and the mesher worker (§6.7).

The worker owns its own `World` (rebuilt from the seed on first use) and
receives only the diverged blocks it needs, so the main thread never ships
terrain. Mesh arrays come back as transferables.

## `src/render/scene/props.ts`

Where the scenery grows (§6.1, §6.3). The models live in `render/models/`;
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

## `src/render/scene/riverChannel.ts`

The river as it is drawn (§6.1): a smooth, meandering channel instead of
the block staircase the simulation reasons about.

Each river's cell path becomes a polyline through block centres, is rounded
with Chaikin corner cutting, resampled, and pushed sideways by low-frequency
noise so long runs bend. The channel widens from source to mouth. The
mesher asks one question per column; how far is it from the water's edge;
which a per-block bucket of nearby segments answers cheaply.

Only the picture changes. Which blocks are river is still `world.rivers`;
the mesher confines the water to blocks at most two cells from it.
