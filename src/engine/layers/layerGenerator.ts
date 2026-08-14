import { LayerState, LayerMode, BinaryMask } from '../types';
import { thresholdToBinaryMask } from '../luminance/luminance';

/** Distinct, harmonious paper layer colors: desaturated ROYGBIV, mid-to-dark grey, pink, chartreuse */
export const DEFAULT_LAYER_COLORS = [
  '#c75d50', // 1. Desaturated Red (Terracotta)
  '#cc7d43', // 2. Desaturated Orange (Amber Rust)
  '#cfaa4a', // 3. Desaturated Yellow (Warm Mustard)
  '#599b66', // 4. Desaturated Green (Sage / Moss)
  '#4b85a8', // 5. Desaturated Blue (Slate Denim)
  '#566291', // 6. Desaturated Indigo (Dusk Navy)
  '#845688', // 7. Desaturated Violet (Heather Plum)
  '#4a524e', // 8. Mid-to-Dark Grey (Graphite)
  '#c27a8d', // 9. Desaturated Pink (Dusty Rose)
  '#98a349', // 10. Desaturated Chartreuse (Warm Olive-Lime)
];

export function generateAutoThresholds(count: number): number[] {
  if (count <= 1) return [40];
  if (count === 2) return [40, 255];
  
  // Distribute thresholds evenly from layer 0 up to 255
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

/** Generates default layer state array (Default: Layer 0 Solid Black + Layer 1 Red) */
export function createDefaultLayers(count: number = 2): LayerState[] {
  const actualCount = Math.max(2, count);
  const thresholds = generateAutoThresholds(actualCount);

  return thresholds.map((t, index) => {
    if (index === 0) {
      return {
        id: 'layer-0',
        threshold: t,
        minThreshold: 0,
        isSolidBacking: true, // Solid ON by default on app load
        color: '#111111', // Black for Layer 0
        order: 0,
      };
    }

    const cutIndex = index - 1; // 0-based for cut layers (Layer 1 = Red #c75d50)
    return {
      id: `layer-${index}`,
      threshold: t,
      isSolidBacking: false,
      color: DEFAULT_LAYER_COLORS[cutIndex % DEFAULT_LAYER_COLORS.length],
      order: index,
    };
  });
}

/** Validates and enforces strict monotonic threshold ordering (T_0 < T_1 < ... < T_n) */
export function enforceMonotonicThresholds(layers: LayerState[]): LayerState[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  let prevVal = -1;

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
 * Updates a specific layer's threshold with bidirectional cascade pushing:
 * - Dragging down pushes lower layers down
 * - Dragging up pushes higher layers up
 * Strict monotonicity (0 <= T_0 < T_1 < ... < T_n <= 255) is always preserved.
 */
export function updateLayerThreshold(
  layers: LayerState[],
  targetId: string,
  newThreshold: number
): LayerState[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const targetIdx = sorted.findIndex(l => l.id === targetId);
  if (targetIdx === -1) return layers;

  const count = sorted.length;
  const isTop = targetIdx === count - 1;
  const clampedVal = Math.max(0, Math.min(isTop ? 255 : 254, newThreshold));

  const updated: LayerState[] = sorted.map((l, idx) => ({ ...l, order: idx }));
  updated[targetIdx].threshold = clampedVal;

  // 1. Cascade downwards: push lower layers down if needed
  for (let i = targetIdx - 1; i >= 0; i--) {
    if (updated[i].threshold >= updated[i + 1].threshold) {
      updated[i].threshold = Math.max(0, updated[i + 1].threshold - 1);
    }
  }

  // If downwards cascade hit the floor (0), compress upwards
  let floor = 0;
  for (let i = 0; i <= targetIdx; i++) {
    if (updated[i].threshold < floor) {
      updated[i].threshold = floor;
    }
    floor = updated[i].threshold + 1;
  }

  // 2. Cascade upwards: push higher layers up if needed
  for (let i = targetIdx + 1; i < count; i++) {
    if (updated[i].threshold <= updated[i - 1].threshold) {
      const isCurrentTop = i === count - 1;
      updated[i].threshold = Math.min(isCurrentTop ? 255 : 254, updated[i - 1].threshold + 1);
    }
  }

  // If upwards cascade hit the ceiling (255), compress downwards
  let ceiling = 255;
  for (let i = count - 1; i >= 0; i--) {
    if (updated[i].threshold > ceiling) {
      updated[i].threshold = ceiling;
    }
    ceiling = Math.max(0, updated[i].threshold - 1);
  }

  return updated;
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

  // Layer 0 handling: Solid Backing vs Void (Empty space behind stack)
  if (layerIndex === 0) {
    if (currentLayer.isSolidBacking === true) {
      const solidData = new Uint8Array(width * height);
      solidData.fill(1); // 100% solid paper cardstock base
      return { width, height, data: solidData };
    } else {
      const voidData = new Uint8Array(width * height);
      voidData.fill(0); // 100% void / empty space
      return { width, height, data: voidData };
    }
  }

  const prevThreshold = sortedLayers[layerIndex - 1].threshold;
  const currThreshold = currentLayer.threshold;
  const total = width * height;
  const maskData = new Uint8Array(total);

  const isCumulative = mode === 'cumulative';

  for (let i = 0; i < total; i++) {
    if (alpha && alpha[i] < 128) {
      // Outside photo: solid paper (1) unioned into the layer sheet
      maskData[i] = 1;
    } else {
      const val = luminance[i];
      let isCutout = false;

      if (isCumulative) {
        // Cumulative Mode: holes expand progressively on higher threshold layers
        if (!negative) {
          isCutout = val <= currThreshold;
        } else {
          isCutout = val > currThreshold;
        }
      } else {
        // Exclusive / Band Mode: cutout only for luminance within this layer's discrete band
        const bandMin = prevThreshold + 1;
        const inBand = val >= bandMin && val <= currThreshold;
        isCutout = !negative ? inBand : !inBand;
      }

      // Material mask: 1 = solid paper sheet, 0 = cutout hole
      maskData[i] = isCutout ? 0 : 1;
    }
  }

  return { width, height, data: maskData };
}
