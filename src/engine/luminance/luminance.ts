import { BinaryMask } from '../types';
import { ResampledBuffer } from '../working/transform';

/**
 * Computes luminance byte array (0-255) from RGBA resampled buffer.
 * Formula: 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function computeLuminance(buffer: ResampledBuffer): Uint8Array {
  const { width, height, data } = buffer;
  const lum = new Uint8Array(width * height);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];

    if (a < 128) {
      // Treat transparent background as white / 255
      lum[i] = 255;
    } else {
      lum[i] = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
  }

  return lum;
}

/** Extracts alpha channel byte array (0-255) from RGBA resampled buffer */
export function extractAlpha(buffer: ResampledBuffer): Uint8Array {
  const { width, height, data } = buffer;
  const alpha = new Uint8Array(width * height);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  return alpha;
}

/**
 * Converts luminance buffer to binary material mask based on numeric threshold (0-255).
 * Darker pixels (lum <= threshold) = MATERIAL (1).
 * Empty un-imaged page space (alpha < 128) = MATERIAL (1) (solid paper cardstock).
 */
export function thresholdToBinaryMask(
  luminance: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  alpha?: Uint8Array | null
): BinaryMask {
  const mask = new Uint8Array(width * height);
  const total = width * height;

  for (let i = 0; i < total; i++) {
    if (alpha && alpha[i] < 128) {
      mask[i] = 1;
    } else {
      mask[i] = luminance[i] <= threshold ? 1 : 0;
    }
  }

  return { width, height, data: mask };
}
