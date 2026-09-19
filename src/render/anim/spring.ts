export interface Spring {
  /** Current value. */
  x: number;
  /** Current velocity, in units per second. */
  v: number;
}

export interface SpringConfig {
  /** Stiffness. */
  k: number;
  /** Damping. */
  c: number;
}

/** Toy-like wobble: zeta ~= 0.54, settles inside ~600 ms (§6.5). */
export const TOY_SPRING: SpringConfig = { k: 170, c: 14 };

/** Camera and panels: no visible overshoot. */
export const CALM_SPRING: SpringConfig = { k: 120, c: 24 };

export function createSpring(x = 0, v = 0): Spring {
  return { x, v };
}

/** Largest integration step that stays stable for the stiffnesses above. */
const MAX_STEP = 1 / 120;

/**
 * Advance a spring toward `target` by `dt` seconds. Substeps so a long frame
 * (a tab regaining focus, a chunk build hitch) cannot blow the integrator up.
 */
export function stepSpring(
  spring: Spring,
  target: number,
  dt: number,
  config: SpringConfig = TOY_SPRING,
): Spring {
  let remaining = Math.min(dt, 0.25);

  while (remaining > 0) {
    const step = Math.min(remaining, MAX_STEP);
    const a = -config.k * (spring.x - target) - config.c * spring.v;
    spring.v += a * step;
    spring.x += spring.v * step;
    remaining -= step;
  }

  return spring;
}

/** Kick a spring without moving it; the "shiver" feedback on a treated palm. */
export function impulse(spring: Spring, velocity: number): Spring {
  spring.v += velocity;
  return spring;
}

/** True once the spring has effectively stopped, so it can leave the pool. */
export function isSettled(spring: Spring, target: number, epsilon = 1e-3): boolean {
  return Math.abs(spring.x - target) < epsilon && Math.abs(spring.v) < epsilon;
}
