import { describe, it, expect } from 'vitest';
import { BinaryMask, LayerManualEdits } from '../types';
import { applyManualEditsToMask } from './manualEdits';

describe('Manual Layer Edits (Wand & Bridge)', () => {
  it('1. Flood Fill: Fills an internal hole with solid paper', () => {
    // 5x5 mask with a 1-pixel hole (0) at center (2,2) surrounded by solid paper (1)
    const width = 5;
    const height = 5;
    const data = new Uint8Array(width * height);
    data.fill(1);
    data[2 * width + 2] = 0; // Cutout hole at center

    const manualEdits: LayerManualEdits = {
      bridges: [],
      fills: [
        {
          id: 'fill-1',
          x: 2.5 / width, // normalized center coordinate
          y: 2.5 / height,
          fillType: 1, // fill with solid paper
        },
      ],
    };

    const result = applyManualEditsToMask({ width, height, data }, manualEdits, width, height, 4);
    expect(result.data[2 * width + 2]).toBe(1); // Center hole is now solid paper
  });

  it('2. Flood Fill: Deletes an isolated floating island (scraps)', () => {
    // 5x5 mask that is mostly empty (0) with a 3x3 floating island of material (1) in middle
    const width = 5;
    const height = 5;
    const data = new Uint8Array(width * height); // all 0
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        data[y * width + x] = 1;
      }
    }

    const manualEdits: LayerManualEdits = {
      bridges: [],
      fills: [
        {
          id: 'fill-island',
          x: 2 / width,
          y: 2 / height,
          fillType: 0, // erase island to hole
        },
      ],
    };

    const result = applyManualEditsToMask({ width, height, data }, manualEdits, width, height, 4);
    // Entire connected 3x3 island should now be 0
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(result.data[y * width + x]).toBe(0);
      }
    }
  });

  it('3. Bridge Pen: Stamps a solid connecting paper capsule across a gap', () => {
    // 10x10 mask with two separate paper columns (x=1..2 and x=7..8), gap at x=3..6
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height);
    for (let y = 0; y < 10; y++) {
      data[y * width + 1] = 1;
      data[y * width + 2] = 1;
      data[y * width + 7] = 1;
      data[y * width + 8] = 1;
    }

    // Bridge from (2, 5) to (7, 5)
    const manualEdits: LayerManualEdits = {
      bridges: [
        {
          id: 'bridge-1',
          x1: 2 / width,
          y1: 5 / height,
          x2: 7 / width,
          y2: 5 / height,
          widthMm: 1.0, // 1mm at 2px/mm = 2px diameter -> radius 1px
        },
      ],
      fills: [],
    };

    const result = applyManualEditsToMask({ width, height, data }, manualEdits, width, height, 2);
    // Center pixel of gap (5, 5) must now be material (1)
    expect(result.data[5 * width + 5]).toBe(1);
    expect(result.data[5 * width + 4]).toBe(1);
    expect(result.data[5 * width + 6]).toBe(1);
  });
});
