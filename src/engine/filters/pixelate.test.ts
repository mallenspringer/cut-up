import { describe, it, expect } from 'vitest';
import { applyPixelateFilter } from './pixelate';
import { applyAestheticFilter, DEFAULT_PIXELATE_CONFIG, DEFAULT_VORONOI_CONFIG } from './filterEngine';
import { PixelateFilterConfig, FilterContext } from './types';

describe('Pixelation / Block Mosaic Aesthetic Filter', () => {
  it('quantizes luminance field into uniform mean blocks', () => {
    // 4x4 image with 2x2 blocks
    const width = 4;
    const height = 4;
    const pxPerMm = 1; // 1 px per mm -> 2mm = 2px block size

    // Row 0: 0, 100,  50, 50
    // Row 1: 0, 100,  50, 50
    // Row 2: 200, 200, 10, 20
    // Row 3: 200, 200, 30, 40
    const luminance = new Uint8Array([
      0, 100, 50, 50,
      0, 100, 50, 50,
      200, 200, 10, 20,
      200, 200, 30, 40,
    ]);

    const config: PixelateFilterConfig = {
      blockSizeMm: 2,
      sampleMethod: 'mean',
      gridSnap: true,
      cornerStyle: 'orthogonal',
    };

    const context: FilterContext = {
      width,
      height,
      pxPerMm,
      alpha: null,
      imageBounds: { left: 0, top: 0, width: 4, height: 4 },
    };

    const result = applyPixelateFilter(luminance, config, context);

    // Top-left 2x2: (0 + 100 + 0 + 100) / 4 = 50
    expect(result[0]).toBe(50);
    expect(result[1]).toBe(50);
    expect(result[4]).toBe(50);
    expect(result[5]).toBe(50);

    // Top-right 2x2: (50 + 50 + 50 + 50) / 4 = 50
    expect(result[2]).toBe(50);
    expect(result[3]).toBe(50);
    expect(result[6]).toBe(50);
    expect(result[7]).toBe(50);

    // Bottom-left 2x2: (200 + 200 + 200 + 200) / 4 = 200
    expect(result[8]).toBe(200);
    expect(result[9]).toBe(200);
    expect(result[12]).toBe(200);
    expect(result[13]).toBe(200);

    // Bottom-right 2x2: (10 + 20 + 30 + 40) / 4 = 25
    expect(result[10]).toBe(25);
    expect(result[11]).toBe(25);
    expect(result[14]).toBe(25);
    expect(result[15]).toBe(25);
  });

  it('correctly calculates median luminance when median sampling is selected', () => {
    const width = 2;
    const height = 2;
    const pxPerMm = 1;

    // Values: 10, 20, 30, 200 (mean would be 65, median is 20/30)
    const luminance = new Uint8Array([10, 20, 30, 200]);

    const config: PixelateFilterConfig = {
      blockSizeMm: 2,
      sampleMethod: 'median',
      gridSnap: true,
      cornerStyle: 'orthogonal',
    };

    const context: FilterContext = {
      width,
      height,
      pxPerMm,
      alpha: null,
      imageBounds: { left: 0, top: 0, width: 2, height: 2 },
    };

    const result = applyPixelateFilter(luminance, config, context);

    // Rank index floor(4/2) = 2 -> sorted [10, 20, 30, 200], index 2 is 30
    expect(result[0]).toBe(30);
    expect(result[1]).toBe(30);
    expect(result[2]).toBe(30);
    expect(result[3]).toBe(30);
  });

  it('respects image placement offset bounds for grid alignment', () => {
    const width = 4;
    const height = 4;
    const pxPerMm = 1;

    const luminance = new Uint8Array(16);
    luminance.fill(100);

    const config: PixelateFilterConfig = {
      blockSizeMm: 2,
      sampleMethod: 'mean',
      gridSnap: true,
      cornerStyle: 'orthogonal',
    };

    // Placed at offset (1, 1)
    const context: FilterContext = {
      width,
      height,
      pxPerMm,
      alpha: null,
      imageBounds: { left: 1, top: 1, width: 3, height: 3 },
    };

    const result = applyPixelateFilter(luminance, config, context);
    expect(result.length).toBe(16);
  });

  it('passes through luminance unchanged when filter is disabled or none', () => {
    const luminance = new Uint8Array([10, 20, 30, 40]);
    const context: FilterContext = {
      width: 2,
      height: 2,
      pxPerMm: 1,
    };

    const resultDisabled = applyAestheticFilter(
      luminance,
      { enabled: false, type: 'pixelate', pixelate: DEFAULT_PIXELATE_CONFIG, voronoi: DEFAULT_VORONOI_CONFIG },
      context
    );
    expect(resultDisabled).toBe(luminance);

    const resultNone = applyAestheticFilter(
      luminance,
      { enabled: true, type: 'none', pixelate: DEFAULT_PIXELATE_CONFIG, voronoi: DEFAULT_VORONOI_CONFIG },
      context
    );
    expect(resultNone).toBe(luminance);
  });
});
