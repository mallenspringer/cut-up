import { CanvasState, LayerState } from '../engine/types';
import { convertToPixels, generateRegistrationMarksSVG } from '../engine/layout/canvasLayout';

/** Generates canonical SVG XML string for a single Potrace physical paper layer */
export function generateLayerSVG(
  layerPathData: string,
  layer: LayerState,
  layerIndex: number,
  canvas: CanvasState,
  registrationMarks: boolean = false,
  processingResolution?: { width: number; height: number }
): string {
  const widthPx = convertToPixels(canvas.width, canvas.unit);
  const heightPx = convertToPixels(canvas.height, canvas.unit);

  const viewW = processingResolution ? processingResolution.width : widthPx;
  const viewH = processingResolution ? processingResolution.height : heightPx;

  const regMarks = registrationMarks
    ? `\n  <path d="${generateRegistrationMarksSVG(canvas, viewW, viewH)}" stroke="#000" stroke-width="1" fill="none" />`
    : '';

  // Solid backing base paper sheet only if layerIndex === 0 && isSolidBacking === true
  const isSolid = layerIndex === 0 && layer.isSolidBacking === true;
  const sheetPathData = isSolid
    ? `M 0 0 H ${viewW} V ${viewH} H 0 Z`
    : `M 0 0 H ${viewW} V ${viewH} H 0 Z ${layerPathData}`;

  const pathSvg = `<path d="${sheetPathData}" fill="${layer.color}" fill-rule="evenodd" stroke="none" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}${canvas.unit}" height="${canvas.height}${canvas.unit}" viewBox="0 0 ${viewW} ${viewH}">
  <!-- Layer ${layer.id} (Threshold: ${layer.threshold}) -->
  <g id="${layer.id}" data-threshold="${layer.threshold}">
    ${pathSvg}
  </g>${regMarks}
</svg>`;
}

/** Generates combined multi-layer SVG string containing all layer groups in physical stack order */
export function generateCombinedSVG(
  layerPathDataMap: Map<string, string>,
  layers: LayerState[],
  canvas: CanvasState,
  registrationMarks: boolean = false,
  processingResolution?: { width: number; height: number }
): string {
  const widthPx = convertToPixels(canvas.width, canvas.unit);
  const heightPx = convertToPixels(canvas.height, canvas.unit);

  const viewW = processingResolution ? processingResolution.width : widthPx;
  const viewH = processingResolution ? processingResolution.height : heightPx;

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  const layerGroupsSvg = sortedLayers.map((layer, idx) => {
    const pathData = layerPathDataMap.get(layer.id) || '';
    const isSolid = idx === 0 && layer.isSolidBacking === true;
    const sheetPathData = isSolid
      ? `M 0 0 H ${viewW} V ${viewH} H 0 Z`
      : `M 0 0 H ${viewW} V ${viewH} H 0 Z ${pathData}`;

    const pathSvg = `    <path d="${sheetPathData}" fill="${layer.color}" fill-rule="evenodd" stroke="none" />`;
    return `  <g id="${layer.id}" data-threshold="${layer.threshold}">\n${pathSvg}\n  </g>`;
  }).join('\n');

  const regMarks = registrationMarks
    ? `\n  <path d="${generateRegistrationMarksSVG(canvas, viewW, viewH)}" stroke="#000" stroke-width="1" fill="none" />`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}${canvas.unit}" height="${canvas.height}${canvas.unit}" viewBox="0 0 ${viewW} ${viewH}">
${layerGroupsSvg}${regMarks}
</svg>`;
}
