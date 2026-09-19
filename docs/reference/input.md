# Input

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/input/keys.ts`

Keyboard shortcuts (§6.2, §8): space pauses, 1/2/3 pick a speed, Q/E snap
the camera a quarter turn, F jumps to the Kopdes, K opens the shop, N the
news, H (or ?) the controls, Escape closes things.

## `src/input/pointer.ts`

Pointer input (§6.2): click selects a block, double-click focuses it.
MapControls owns dragging, so a press that moves is a pan, not a click.
