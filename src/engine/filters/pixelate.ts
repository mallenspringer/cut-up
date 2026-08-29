import { PixelateFilterConfig, FilterContext } from './types';

/**
 * Applies the Pixelation / Block Mosaic Discretization Filter to a grayscale luminance buffer.
 *
 * 1. Subdivides the image space into orthogonal B x B blocks based on physical mm dimensions.
 * 2. Anchors the grid origin to the placed/cropped image bounds so the mosaic tracks image movement.
 * 3. Quantizes luminance across each block using either Mean or Median sampling.
 * 4. Outputs discretized luminance values ready for thresholding and orthogonal vector tracing.
 */
export function applyPixelateFilter(
  luminance: Uint8Array,
  config: PixelateFilterConfig,
  context: FilterContext
): Uint8Array {
  const { width, height, pxPerMm, alpha, imageBounds } = context;
  const totalPixels = width * height;

  if (totalPixels === 0 || pxPerMm <= 0) {
    return new Uint8Array(luminance);
  }

  // Calculate block dimension in buffer pixels
  const rawBlockSizePx = Math.max(1, Math.round(config.blockSizeMm * pxPerMm));
  const blockSizePx = rawBlockSizePx;

  // Grid origin anchored to image placement bounds or (0, 0)
  let originX = imageBounds ? imageBounds.left : 0;
  let originY = imageBounds ? imageBounds.top : 0;

  if (config.gridSnap) {
    originX = Math.round(originX);
    originY = Math.round(originY);
  }

  const output = new Uint8Array(totalPixels);
  const sampleMethod = config.sampleMethod || 'mean';

  // Compute block range overlapping canvas [0..width) x [0..height)
  const minBx = Math.floor((0 - originX) / blockSizePx);
  const maxBx = Math.floor((width - 1 - originX) / blockSizePx);
  const minBy = Math.floor((0 - originY) / blockSizePx);
  const maxBy = Math.floor((height - 1 - originY) / blockSizePx);

  // Reusable histogram for median calculation (256 bins)
  const hist = sampleMethod === 'median' ? new Uint32Array(256) : null;

  for (let by = minBy; by <= maxBy; by++) {
    const startY = Math.max(0, Math.floor(originY + by * blockSizePx));
    const endY = Math.min(height, Math.floor(originY + (by + 1) * blockSizePx));
    if (startY >= endY) continue;

    for (let bx = minBx; bx <= maxBx; bx++) {
      const startX = Math.max(0, Math.floor(originX + bx * blockSizePx));
      const endX = Math.min(width, Math.floor(originX + (bx + 1) * blockSizePx));
      if (startX >= endX) continue;

      let validPixelCount = 0;
      let sumLuminance = 0;

      if (sampleMethod === 'median' && hist) {
        hist.fill(0);
      }

      // 1. Accumulate values in this block
      for (let y = startY; y < endY; y++) {
        const rowOffset = y * width;
        for (let x = startX; x < endX; x++) {
          const idx = rowOffset + x;

          // Check if pixel is within image (alpha >= 128)
          if (!alpha || alpha[idx] >= 128) {
            const val = luminance[idx];
            if (sampleMethod === 'median' && hist) {
              hist[val]++;
            } else {
              sumLuminance += val;
            }
            validPixelCount++;
          }
        }
      }

      // 2. Compute block luminance
      let blockVal = 255; // Default for un-imaged / transparent blocks

      if (validPixelCount > 0) {
        if (sampleMethod === 'median' && hist) {
          const targetRank = Math.floor(validPixelCount / 2);
          let count = 0;
          for (let val = 0; val < 256; val++) {
            count += hist[val];
            if (count > targetRank) {
              blockVal = val;
              break;
            }
          }
        } else {
          blockVal = Math.round(sumLuminance / validPixelCount);
        }
      } else {
        // If entirely outside image alpha, retain 255 (white/solid backing)
        blockVal = 255;
      }

      // 3. Write computed block value to output
      for (let y = startY; y < endY; y++) {
        const rowOffset = y * width;
        for (let x = startX; x < endX; x++) {
          const idx = rowOffset + x;
          if (alpha && alpha[idx] < 128) {
            // Keep background un-imaged pixels as 255
            output[idx] = 255;
          } else {
            output[idx] = blockVal;
          }
        }
      }
    }
  }

  return output;
}
