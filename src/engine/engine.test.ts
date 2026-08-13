import { describe, it, expect } from 'vitest';
import { BinaryMask } from './types';
import { computeLuminance, thresholdToBinaryMask } from './luminance/luminance';
import { traceBinaryMaskToSVG, calculateTurdSize, calculateAlphaMax } from './vector/potraceEngine';
import { generateAutoThresholds, createDefaultLayers } from './layers/layerGenerator';
import { generateCombinedSVG } from '../export/svgGenerator';
import { zipSync, strToU8 } from 'fflate';

describe('Luminance Engine Core Tests', () => {
  it('1. Luminance & Thresholding determinism', () => {
    const buffer = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0, 0, 0, 255,       // Pixel 0: Black (Lum 0)
        255, 255, 255, 255, // Pixel 1: White (Lum 255)
        128, 128, 128, 255, // Pixel 2: Gray (Lum 128)
        200, 200, 200, 255, // Pixel 3: Light Gray (Lum 200)
      ]),
    };

    const lum = computeLuminance(buffer);
    expect(lum[0]).toBe(0);
    expect(lum[1]).toBe(255);
    expect(lum[2]).toBe(128);

    const mask = thresholdToBinaryMask(lum, 2, 2, 100, false);
    expect(mask.data[0]).toBe(1); // Black <= 100 -> Material
    expect(mask.data[1]).toBe(0); // White > 100 -> Non-material
  });

  it('2. Potrace Parameter Calculations', () => {
    // 2mm feature size at 4 px/mm -> diameter 8px -> area 64px
    const turdSize = calculateTurdSize(2.0, 4);
    expect(turdSize).toBe(64);

    // Smoothing 0 -> 0.0, 100 -> 1.33
    expect(calculateAlphaMax(0)).toBe(0);
    expect(calculateAlphaMax(50)).toBeCloseTo(0.665);
    expect(calculateAlphaMax(100)).toBeCloseTo(1.33);
  });

  it('3. Potrace Vector Tracing Engine', () => {
    // 10x10 mask: solid 6x6 square
    const width = 10;
    const height = 10;
    const data = new Uint8Array(width * height);

    for (let y = 2; y <= 7; y++) {
      for (let x = 2; x <= 7; x++) {
        data[y * width + x] = 1;
      }
    }

    const mask: BinaryMask = { width, height, data };
    const result = traceBinaryMaskToSVG(mask, { turdSize: 2, alphaMax: 1.0 });

    expect(result.pathData).toBeDefined();
    expect(result.svgString).toContain('<svg');
  });

  it('4. Auto Threshold Distribution', () => {
    const t5 = generateAutoThresholds(5);
    expect(t5.length).toBe(5);
    for (let i = 1; i < t5.length; i++) {
      expect(t5[i]).toBeGreaterThan(t5[i - 1]);
    }
  });

  it('5. SVG Generation & fflate ZIP Packaging', () => {
    const layers = createDefaultLayers(2);
    const samplePath = 'M 10 10 L 50 10 L 50 50 L 10 50 Z';

    const layerMap = new Map<string, string>();
    layerMap.set(layers[0].id, samplePath);
    layerMap.set(layers[1].id, samplePath);

    const canvas = { width: 4, height: 6, unit: 'in' as const, margin: 0.25, orientation: 'portrait' as const };
    const combinedSVG = generateCombinedSVG(layerMap, layers, canvas);

    expect(combinedSVG).toContain('<svg');
    expect(combinedSVG).toContain('fill-rule="evenodd"');
    expect(combinedSVG).toContain(samplePath);

    // fflate ZIP packaging
    const zipFiles: Record<string, Uint8Array> = {
      'layer-01.svg': strToU8(combinedSVG),
    };
    const zipBuf = zipSync(zipFiles);
    expect(zipBuf.length).toBeGreaterThan(0);
  });
});
