import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  decodeBytes,
  decodeFloat32,
  decodeInt32,
  decodeUint8,
  encodeBytes,
  encodeTypedArray,
} from '@shared/base64.ts';

describe('typed-array base64 codec (GDD 7)', () => {
  it('round-trips the palm arrays a block actually stores', () => {
    // PalmArrays for one 12x12 block (GDD 4.4).
    const plantedAt = Int32Array.from({ length: 144 }, (_, i) => (i % 7 === 0 ? -1 : i * 13));
    const health = Uint8Array.from({ length: 144 }, (_, i) => (i * 37) % 256);
    const growth = Float32Array.from({ length: 144 }, (_, i) => i * 6.25);

    expect(Array.from(decodeInt32(encodeTypedArray(plantedAt)))).toEqual(Array.from(plantedAt));
    expect(Array.from(decodeUint8(encodeTypedArray(health)))).toEqual(Array.from(health));
    expect(Array.from(decodeFloat32(encodeTypedArray(growth)))).toEqual(Array.from(growth));
  });

  it('preserves the -1 empty-slot sentinel and extreme int32 values', () => {
    const values = Int32Array.of(-1, 0, 1, -2147483648, 2147483647);
    expect(Array.from(decodeInt32(encodeTypedArray(values)))).toEqual(Array.from(values));
  });

  it('handles an empty array', () => {
    expect(decodeInt32(encodeTypedArray(new Int32Array(0))).length).toBe(0);
  });

  it('encodes a view into a larger buffer without dragging the whole buffer along', () => {
    const backing = new Int32Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(2, 5);
    expect(Array.from(decodeInt32(encodeTypedArray(view)))).toEqual([3, 4, 5]);
  });

  it('survives an array larger than the fromCharCode chunk size', () => {
    const big = Float32Array.from({ length: 40_000 }, (_, i) => Math.sin(i) * 1000);
    const back = decodeFloat32(encodeTypedArray(big));
    expect(back.length).toBe(big.length);
    expect(back[0]).toBe(big[0]);
    expect(back[39_999]).toBe(big[39_999]);
  });

  it('property: arbitrary bytes round-trip', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 2048 }), (bytes) => {
        expect(Array.from(decodeBytes(encodeBytes(bytes)))).toEqual(Array.from(bytes));
      }),
      { numRuns: 200 },
    );
  });
});
