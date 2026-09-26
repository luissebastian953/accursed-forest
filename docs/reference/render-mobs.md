# Rendering: the crowd

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/render/mobs/MobField.ts`

The crowd on screen. Two sources, one rig:

- `syncSim(state)`: the game's mobs. The simulation moves them a few
  blocks a day; here each one glides toward its latest position and its
  gait follows how fast it is actually moving, so a boar the sim moved a
  block and a half walks it. Species come from the sim; the babi ngepet is
  drawn as a pig until it stands up.
- `spawn()`: the proof of concept's own wanderers, for the `?mobs` page,
  in either draw mode.

Drawing is CPU skinning into one dynamic mesh per material: every frame the
rig poses each part, the part's box is transformed into a shared vertex
buffer, and the whole crowd is two draw calls with the terrain's own shader.
The instanced alternative (one `InstancedMesh` per species part) looked
cheaper on paper but three's node renderer keys a program on each instanced
object, so every part of every species that appeared compiled a fresh
shader; seconds of stall each on the software renderer, a hitch on real
GPUs. The `nodes` mode (a scene node per part) is kept for the POC's
comparison.

### Notes

- `flee()`: something has bolted. It runs for a moment, then fades out where
  it got to. The sim keeps walking it off the map, but as far as the player
  is concerned it went into the trees and was gone; it is remembered in
  `fled` so it does not come back until the sim lets it go.
- `update()`, `tickSeconds`: how long the sim's current day lasts in real
  time, so a sim-driven mob spreads its day's walk over the day instead of
  dashing it and then standing still.
- `update()`, the gliding branch: a sim-driven mob spreads the gap to its
  latest sim position over the rest of the day, so a slow day is a slow
  walk. It is never slower than a creep (15% of the species' pace), and
  faster than the species' pace only when the clock has run ahead of the
  legs. The legs, through the gait, follow the speed it actually moves at.
- The `opaque` parts: a species is see-through or solid as a whole, except
  for the parts that say otherwise. A ghost's eyes and a pocong's face go on
  the solid sheet while the rest of the body goes on a veiled one, which is
  why the reserve pass counts a mob's parts one at a time rather than adding
  its whole vertex count to one sheet.
- The three sheets: solid, spectral and dense, one draw call each and each
  invisible while empty, so a program is not compiled until something needs
  it. The dense one exists because a pocong is a corpse in a shroud and a
  ghost is an apparition: at the spectral material's 0.45 the shroud read as
  a smudge of the ground behind it. The app hands in a second see-through
  material at 0.85 for it; without one the field falls back to the spectral
  material and the pocong simply draws like a ghost.

## `src/render/mobs/rig.ts`

The mob rig (POC).

A mob is a tree of box parts; body, head, legs, tail; each with a pivot
and a role. `pose()` is the whole animation system: it reads the clock, the
mob's phase and how fast it is moving, and returns a local transform per
part. A walk is legs swinging out of phase, a body bobbing on the step, a
head that sways and a tail that wags.

Nothing here touches the scene graph, so the same rig drives both ways of
drawing a crowd; a node per part, or every part skinned into one mesh.
`MobField` measures the two against each other; see `app/MobPoc.ts`.
Beyond the walk it knows how to sleep (rolled on one side), crouch (the
thief) and work (a two-armed swing at whatever is in front of it).

### Notes

- `pose()`, the body at work: the arms do the swinging. The body used to
  pitch with them, which read as falling over rather than as effort, so it
  no longer does.
- `pose()`, the body sitting: on four legs, sitting means up on the
  haunches with the back sloped; on two, it means down on the ground, hips
  dropped and the back still up.
- `pose()`, the arms: up a trunk, both arms reach overhead and out round the
  bark; asleep, they tuck in. Sitting, an ape's arms are longer than the drop
  to the ground, so they come forward to rest rather than through it.
- `PartSpec.opaque`: a part drawn on the solid sheet even on a see-through
  body, for the two features that have to stay readable against the ground
  they float over: a ghost's eyes and a pocong's face. The rig only carries
  the flag; `MobField` is what acts on it.

## `src/render/mobs/species.ts`

The cast (POC): who walks around the estate.

Every one is the same handful of boxes in a different arrangement; a
quadruped body with four swinging legs, an ape on two, or a biped with two
arms; so they
all animate from the one rig in `rig.ts`. Sizes are in world units, where a
palm slot is 1 and a mature palm stands about 4.

### Notes

- `quadruped()`, `scales`: each plate is a thin slab just proud of the hide,
  laid in rows that overlap like roof tiles. Alternate rows are offset by
  half a plate, so the back reads as armour rather than as a grid. There are
  nine plates in all, which lands the species exactly on the rig's part
  budget of 24; the tail is too thin on screen for plates of its own to earn
  their cost.
- `ape()`: a great ape, upright on two short legs, with arms that nearly
  reach the ground, a heavy belly it carries in front of it, and the bare
  grey face and cheek flanges of an old male orangutan. Its legs take the
  biped roles, so the rig swings them against the arms rather than against a
  second pair.
- `ape()`, the chest and belly: the bare front is two boxes, a narrow chest
  above a gut that is wider than it and carried further forward. Two boxes
  taper where one slab of grey would read as a bib.
- `ape()`, the tail: only the ones that have one (the monkeys; the apes do
  not). It hangs off the back of the body rather than running through it,
  and droops as it goes: these legs are too short to hang a tail from, and a
  rod through the middle of the body reads as a spit.
- `ape()`, the tail's `at`: the root sits inside the rump, not against it.
  The droop turns the tail about its middle, and a tail that starts at the
  back face swings its near end out into the open.
- `SPECIES.pangolin`: a pale hide under dark armour, and a tail as long as
  the body. The plates carry the dark tone: light plates on a dark body read
  as patches, dark plates on a light body read as scales.
- `biped()`, `eyes`: two boxes on the front of the head in their own slot,
  set just proud of the face so they never sink into a see-through one, and
  marked `opaque` so they are drawn on the solid sheet whatever the body is.
  The ghost's are `Palette.GhostEye`, which is one of the emissive slots
  (`palette.ts`), so they carry the bloom and are what the eye finds first at
  estate zoom, where the body itself is a pale smudge.
- `pocong()`: a corpse in its shroud (GDD 3.11), tied at the feet, the neck
  and the top of the head, with a black void for a face. It is written out
  rather than built from `biped()` because it has none of a biped's parts: no
  arms, no legs, nothing to swing. `swing` is 0 and `bob` is more than half a
  unit, so the rig's step, which normally lifts a body a few centimetres, lifts
  the whole of this one: it hops. The knot above the head is three tiers, each
  wider than the last, which is what makes the silhouette read as a pocong and
  not as a pillar.
