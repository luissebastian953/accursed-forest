# Shared

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/shared/EventBus.ts`

The render and UI event bus (GDD 10.2), a typed wrapper over `mitt`.

`sim/` deliberately does not use it: the simulation returns an array of
`SimEvent`s from each tick and never emits. The bus is only for the layers
above the sim talking to each other through `app/`.

## `src/shared/base64.ts`

Typed-array <-> base64 codec for save files (GDD 7).

Little-endian is assumed; every platform the game runs on is little-endian,
and saves that move between machines do so as exported JSON of these same
strings, so the assumption travels with the data.

## `src/shared/compact.ts`

A number short enough for a narrow column (GDD 10.2): 4,000 reads as 4K, and
the same again at every thousand up to a trillion. Shared rather than a UI
helper because the sim writes some player-facing strings of its own, the
ledger's sale note among them, and both sides should shorten a number the
same way.

## `src/shared/math.ts`

Small numeric helpers shared by every layer. No allocations, no dependencies.

### Notes

- `sampleCurve()`: samples a piecewise-linear curve defined by knots sorted
  ascending by `x`. Values outside the knot range clamp to the first or last
  knot. This is how the yield curve and the moisture curve are expressed in
  `sim/balance/*` (GDD 4.5).
