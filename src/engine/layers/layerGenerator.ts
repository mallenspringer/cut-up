import { LayerState, LayerMode, BinaryMask } from '../types';
import { thresholdToBinaryMask } from '../luminance/luminance';

/** Distinct, harmonious paper layer colors cycling through rich desaturated RGB shades */
export const DEFAULT_LAYER_COLORS = [
  // Layers 1-8: Muted/darker rich RGB shades
  '#1e293b', // Midnight Navy
  '#1e3a8a', // Muted Deep Blue
  '#0f766e', // Muted Deep Teal
  '#15803d', // Muted Forest Green
  '#b45309', // Muted Warm Amber
  '#be123c', // Muted Deep Rose
  '#6b21a8', // Muted Deep Violet
  '#475569', // Slate Gray
  // Layers 9-16: Lighter pastel RGB run
  '#818cf8', // Pastel Indigo
  '#38bdf8', // Pastel Sky Blue
  '#34d399', // Pastel Emerald Mint
  '#fbbf24', // Pastel Warm Amber
  '#fb7185', // Pastel Coral Rose
  '#c084fc', // Pastel Purple Lilac
  '#f472b6', // Pastel Pink
  '#cbd5e1', // Light Paper Gray
];

export function generateAutoThresholds(count: number): number[] {
  if (count <= 1) return [255];
  const step = Math.floor(255 / count);
  const thresholds: number[] = [];
  for (let i = 1; i <= count; i++) {
    if (i === count) {
      thresholds.push(255);
    } else {
      thresholds.push(Math.round(step * i));
    }
  }
  return thresholds;
}

/** Generates default layer state array for N layers */
export function createDefaultLayers(count: number = 1): LayerState[] {
  const thresholds = generateAutoThresholds(count);
  return thresholds.map((t, index) => ({
    id: `layer-${index + 1}`,
    threshold: t,
    minThreshold: index === 0 ? 0 : undefined,
    isSolidBacking: false, // Solid OFF by default on app load
    color: DEFAULT_LAYER_COLORS[index % DEFAULT_LAYER_COLORS.length],
    order: index,
  }));
}

/** Validates and enforces strict monotonic threshold ordering (T_0 < T_1 < ... < T_n) */
export function enforceMonotonicThresholds(layers: LayerState[]): LayerState[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  let prevVal = 0;

  return sorted.map((layer, idx) => {
    const isTop = idx === sorted.length - 1;
    const minAllowed = prevVal + 1;
    const maxAllowed = isTop ? 255 : (254 - (sorted.length - 1 - idx));
    const targetVal = isTop && (layer.threshold >= 254) ? 255 : layer.threshold;
    const clampedThreshold = Math.max(minAllowed, Math.min(maxAllowed, targetVal));
    prevVal = clampedThreshold;
    return {
      ...layer,
      threshold: clampedThreshold,
    };
  });
}

/**
 * Generates binary mask for a specific layer.
 * Each layer covers its designated luminance range (prevThreshold -> currentLayer.threshold).
 * Extra-image space (outside photo) is solid paper (1) unioned seamlessly into each sheet.
 */
export function generateLayerMask(
  luminance: Uint8Array,
  width: number,
  height: number,
  layerIndex: number,
  allLayers: LayerState[],
  mode: LayerMode,
  negative: boolean,
  alpha?: Uint8Array | null
): BinaryMask {
  const sortedLayers = [...allLayers].sort((a, b) => a.order - b.order);
  const currentLayer = sortedLayers[layerIndex];
  if (!currentLayer) {
    return { width, height, data: new Uint8Array(width * height) };
  }

  // Solid uncut base paper sheet (Layer 1 only when isSolidBacking === true)
  if (layerIndex === 0 && currentLayer.isSolidBacking === true) {
    const solidData = new Uint8Array(width * height);
    solidData.fill(1); // 100% solid paper cardstock base
    return { width, height, data: solidData };
  }

  const minThresh = currentLayer.minThreshold !== undefined ? currentLayer.minThreshold : 0;
  const prevThreshold = layerIndex === 0 ? minThresh : sortedLayers[layerIndex - 1].threshold;
  const currThreshold = currentLayer.threshold;
  const total = width * height;
  const maskData = new Uint8Array(total);

  if (!negative) {
    for (let i = 0; i < total; i++) {
      if (alpha && alpha[i] < 128) {
        // Outside photo: solid paper (1) unioned into the layer sheet
        maskData[i] = 1;
      } else {
        const val = luminance[i];
        // Paper present for luminance within this layer's designated band
        maskData[i] = (val >= (layerIndex === 0 ? minThresh : prevThreshold + 1) && val <= currThreshold) ? 1 : 0;
      }
    }
  } else {
    for (let i = 0; i < total; i++) {
      if (alpha && alpha[i] < 128) {
        maskData[i] = 1;
      } else {
        const val = luminance[i];
        maskData[i] = (val < (layerIndex === 0 ? minThresh : prevThreshold + 1) || val > currThreshold) ? 1 : 0;
      }
    }
  }

  return { width, height, data: maskData };
}
