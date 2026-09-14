# 2. Saves go to localStorage, chunked, behind an adapter

Status: accepted

## Context

Saves must survive a reload with no backend. A 64x64 world with a 40-block estate
is roughly 58 KB of palm arrays before compression; untouched land costs nothing
because the world is regenerated from the seed.

## Decision

`localStorage` (~5 MB/origin), written as a manifest plus one entry per 4x4 sim
chunk that contains at least one block diverged from world generation. Autosave
rewrites only dirty chunks. Typed arrays are base64-encoded; the payload is
compressed with `lz-string`, which is UTF-16-safe.

Cookies were rejected: ~4 KB, sent on every request, no structured API.

All access goes through `persistence/storage.ts` so a move to IndexedDB is a
change of adapter, not of callers.

## Consequences

- Autosave is a few small writes rather than one large string.
- `QuotaExceededError` is a real case: it must surface in the HUD and offer an
  export, not fail silently.
- Save schema changes need a migration step; a save from a newer schema is
  refused rather than half-read.
