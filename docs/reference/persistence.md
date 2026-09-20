# Persistence

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/persistence/autosave.ts`

Autosave (GDD 7): every N sim days, and when the tab is hidden or closing.

The first write after construction is a full write; after that only dirty
chunks are rewritten. A failed write puts the dirty set back so nothing is
lost, and reports through `onError` so the HUD can warn and offer an export.

## `src/persistence/chunks.ts`

A save slot (GDD 7): one manifest key plus one key per sim chunk that holds a
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

### Notes

- `SaveSlot.save()`: writes the manifest and the given chunks. `dirty` names the
  chunk keys to rewrite; `'all'` rewrites every chunk, and the first save, and
  the save after a load, must pass it. It returns the storage keys it wrote,
  chunks first and the manifest last.

## `src/persistence/migrations.ts`

Save migrations (GDD 7): an ordered list of `schema N → N+1` steps applied to
the raw JSON before it is validated and decoded. A save from a newer schema
than this build knows is refused with a clear error, never half-read.

### Notes

- `MIGRATIONS`, the step from schema 4 (M1g, endings): a v4 save kept no books,
  so the step rebuilds what it can from what the save did keep. Profit comes
  from the ledger, which is capped, so the rebuilt profit is a floor rather
  than the true figure. The last burn comes from the command log, and the
  chronicle is seeded from the warnings in the news.
- `MIGRATIONS`, the step from schema 12 (redemption): nothing in an old save
  changes. The bump exists so that a build that has never heard of the
  redemption ending refuses the save, rather than choking on it when it reads
  `run.ending`.

## `src/persistence/schema.ts`

Save file shape (GDD 7) and the encode/decode between it and `SimState`.

A save is a manifest plus one entry per sim chunk that contains at least one
diverged block. Typed arrays travel as base64; untouched land is never
stored because the world regenerates from the seed.

Every field is validated with zod on load so a corrupt or hand-edited save
fails loudly with a `SaveError`, not weirdly three years into a run.
Decoding is written out field by field rather than cast, so a shape change
in `sim/types.ts` is a compile error here rather than a runtime surprise.

### Notes

- `CURRENT_SCHEMA`: bump it on any breaking change to the save shape, and add a
  migration alongside. What each schema brought:
  1. M1a: blocks, palms, economy, weather, society, run, command log.
  2. M1b: the economy gains `tbsPriceHistory`, `tbsPending` and `soldKgTotal`.
     M1c added command variants (burn, sanitize, irrigate, drain) without a
     bump: a v2 save's command log only ever holds commands that existed.
  3. M1d: the palm arrays gain `ganodermaSince` and `trenched`.
  4. M1f: news items gain a template key; society gains `lettersReceived`.
  5. M1g: the run gains the profit books, stats, year summaries, the chronicle
     and `sandbox`, and loses `yearSnapshots` (the snapshots are storage keys);
     society gains `operatingBanUntil`; the ledger gains the `capital` kind.
  6. M1 balance pass: the Kopdes gains the auto-harvest toggle.
  7. M1 weather pass: the weather carries the day's sky.
  8. Mobs: the head carries the mobs on the estate and the next mob id.
  9. Weather spells: the weather carries how long the sky holds.
  10. Mob repertoire: mobs carry a behaviour timer, an anchor and a heading.
  11. Natural fires: the weather lists the blocks lightning lit, and the
      reboisasi ending.
  12. The canopy: pangolins join the wildlife, mobs carry how far up a tree
      they are, and a capybara can be the golden one.
  13. Redemption: a run can end in a way older builds have no name for.
  14. Landslides: a block remembers the slide that tore it up and what it
      buried, until something is planted there again.
  15. Excavation: the shop sells a crew to dig a slide out, and a block
      remembers when they will be finished.
  16. Estate names: the manifest carries the name the player gave the estate;
      an older save is simply unnamed, and the HUD falls back to its code.
  17. The headline deck remembers what has already run (`society.macroSeen`),
      for the events that land once.
  18. Clearing a plantation: a block remembers when the crew felling it will
      finish (`fellingUntil`).

## `src/persistence/storage.ts`

Key-value storage adapter (GDD 7).

Everything persistence writes goes through this interface, so moving from
`localStorage` to IndexedDB is a new adapter, not a change to callers.
`QuotaError` is the one failure the game must handle visibly: the HUD shows a
warning and offers an export rather than losing the save silently.
