import { LayerState, BinaryMask } from '../types';

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

/**
 * Generates evenly spaced cut thresholds for an N-layer physical stack.
 * For N total layers (Layer 0 base + N-1 cut layers), returns array of length N.
 * thresholds[0] = 0 (Base sheet / uncut foundation)
 * thresholds[i] = Math.round((255 / count) * i) for i = 1..N-1 (cut boundaries in [0, 254])
 */
export function generateAutoThresholds(count: number): number[] {
  if (count <= 1) return [0];
  
  const thresholds: number[] = [0];
  const step = 255 / count;
  for (let i = 1; i < count; i++) {
    const val = Math.min(254, Math.round(step * i));
    thresholds.push(val);
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
        threshold: 0,
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

/** Validates and enforces strict monotonic threshold ordering (0 <= T_1 < T_2 < ... < T_n <= 254) */
export function enforceMonotonicThresholds(layers: LayerState[]): LayerState[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  let prevVal = -1;

  return sorted.map((layer, idx) => {
    if (idx === 0) {
      return { ...layer, threshold: 0 };
    }

    const minAllowed = prevVal + 1;
    const maxAllowed = 254 - (sorted.length - 1 - idx);
    const clampedThreshold = Math.max(minAllowed, Math.min(maxAllowed, layer.threshold));
    prevVal = clampedThreshold;
    return {
      ...layer,
      threshold: clampedThreshold,
    };
  });
}

/**
 * Updates a specific cut layer's threshold with bidirectional cascade pushing:
 * - Dragging down pushes lower cut layers down
 * - Dragging up pushes higher cut layers up
 * Strict monotonicity (0 <= T_1 < T_2 < ... < T_{n-1} <= 254) is always preserved.
 */
export function updateLayerThreshold(
  layers: LayerState[],
  targetId: string,
  newThreshold: number
): LayerState[] {
  const sorted = [...layers].sort((a, b) => a.order - b.order);
  const targetIdx = sorted.findIndex(l => l.id === targetId);
  if (targetIdx <= 0) return layers; // Layer 0 has no cut slider

  const count = sorted.length;
  const clampedVal = Math.max(0, Math.min(254, newThreshold));

  const updated: LayerState[] = sorted.map((l, idx) => ({ ...l, order: idx }));
  updated[targetIdx].threshold = clampedVal;

  // 1. Cascade downwards: push lower cut layers down if needed (down to index 1)
  for (let i = targetIdx - 1; i >= 1; i--) {
    if (updated[i].threshold >= updated[i + 1].threshold) {
      updated[i].threshold = Math.max(0, updated[i + 1].threshold - 1);
    }
  }

  // If downwards cascade hit the floor (0), compress upwards
  let floor = 0;
  for (let i = 1; i <= targetIdx; i++) {
    if (updated[i].threshold < floor) {
      updated[i].threshold = floor;
    }
    floor = updated[i].threshold + 1;
  }

  // 2. Cascade upwards: push higher cut layers up if needed
  for (let i = targetIdx + 1; i < count; i++) {
    if (updated[i].threshold <= updated[i - 1].threshold) {
      updated[i].threshold = Math.min(254, updated[i - 1].threshold + 1);
    }
  }

  // If upwards cascade hit the ceiling (254), compress downwards
  let ceiling = 254;
  for (let i = count - 1; i >= 1; i--) {
    if (updated[i].threshold > ceiling) {
      updated[i].threshold = ceiling;
    }
    ceiling = Math.max(0, updated[i].threshold - 1);
  }

  return updated;
}

/**
 * Generates binary mask for a specific layer.
 * Layer 0: 100% solid paper cardstock base (or void)
 * Layer 1..N-1: Cutout holes where luminance <= currentLayer.threshold (revealing lower layers)
 * Extra-image space (outside photo) is solid paper (1) unioned seamlessly into each sheet.
 */
export function generateLayerMask(
  luminance: Uint8Array,
  width: number,
  height: number,
  layerIndex: number,
  allLayers: LayerState[],
  alpha?: Uint8Array | null
): BinaryMask {
  const sortedLayers = [...allLayers].sort((a, b) => a.order - b.order);
  const currentLayer = sortedLayers[layerIndex];
  if (!currentLayer) {
    return { width, height, data: new Uint8Array(width * height) };
  }

  // Layer 0 handling: Solid Backing vs Void (Empty space behind stack)
  if (layerIndex === 0) {
    if (currentLayer.isSolidBacking === false) {
      const voidData = new Uint8Array(width * height);
      voidData.fill(0); // 100% void / empty space
      return { width, height, data: voidData };
    } else {
      const solidData = new Uint8Array(width * height);
      solidData.fill(1); // 100% solid paper cardstock base
      return { width, height, data: solidData };
    }
  }

  const currThreshold = currentLayer.threshold;
  const total = width * height;
  const maskData = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    if (alpha && alpha[i] < 128) {
      // Outside photo: solid paper (1) unioned into the layer sheet
      maskData[i] = 1;
    } else {
      const val = luminance[i];
      // Cumulative Mode: holes cut out where luminance <= threshold
      const isCutout = val <= currThreshold;
      // Material mask: 1 = solid paper sheet, 0 = cutout hole
      maskData[i] = isCutout ? 0 : 1;
    }
  }

  return { width, height, data: maskData };
}
