import { SourceImage } from '../types';

export function createSourceImageFromData(
  name: string,
  width: number,
  height: number,
  dataUrl: string,
  imageData?: ImageData
): SourceImage {
  return {
    id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    width,
    height,
    aspectRatio: width / height,
    dataUrl,
    imageData,
  };
}

/** Decodes ImageData from an HTMLImageElement using an OffscreenCanvas/Canvas */
export function extractImageDataFromImage(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not obtain 2D canvas context');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
