# Shared

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/shared/base64.ts`

Typed-array <-> base64 codec for save files (§7).

Little-endian is assumed; every platform the game runs on is little-endian,
and saves that move between machines do so as exported JSON of these same
strings, so the assumption travels with the data.

## `src/shared/math.ts`

Small numeric helpers shared by every layer. No allocations, no dependencies.
