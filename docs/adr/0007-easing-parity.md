# 0007. The easing curves exist twice, and a test keeps them equal

Date: 2026-09-19. Status: accepted. Recorded from the reasoning that lived at
the top of `src/render/anim/easing.ts`.

## Context

Animation happens in two places. Pop-ins, the selection ring and the camera
ease on the CPU, in `easing.ts`. Per-instance animation on the palms happens
on the GPU, as TSL nodes in `easingTSL.ts`, because thousands of instances
cannot be posed one at a time per frame.

Both need the same curves, and a curve that differs between the two makes a
palm land differently from the ring around it.

## Decision

Keep two implementations, one per side of the bus, and hold them equal with
`tests/render/easing-parity.test.ts`, which samples every curve at 32 points
on each side and asserts they agree.

## Why not one

There is no way to run a TSL node on the CPU without the renderer, and no way
to ship a JavaScript function to the GPU. A single source would mean code
generation, which is more machinery than eleven small functions justify.

## Consequences

- **Change a curve in `easing.ts` and you must change it in `easingTSL.ts`.**
  The parity test fails until you do, and it names the curve and the sample.
- New curves are added in pairs.
- The "back", "elastic" and "bounce" families overshoot on purpose; the test
  compares values, not monotonicity.
