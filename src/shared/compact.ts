/**
 * A number short enough for a narrow column: 4,000 reads as 4K, and the same
 * again at every thousand up to a trillion. Under a thousand it already fits.
 */
export function compact(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);

  for (const [size, suffix] of STEPS) {
    if (abs >= size) return `${trim(rounded / size)}${suffix}`;
  }

  return String(rounded);
}

/** Largest first, so the first that fits is the one that reads shortest. */
const STEPS: readonly (readonly [number, string])[] = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** One decimal, and not a trailing zero: 4 stays 4, 4.25 becomes 4.3. */
function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
