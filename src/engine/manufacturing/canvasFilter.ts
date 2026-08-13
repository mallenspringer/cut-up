import { BinaryMask } from '../types';

/**
 * Fast Offscreen Canvas 2D morphological pre-filter for edge smoothing & gap bridging.
 * Runs on GPU/Canvas context in < 1ms.
 */
export function filterBinaryMaskCanvas(
  mask: BinaryMask,
  minFeaturePhysicalSize: number, // in mm
  pixelPerMm: number,
  smoothing: number = 0 // 0 to 100
): BinaryMask {
  const { width, height, data } = mask;

  if (pixelPerMm <= 0 || smoothing <= 0) return mask;

  // Max smoothing blur radius in physical mm (3.0mm max throw)
  // Non-linear scaling (t^1.15) gives fine sub-millimeter noise removal at 5-25%
  // and ramps up to heavy smoothing & noise wipeout at 75-100%
  const maxBlurMm = 3.0;
  const factor = Math.min(100, Math.max(0, smoothing)) / 100;
  const blurMm = Math.pow(factor, 1.15) * maxBlurMm;
  const blurPx = blurMm * pixelPerMm;
  if (blurPx < 0.4) return mask;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return mask;

  // Render binary mask to canvas
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const val = data[i] === 1 ? 0 : 255;
    imgData.data[i * 4] = val;
    imgData.data[i * 4 + 1] = val;
    imgData.data[i * 4 + 2] = val;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Apply CSS Blur Filter
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = width;
  blurCanvas.height = height;
  const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
  if (!blurCtx) return mask;

  blurCtx.filter = `blur(${blurPx.toFixed(1)}px)`;
  blurCtx.drawImage(canvas, 0, 0);

  // Re-threshold blurred buffer
  const blurredData = blurCtx.getImageData(0, 0, width, height);
  const cleanData = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const lum = blurredData.data[i * 4]; // R channel
    cleanData[i] = lum < 128 ? 1 : 0;
  }

  return { width, height, data: cleanData };
}
