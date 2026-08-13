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
  registrationMarks: boolean = false
): void {
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const zipFiles: Record<string, Uint8Array> = {};

  sortedLayers.forEach((layer, idx) => {
    const pathData = layerPathDataMap.get(layer.id) || '';
    const svgStr = generateLayerSVG(pathData, layer, idx, canvas, registrationMarks);

    const padIdx = String(idx + 1).padStart(2, '0');
    const padThresh = String(layer.threshold).padStart(3, '0');
    const filename = `layer-${padIdx}-threshold-${padThresh}.svg`;

    zipFiles[filename] = strToU8(svgStr);
  });

  const zippedData = zipSync(zipFiles);
  const blob = new Blob([zippedData], { type: 'application/zip' });
  downloadBlob(blob, `cutup-layers-${Date.now()}.zip`);
}

/** Exports single combined SVG file */
export function exportCombinedSVGFile(svgContent: string, filename: string = 'cutup-pattern-combined.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}
