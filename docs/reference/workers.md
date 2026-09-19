# Workers

What each module is for, as it was written at the top of the file before the
headers moved here. A `GDD n` reference points into the [design document](../gdd/README.md).

## `src/workers/mesher.worker.ts`

Mesher worker (GDD 6.7): builds one chunk's column mesh per request and posts
the arrays back as transferables. World generation happens here too; the
worker has the same seeded generator, so the main thread never serialises
terrain.
