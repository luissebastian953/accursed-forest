# Persistence

What each module is for, as it was written at the top of the file before the
headers moved here. A `§` number points into the [design document](../gdd/README.md).

## `src/persistence/autosave.ts`

Autosave (§7): every N sim days, and when the tab is hidden or closing.

The first write after construction is a full write; after that only dirty
chunks are rewritten. A failed write puts the dirty set back so nothing is
lost, and reports through `onError` so the HUD can warn and offer an export.

## `src/persistence/chunks.ts`

A save slot (§7): one manifest key plus one key per sim chunk that holds a
diverged block. Autosave rewrites only chunks flagged dirty since the last
write, so a large estate's autosave is a few small writes.

Chunk payloads are lz-string compressed to UTF-16; `localStorage` stores
UTF-16, so that is the encoding that actually shrinks the footprint. The
manifest stays plain JSON by default, readable when debugging; year
snapshots compress it too, because 25 copies of a late-game command log
would not fit beside the save (a year-12 manifest is ~260k characters).
Loading accepts either.

Writes are not atomic across keys. A crash between a chunk write and the
manifest write leaves the old manifest pointing at the same chunk keys with
one chunk newer than the rest; a block or two a tick ahead, not a corrupt
save. The alternative (versioned chunk keys and a swap) is not worth it for
a 30-day autosave cadence.

## `src/persistence/migrations.ts`

Save migrations (§7): an ordered list of `schema N → N+1` steps applied to
the raw JSON before it is validated and decoded. A save from a newer schema
than this build knows is refused with a clear error, never half-read.

## `src/persistence/schema.ts`

Save file shape (§7) and the encode/decode between it and `SimState`.

A save is a manifest plus one entry per sim chunk that contains at least one
diverged block. Typed arrays travel as base64; untouched land is never
stored because the world regenerates from the seed.

Every field is validated with zod on load so a corrupt or hand-edited save
fails loudly with a `SaveError`, not weirdly three years into a run.
Decoding is written out field by field rather than cast, so a shape change
in `sim/types.ts` is a compile error here rather than a runtime surprise.

## `src/persistence/storage.ts`

Key-value storage adapter (§7).

Everything persistence writes goes through this interface, so moving from
`localStorage` to IndexedDB is a new adapter, not a change to callers.
`QuotaError` is the one failure the game must handle visibly: the HUD shows a
warning and offers an export rather than losing the save silently.
