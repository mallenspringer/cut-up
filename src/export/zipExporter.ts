import { zipSync, strToU8 } from 'fflate';
import { LayerState, CanvasState } from '../engine/types';
import { generateLayerSVG } from './svgGenerator';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Packages individual layer SVGs into a ZIP archive using fflate and triggers browser download.
 */
export function exportLayerPackageZIP(
  layerPathDataMap: Map<string, string>,
  layers: LayerState[],
  canvas: CanvasState,
  registrationMarks: boolean = false,
  processingResolution?: { width: number; height: number },
  zipFilename: string = `cutup-layers-${Date.now()}.zip`,
  layerPrefix?: string
): void {
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const zipFiles: Record<string, Uint8Array> = {};

  const cleanPrefix = layerPrefix ? layerPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const prefixStr = cleanPrefix ? `${cleanPrefix}-` : '';

  sortedLayers.forEach((layer, idx) => {
    const isLayer0 = idx === 0;
    const isVoid = isLayer0 && layer.isSolidBacking === false;

    // Void Layer 0 has no physical material to cut
    if (isVoid) return;

    const pathData = layerPathDataMap.get(layer.id) || '';
    const svgStr = generateLayerSVG(pathData, layer, idx, canvas, registrationMarks, processingResolution);

    const padIdx = String(idx).padStart(2, '0');
    const padThresh = String(layer.threshold).padStart(3, '0');
    const filename = isLayer0
      ? `${prefixStr}layer-00-backing-solid.svg`
      : `${prefixStr}layer-${padIdx}-threshold-${padThresh}.svg`;

    zipFiles[filename] = strToU8(svgStr);
  });

  const zippedData = zipSync(zipFiles);
  const blob = new Blob([zippedData], { type: 'application/zip' });
  const finalZipName = zipFilename.trim().endsWith('.zip') ? zipFilename.trim() : `${zipFilename.trim()}.zip`;
  downloadBlob(blob, finalZipName || `cutup-layers-${Date.now()}.zip`);
}

/** Exports single combined SVG file */
export function exportCombinedSVGFile(svgContent: string, filename: string = 'cutup-pattern-combined.svg') {
  const finalFilename = filename.trim().endsWith('.svg') ? filename.trim() : `${filename.trim()}.svg`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, finalFilename || `cutup-combined-${Date.now()}.svg`);
}
