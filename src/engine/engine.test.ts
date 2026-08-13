import { describe, it, expect } from 'vitest';
import { BinaryMask } from './types';
import { computeLuminance, thresholdToBinaryMask } from './luminance/luminance';
import { traceBinaryMaskToSVG, calculateTurdSize, calculateAlphaMax, calculateOptTolerance } from './vector/potraceEngine';
import { generateAutoThresholds, createDefaultLayers, generateLayerMask } from './layers/layerGenerator';
import { resampleWorkingImage } from './working/transform';
import { generateCombinedSVG } from '../export/svgGenerator';
import { zipSync, strToU8 } from 'fflate';

import { filterBinaryMaskCanvas } from './manufacturing/canvasFilter';

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

    // optTolerance 0 -> 0.2, 100 -> 1.2
    expect(calculateOptTolerance(0)).toBe(0.2);
    expect(calculateOptTolerance(50)).toBe(0.7);
    expect(calculateOptTolerance(100)).toBe(1.2);
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

  it('6. Canvas Filter Smoothing Scaling', () => {
    const mask: BinaryMask = { width: 4, height: 4, data: new Uint8Array([1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1]) };
    const resultUnsmoothed = filterBinaryMaskCanvas(mask, 2.0, 4, 0);
    expect(resultUnsmoothed.data).toEqual(mask.data); // Unsmoothed mask returns exact original mask reference
  });

  it('7. Cumulative vs Exclusive Layer Mask Generation', () => {
    // 3 pixels with luminance 30, 80, 150
    const lum = new Uint8Array([30, 80, 150]);
    const layers = [
      { id: 'l1', threshold: 50, color: '#111', order: 0 },
      { id: 'l2', threshold: 100, color: '#222', order: 1 },
      { id: 'l3', threshold: 200, color: '#333', order: 2 },
    ];

    // Cumulative mode: holes (0) expand monotonically as threshold increases
    // Pixel 0 (lum 30): <= 50 (cut in l1, l2, l3)
    // Pixel 1 (lum 80): > 50, <= 100 (cut in l2, l3)
    // Pixel 2 (lum 150): > 100, <= 200 (cut in l3)
    const cumL1 = generateLayerMask(lum, 3, 1, 0, layers, 'cumulative', false);
    const cumL2 = generateLayerMask(lum, 3, 1, 1, layers, 'cumulative', false);
    const cumL3 = generateLayerMask(lum, 3, 1, 2, layers, 'cumulative', false);

    expect(cumL1.data[0]).toBe(0); // Cutout
    expect(cumL1.data[1]).toBe(1); // Solid paper
    expect(cumL1.data[2]).toBe(1); // Solid paper

    expect(cumL2.data[0]).toBe(0); // Cutout (retained)
    expect(cumL2.data[1]).toBe(0); // Cutout (new)
    expect(cumL2.data[2]).toBe(1); // Solid paper

    expect(cumL3.data[0]).toBe(0); // Cutout
    expect(cumL3.data[1]).toBe(0); // Cutout
    expect(cumL3.data[2]).toBe(0); // Cutout

    // Exclusive mode: each layer cuts ONLY its discrete band
    const excL1 = generateLayerMask(lum, 3, 1, 0, layers, 'exclusive', false);
    const excL2 = generateLayerMask(lum, 3, 1, 1, layers, 'exclusive', false);
    const excL3 = generateLayerMask(lum, 3, 1, 2, layers, 'exclusive', false);

    expect(excL1.data[0]).toBe(0); // Band 0-50: cut
    expect(excL1.data[1]).toBe(1);
    expect(excL1.data[2]).toBe(1);

    expect(excL2.data[0]).toBe(1); // Band 51-100: not cut
    expect(excL2.data[1]).toBe(0); // Band 51-100: cut
    expect(excL2.data[2]).toBe(1);

    expect(excL3.data[0]).toBe(1);
    expect(excL3.data[1]).toBe(1);
    expect(excL3.data[2]).toBe(0); // Band 101-200: cut
  });

  it('8. Post-Crop Aspect Ratio Preservation during Resampling', () => {
    // Source: 100x100 white square with a 20x20 black box in center
    const srcW = 100;
    const srcH = 100;
    const srcRGBA = new Uint8ClampedArray(srcW * srcH * 4);
    srcRGBA.fill(255); // White background

    const source = {
      id: 'src-1',
      name: 'test',
      width: srcW,
      height: srcH,
      aspectRatio: 1,
      dataUrl: '',
      imageData: {
        width: srcW,
        height: srcH,
        data: srcRGBA,
        colorSpace: 'srgb' as const,
      },
    };

    // Crop a 2:1 rectangle: 60 wide x 30 high
    const workingState = {
      crop: { type: 'rectangle' as const, geometry: { x: 20, y: 35, width: 60, height: 30 } },
      position: { x: 0, y: 0 },
      scaleX: 1.0,
      scaleY: 1.0,
      rasterScaleMethod: 'nearest' as const,
    };

    // Target is a square canvas 100x100
    const resampled = resampleWorkingImage(source, workingState, 100, 100);

    // With 2:1 crop on 100x100 canvas:
    // Base dimensions are 100w x 50h.
    // Center is (50, 50), top is 25, bottom is 75.
    // Pixel at (50, 10) is above the cropped box -> must be transparent/outside (alpha=0)
    const idxOutsideTop = (10 * 100 + 50) * 4;
    expect(resampled.data[idxOutsideTop + 3]).toBe(0);

    // Pixel at (50, 50) is inside the cropped box -> must be inside (alpha=255)
    const idxInside = (50 * 100 + 50) * 4;
    expect(resampled.data[idxInside + 3]).toBe(255);

    // Pixel at (50, 90) is below the cropped box -> must be transparent/outside (alpha=0)
    const idxOutsideBottom = (90 * 100 + 50) * 4;
    expect(resampled.data[idxOutsideBottom + 3]).toBe(0);
  });

  it('9. Margin Positive Space & Seamless Border Fusion', () => {
    // 4x4 canvas: Center 2x2 is image (alpha=255), outer perimeter is margin (alpha=0)
    const width = 4;
    const height = 4;
    const lum = new Uint8Array(width * height);
    const alpha = new Uint8Array(width * height);

    // Inner 2x2: (1,1) is dark (lum=10, cutout), (2,1) is light (lum=200, solid)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const idx = y * 4 + x;
        if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
          alpha[idx] = 255;
          lum[idx] = (x === 1 && y === 1) ? 10 : 200;
        } else {
          alpha[idx] = 0; // Margin / extra-image space
          lum[idx] = 255;
        }
      }
    }

    const layers = [{ id: 'layer-1', threshold: 100, color: '#123456', order: 0 }];
    const mask = generateLayerMask(lum, width, height, 0, layers, 'cumulative', false, alpha);

    // All margin pixels (where alpha=0) MUST be solid paper (1)
    expect(mask.data[0]).toBe(1); // (0,0) margin -> solid
    expect(mask.data[1]).toBe(1); // (1,0) margin -> solid
    expect(mask.data[3]).toBe(1); // (3,0) margin -> solid

    // Inside image: (1,1) with lum=10 <= 100 is CUTOUT (0)
    expect(mask.data[1 * 4 + 1]).toBe(0);

    // Inside image: (2,1) with lum=200 > 100 is SOLID (1)
    expect(mask.data[1 * 4 + 2]).toBe(1);

    // Notice that (2,1) is solid (1) and adjacent to margin (3,1) which is solid (1) -> continuous piece of paper!
    expect(mask.data[1 * 4 + 3]).toBe(1);
  });

  it('10. Full Sheet Physical Sizing in SVG Export', () => {
    const layers = createDefaultLayers(2);
    const samplePath = 'M 10 10 L 50 10 L 50 50 L 10 50 Z';

    const layerMap = new Map<string, string>();
    layerMap.set(layers[0].id, samplePath);
    layerMap.set(layers[1].id, samplePath);

    const canvas = { width: 8.5, height: 11, unit: 'in' as const, margin: 0.5, orientation: 'portrait' as const };
    const svgStr = generateCombinedSVG(layerMap, layers, canvas, true, { width: 800, height: 1035 });

    // Must have explicit physical unit headers for Cricut 1:1 scale
    expect(svgStr).toContain('width="8.5in"');
    expect(svgStr).toContain('height="11in"');
    expect(svgStr).toContain('viewBox="0 0 800 1035"');

    // Filled sheet path must subtract inner cutout holes under evenodd rule
    expect(svgStr).toContain('M 0 0 H 800 V 1035 H 0 Z');
    expect(svgStr).toContain('fill-rule="evenodd"');
  });
});
