# Rendering: models

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/render/models/buildings/houses.ts`

Buildings off the estate: a village stilt house (rumah panggung), a wood
cabin in the trees, and an abandoned house going back to the forest.

## `src/render/models/ground/log.ts`

A fallen log on the forest floor, with a stump or a fungus shelf now and then.

## `src/render/models/ground/spoil.ts`

What a landslide leaves on a hectare: heaps of spoil, and the branches that
came down the slope with it, snapped off and driven into the mud.

## `src/render/models/index.ts`

Every scenery model, by folder: trees, plants, rocks, ground litter and
buildings. Each is a `Model` (see `kit.ts`); `props.ts` decides where they
grow, and `?models` lays them all out in a gallery.

## `src/render/models/kit.ts`

The model kit (GDD 6.3): every scenery model is a function that adds boxes to
a `BoxBuilder` at a placement. Models describe themselves in local space;
origin on the ground at the model's foot, +Y up; and the kit applies the
placement's position, turn and scale.

Models draw from `rand`, a 0..1 source the caller seeds per spot, so the
same spot always grows the same tree.

## `src/render/models/plants/bush.ts`

Understory bushes: a lumpy mound, and a flowering variant dotted with blooms.

## `src/render/models/plants/desert.ts`

Dry-country plants for the scrub: a branching cactus and a tumbleweed.
(Indonesia's scrub grows neither; the scrub is the driest land there is.)

## `src/render/models/plants/flowers.ts`

A patch of wildflowers: thin stems, bright heads.

## `src/render/models/plants/grass.ts`

Ground cover: a grass tuft, and reeds for the water's edge.

## `src/render/models/plants/vines.ts`

Vines hanging from a crown's edge, for trees that carry them.

## `src/render/models/rocks/rocks.ts`

Stone: a boulder cluster, a spire for the high ridges, and a cave in a rock mound.

## `src/render/models/trees/burntTree.ts`

What a wildfire leaves standing: a charred snag, snapped short, one stub of a branch.

## `src/render/models/trees/deadTree.ts`

A dead tree: bleached, leafless, a couple of bare branches.

## `src/render/models/trees/giantTree.ts`

Emergent giant: a tree that stands over the canopy, with buttress roots
flaring at its foot, a crown of broad layers, and vines hanging from it.

## `src/render/models/trees/pineTree.ts`

Mountain pine (Pinus merkusii on the highland ridges): stacked tiers narrowing to a point.

## `src/render/models/trees/rainforestTree.ts`

Lowland rainforest tree: a tall, bare trunk carrying flat umbrella layers
of canopy; the dipterocarp silhouette of a Kalimantan forest.

## `src/render/models/trees/weepingFig.ts`

Weeping fig (beringin): a short, massive trunk under a wide dome, with
aerial roots dropping from the crown to the ground; the village tree.

## `src/render/models/trees/willowTree.ts`

Willow by the water: a leaning trunk, a rounded crown, and curtains of strands hanging to the bank.
