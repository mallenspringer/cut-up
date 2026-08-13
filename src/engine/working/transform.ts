import { SourceImage, WorkingImageState } from '../types';

export interface ResampledBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
}

/**
 * Resamples the source image into a working target buffer according to crop, scale, and position.
 * Uses nearest-neighbor sampling to preserve pixelated character and original luminance values.
 * Uses center-aligned transform origin (50% 50%) to match CSS transform rendering.
 */
export function resampleWorkingImage(
  source: SourceImage,
  workingState: WorkingImageState,
  targetWidth: number,
  targetHeight: number,
  pageWidthPx?: number,
  pageHeightPx?: number
): ResampledBuffer {
  const result = new Uint8ClampedArray(targetWidth * targetHeight * 4);

  if (!source.imageData) {
    return { width: targetWidth, height: targetHeight, data: result };
  }

  const srcData = source.imageData.data;
  const srcW = source.width;
  const srcH = source.height;

  // Crop geometry
  const crop = workingState.crop.geometry;
  const cropX = crop.x || 0;
  const cropY = crop.y || 0;
  const cropW = crop.width || srcW;
  const cropH = crop.height || srcH;

  // Scale offset from display page pixels to target processing buffer pixels
  const pW = pageWidthPx || targetWidth;
  const pH = pageHeightPx || targetHeight;
  const scaleToTargetX = targetWidth / Math.max(1, pW);
  const scaleToTargetY = targetHeight / Math.max(1, pH);

  const targetPosX = (workingState.position.x || 0) * scaleToTargetX;
  const targetPosY = (workingState.position.y || 0) * scaleToTargetY;
  const scaleX = workingState.scaleX || 1.0;
  const scaleY = workingState.scaleY || 1.0;

  // Scaled dimensions in target canvas pixel space
  const scaledWidth = targetWidth * scaleX;
  const scaledHeight = targetHeight * scaleY;

  // Center-aligned transform origin matching CSS (50% 50%)
  const centerX = targetWidth / 2 + targetPosX;
  const centerY = targetHeight / 2 + targetPosY;

  const scaledLeft = centerX - scaledWidth / 2;
  const scaledTop = centerY - scaledHeight / 2;

  // Nearest-neighbor resampling loop
  for (let y = 0; y < targetHeight; y++) {
    const relY = y - scaledTop;
    const normY = relY / scaledHeight;

    for (let x = 0; x < targetWidth; x++) {
      const relX = x - scaledLeft;
      const normX = relX / scaledWidth;

      const targetIdx = (y * targetWidth + x) * 4;

      if (normX >= 0 && normX < 1 && normY >= 0 && normY < 1) {
        const srcXFloat = cropX + normX * cropW;
        const srcYFloat = cropY + normY * cropH;

        const srcX = Math.min(srcW - 1, Math.max(0, Math.floor(srcXFloat)));
        const srcY = Math.min(srcH - 1, Math.max(0, Math.floor(srcYFloat)));
        const srcIdx = (srcY * srcW + srcX) * 4;

        result[targetIdx] = srcData[srcIdx];         // R
        result[targetIdx + 1] = srcData[srcIdx + 1]; // G
        result[targetIdx + 2] = srcData[srcIdx + 2]; // B
        result[targetIdx + 3] = srcData[srcIdx + 3]; // A
      } else {
        // Outside bounds: transparent pixel (outside image boundary)
        result[targetIdx] = 255;
        result[targetIdx + 1] = 255;
        result[targetIdx + 2] = 255;
        result[targetIdx + 3] = 0;
      }
    }
  }

  return {
    width: targetWidth,
    height: targetHeight,
    data: result,
  };
}
