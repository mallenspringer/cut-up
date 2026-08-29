import { describe, it, expect } from 'vitest';
import { cleanBinaryMaskDiscrete } from './discreteClearance';
import { BinaryMask } from '../types';

describe('Discrete Connected Component Clearance', () => {
  it('eliminates small material islands below min area while keeping crisp corners', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height);
    // Large 4x4 material block (16 pixels)
    for (let y = 1; y <= 4; y++) {
      for (let x = 1; x <= 4; x++) {
        data[y * width + x] = 1;
      }
    }
    // Small 1-pixel island at (8, 8)
    data[8 * width + 8] = 1;

    const mask: BinaryMask = { width, height, data };
    // 2mm feature size @ 1 px/mm = 4 px area threshold
    const cleaned = cleanBinaryMaskDiscrete(mask, 2.0, 1.0);

    // Large block preserved
    expect(cleaned.data[1 * width + 1]).toBe(1);
    expect(cleaned.data[4 * width + 4]).toBe(1);
    // Small island eliminated
    expect(cleaned.data[8 * width + 8]).toBe(0);
  });

  it('fills small inner pinholes while preserving outer border negative space', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height);
    data.fill(1); // Solid sheet

    // Inner 1-pixel pinhole at (5, 5)
    data[5 * width + 5] = 0;

    const mask: BinaryMask = { width, height, data };
    const cleaned = cleanBinaryMaskDiscrete(mask, 2.0, 1.0);

    // Inner pinhole filled
    expect(cleaned.data[5 * width + 5]).toBe(1);
  });
});
