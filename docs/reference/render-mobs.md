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

## `src/render/mobs/species.ts`

The cast (POC): who walks around the estate.

Every one is the same handful of boxes in a different arrangement; a
quadruped body with four swinging legs, an ape on two, or a biped with two
arms; so they
all animate from the one rig in `rig.ts`. Sizes are in world units, where a
palm slot is 1 and a mature palm stands about 4.
