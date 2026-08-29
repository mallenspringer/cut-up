import { describe, it, expect } from 'vitest';
import { generateJitteredSeeds, applyVoronoiFilter } from './voronoi';
import { applyAestheticFilter, DEFAULT_VORONOI_CONFIG } from './filterEngine';
import { VoronoiFilterConfig, FilterContext } from './types';

describe('Low-Poly / Voronoi Facets Aesthetic Filter', () => {
  it('generates reproducible seeds for the same seed integer', () => {
    const bounds = { left: 0, top: 0, width: 200, height: 200 };
    const seeds1 = generateJitteredSeeds(bounds, 50, 60, 42);
    const seeds2 = generateJitteredSeeds(bounds, 50, 60, 42);
    const seeds3 = generateJitteredSeeds(bounds, 50, 60, 99);

    expect(seeds1.length).toBe(seeds2.length);
    expect(seeds1[0].x).toBe(seeds2[0].x);
    expect(seeds1[0].y).toBe(seeds2[0].y);

    // Different seed produces different positions
    expect(seeds1[0].x).not.toBe(seeds3[0].x);
  });

  it('quantizes luminance buffer across Voronoi facet cells', () => {
    const width = 100;
    const height = 100;
    const pxPerMm = 1;

    // Create a horizontal gradient
    const luminance = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        luminance[y * width + x] = Math.round((x / width) * 255);
      }
    }

    const config: VoronoiFilterConfig = {
      facetCount: 20,
      jitter: 50,
      sampleMethod: 'mean',
      seed: 1,
      cornerStyle: 'orthogonal',
    };

    const context: FilterContext = {
      width,
      height,
      pxPerMm,
      alpha: null,
      imageBounds: { left: 0, top: 0, width, height },
    };

    const result = applyVoronoiFilter(luminance, config, context);
    expect(result.length).toBe(width * height);

    // The output values should be piecewise constant (fewer unique tonal values than raw 0..255)
    const uniqueValues = new Set(result);
    expect(uniqueValues.size).toBeLessThan(50);
  });

  it('supports median luminance sampling for sharp boundary preservation', () => {
    const width = 50;
    const height = 50;
    const pxPerMm = 1;

    const luminance = new Uint8Array(width * height);
    luminance.fill(120);

    const config: VoronoiFilterConfig = {
      facetCount: 25,
      jitter: 0,
      sampleMethod: 'median',
      seed: 1,
      cornerStyle: 'orthogonal',
    };

    const context: FilterContext = {
      width,
      height,
      pxPerMm,
      alpha: null,
      imageBounds: { left: 0, top: 0, width, height },
    };

    const result = applyVoronoiFilter(luminance, config, context);
    expect(result[0]).toBe(120);
  });

  it('dispatches seamlessly through filterEngine applyAestheticFilter', () => {
    const luminance = new Uint8Array(100);
    luminance.fill(200);

    const context: FilterContext = {
      width: 10,
      height: 10,
      pxPerMm: 1,
    };

    const filtered = applyAestheticFilter(
      luminance,
      {
        enabled: true,
        type: 'voronoi',
        pixelate: { blockSizeMm: 4, sampleMethod: 'mean', gridSnap: true, cornerStyle: 'orthogonal' },
        voronoi: DEFAULT_VORONOI_CONFIG,
      },
      context
    );

    expect(filtered.length).toBe(100);
    expect(filtered[0]).toBe(200);
  });
});
