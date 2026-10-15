# 8. No obfuscation

Status: accepted, 2026-10-15. Supersedes the production obfuscation pass that
`vite.config.ts` carried from the first deploy.

## Context

Production builds ran the game's own chunks through `javascript-obfuscator`:
hexadecimal identifiers everywhere, and string literals moved into an encoded,
rotated array in the app and UI chunks. The intent was to raise the cost of
reading and reusing the code. The README was honest about the limit: the
browser runs whatever it downloads, so nothing was encrypted.

Measured on the live build of 2026-10-15, against the same build with the pass
off:

| Chunk | Obfuscated, gzip | Plain, gzip |
| ----- | ---------------- | ----------- |
| App   | 178.8 KB         | 126.6 KB    |
| play  | 5.8 KB           | 3.9 KB      |
| All   | 574 KB           | 520 KB      |

That is 54 KB more to download and 87 KB more to parse on every visit, plus
the string-array decode at startup, on the page whose mobile Lighthouse score
was 41 with 2.1 seconds of blocking time.

## Decision

The pass is removed, along with the dependency and `VITE_OBFUSCATE`. Builds are
minified by the bundler and ship no source maps; `VITE_SOURCEMAP=1` emits maps
for debugging a deployment.

## Reasons

- There is nothing to protect. The game has no server, no accounts, no paid
  content and no leaderboard, so a reader of the bundle gains nothing a player
  does not already have.
- The one real threat, a portal rehosting the bundle to take the traffic, is
  not stopped by obfuscation: the copy is of the built files. A hostname check
  that points back to the real site is the cheaper answer if it is ever needed.
- The sim is deterministic: a seed plus a command log replays a run exactly.
  If a leaderboard ever exists, that replay, verified away from the client, is
  the anti-cheat, and obfuscation would never have substituted for it.
- The cost landed on the players least able to pay it, on phones in Indonesia.

## Consequences

The code is readable in the browser's devtools. That is the same position every
browser game is in, and the one the README already admitted.
