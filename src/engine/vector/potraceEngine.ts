import { Potrace } from '@kcaitech/potrace-ts';
import { BinaryMask } from '../types';

export interface PotraceOptions {
  turdSize?: number;      // Area of small islands/holes to suppress (in pixels)
  alphaMax?: number;      // Corner threshold: 0.0 (sharp) to 1.33 (smooth curves)
  optCurve?: boolean;     // Optimize cubic Bezier curves (default: true)
  optTolerance?: number;  // Curve optimization tolerance (default: 0.2)
  blackOnWhite?: boolean; // Default true
}

export interface VectorLayerResult {
  pathData: string;  // Pre-formatted SVG compound d="M... C... Z" path string
  svgString: string; // Complete SVG element string
}

/** Calculates turdSize (minimum island area in square pixels) from feature diameter mm and pxPerMm scale */
export function calculateTurdSize(minimumFeatureSizeMm: number, pxPerMm: number): number {
  const diameterPx = minimumFeatureSizeMm * pxPerMm;
  return Math.round(diameterPx * diameterPx);
}

/** Calculates Potrace corner alphaMax threshold (0.0 to 1.33) from smoothing percentage (0 to 100) */
export function calculateAlphaMax(smoothingPercent: number): number {
  return (Math.min(100, Math.max(0, smoothingPercent)) / 100) * 1.33;
}

/** Calculates Potrace curve optimization tolerance (0.2 to 1.2) from smoothing percentage (0 to 100) */
export function calculateOptTolerance(smoothingPercent: number): number {
  const factor = Math.min(100, Math.max(0, smoothingPercent)) / 100;
  return 0.2 + factor * 1.0;
}

/**
 * Traces a binary material mask into a clean, smooth, optimized SVG compound path using Potrace.
 * Traces negative space holes (0) so SVG even-odd fill-rule subtracts inner cutout contours
 * without generating coincident outer border rectangles or hairline artifacts.
 */
export function traceBinaryMaskToSVG(
  mask: BinaryMask,
  options: PotraceOptions = {}
): VectorLayerResult {
  if (typeof document === 'undefined' || typeof ImageData === 'undefined') {
    return { pathData: '', svgString: '<svg></svg>' };
  }

  const { width, height, data } = mask;
  const pixelArray = new Uint8ClampedArray(width * height * 4);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    // Trace cutout holes (0) as Potrace black (0) foreground material
    const val = data[i] === 0 ? 0 : 255;
    pixelArray[i * 4] = val;
    pixelArray[i * 4 + 1] = val;
    pixelArray[i * 4 + 2] = val;
    pixelArray[i * 4 + 3] = 255;
  }

  const imgData = new ImageData(pixelArray, width, height);

  let rawPathData = '';
  let svgString = '';

  const potraceParams = {
    turdSize: options.turdSize !== undefined ? options.turdSize : 2,
    alphaMax: options.alphaMax !== undefined ? options.alphaMax : 1.0,
    optCurve: options.optCurve !== undefined ? options.optCurve : true,
    optTolerance: options.optTolerance !== undefined ? options.optTolerance : 0.2,
  };

  new Potrace(
    imgData,
    function (this: any) {
      if (this && typeof this.getPathTag === 'function') {
        const pathTag = this.getPathTag();
        svgString = typeof this.getSVG === 'function' ? this.getSVG() : '';
        const match = pathTag.match(/d="([^"]+)"/);
        if (match && match[1]) {
          rawPathData = match[1];
        }
      }
    },
    potraceParams
  );

  return {
    pathData: rawPathData,
    svgString,
  };
}
