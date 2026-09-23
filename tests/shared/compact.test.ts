import { describe, expect, it } from 'vitest';

import { compact } from '@shared/compact.ts';

describe('compact numbers (GDD 10.3)', () => {
  it('leaves anything that already fits alone', () => {
    expect(compact(0)).toBe('0');
    expect(compact(7)).toBe('7');
    expect(compact(999)).toBe('999');
    expect(compact(999.4)).toBe('999');
  });

  it('steps at every thousand, up to a trillion', () => {
    expect(compact(1_000)).toBe('1K');
    expect(compact(4_000)).toBe('4K');
    expect(compact(5_337)).toBe('5.3K');
    expect(compact(100_499)).toBe('100.5K');
    expect(compact(4_000_000)).toBe('4M');
    expect(compact(536_364_555)).toBe('536.4M');
    expect(compact(1_000_000_000)).toBe('1B');
    expect(compact(133_495_128_564)).toBe('133.5B');
    expect(compact(4_000_000_000_000)).toBe('4T');
    expect(compact(1_234_000_000_000_000)).toBe('1234T');
  });

  it('keeps the sign, because a loss reads as one', () => {
    expect(compact(-4_000)).toBe('-4K');
    expect(compact(-536_364_555)).toBe('-536.4M');
  });
});
