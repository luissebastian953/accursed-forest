# 4. pnpm, and lint as the guard on the layer rule

Status: accepted

## Context

`three/addons/*` and `three/tsl` are the kind of deep imports that work by
accident under a flat `node_modules` and break in CI. Separately, the layering in
ADR 1 is only worth anything if something checks it.

## Decision

pnpm, pinned through `packageManager` and Corepack, with `engine-strict`,
`auto-install-peers` and `save-exact` set. Three.js and TSL move fast; upgrades
are deliberate.

ESLint flat config with `typescript-eslint`, `eslint-plugin-import-x` and
`eslint-plugin-boundaries`. Biome was considered and rejected: faster, but it
cannot express the boundary rule, and that rule is the point.

## Consequences

- `three` ships no type declarations, so `@types/three` is pinned to match.
- TypeScript is held at 5.9 until `typescript-eslint` supports 7.x; the boundary
  rule is worth more than the newer compiler.
- A layer violation fails the build rather than being caught in review.
