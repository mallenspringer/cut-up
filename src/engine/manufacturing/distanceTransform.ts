import { BinaryMask } from '../types';

/**
 * Computes 2D Squared Euclidean Distance Transform using Felzenszwalb-Huttenlocher algorithm.
 * O(Width * Height) linear time complexity.
 */
export function computeDistanceTransform(mask: BinaryMask, targetValue: number): Float32Array {
  const { width, height, data } = mask;
  const dist = new Float32Array(width * height);
  const INF = 1e9;

  // Step 1: Initialize 1D column transforms
  for (let x = 0; x < width; x++) {
    // Top-to-bottom pass
    let d = INF;
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      if (data[idx] === targetValue) {
        d = 0;
      } else {
        d++;
      }
      dist[idx] = d * d;
    }
    // Bottom-to-top pass
    d = INF;
    for (let y = height - 1; y >= 0; y--) {
      const idx = y * width + x;
      if (data[idx] === targetValue) {
        d = 0;
      } else {
        d = Math.min(d + 1, INF);
      }
      dist[idx] = Math.min(dist[idx], d * d);
    }
  }

  // Step 2: 1D horizontal parabolic envelope pass per row
  const v = new Int32Array(width);
  const z = new Float32Array(width + 1);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;

    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;

    for (let q = 1; q < width; q++) {
      let s = ((dist[rowOffset + q] + q * q) - (dist[rowOffset + v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (k > 0 && s <= z[k]) {
        k--;
        s = ((dist[rowOffset + q] + q * q) - (dist[rowOffset + v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }

    k = 0;
    for (let q = 0; q < width; q++) {
      while (z[k + 1] < q) {
        k++;
      }
      const dx = q - v[k];
      dist[rowOffset + q] = dx * dx + dist[rowOffset + v[k]];
    }
  }

  // Return true Euclidean distance (square root)
  for (let i = 0; i < dist.length; i++) {
    dist[i] = Math.sqrt(dist[i]);
  }

  return dist;
}

/**
 * Performs Morphological Opening (Erode then Dilate) using Distance Transform.
 * Removes isolated material regions & narrow bridges thinner than 2 * radius.
 */
export function morphologicalOpening(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) return mask;
  const { width, height, data } = mask;

  // 1. Distance to nearest non-material pixel (0)
  const distToBg = computeDistanceTransform(mask, 0);

  // 2. Erosion: Keep material only if distance to background > radius
  const erodedData = new Uint8Array(width * height);
  for (let i = 0; i < distToBg.length; i++) {
    if (data[i] === 1 && distToBg[i] > radius) {
      erodedData[i] = 1;
    }
  }

  const erodedMask: BinaryMask = { width, height, data: erodedData };

  // 3. Distance to nearest eroded material pixel (1)
  const distToEroded = computeDistanceTransform(erodedMask, 1);

  // 4. Dilation: Material if distance to eroded material <= radius
  const openedData = new Uint8Array(width * height);
  for (let i = 0; i < distToEroded.length; i++) {
    if (distToEroded[i] <= radius) {
      openedData[i] = 1;
    }
  }

  return { width, height, data: openedData };
}

/**
 * Performs Morphological Closing (Dilate then Erode) using Distance Transform.
 * Fills tiny enclosed holes & bridges exterior gaps narrower than 2 * radius.
 */
export function morphologicalClosing(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) return mask;
  const { width, height } = mask;

  // 1. Distance to nearest material pixel (1)
  const distToFg = computeDistanceTransform(mask, 1);

  // 2. Dilation: Material if distance to material <= radius
  const dilatedData = new Uint8Array(width * height);
  for (let i = 0; i < distToFg.length; i++) {
    if (distToFg[i] <= radius) {
      dilatedData[i] = 1;
    }
  }

  const dilatedMask: BinaryMask = { width, height, data: dilatedData };

  // 3. Distance to nearest non-material pixel (0) in dilated mask
  const distToDilatedBg = computeDistanceTransform(dilatedMask, 0);

  // 4. Erosion: Material if distance to background > radius
  const closedData = new Uint8Array(width * height);
  for (let i = 0; i < distToDilatedBg.length; i++) {
    if (distToDilatedBg[i] > radius) {
      closedData[i] = 1;
    }
  }

  return { width, height, data: closedData };
}

/**
 * Performs full manufacturability cleanup on binary mask given physical feature size W and resolution DPI.
 * Order: Closing (fill holes & bridge gaps) followed by Opening (remove tiny islands).
 */
export function cleanupManufacturability(
  mask: BinaryMask,
  minFeaturePhysicalSize: number, // in mm
  pixelPerMm: number
): BinaryMask {
  if (minFeaturePhysicalSize <= 0 || pixelPerMm <= 0) return mask;

  // Radius = W / 2 in pixels
  const radiusPx = (minFeaturePhysicalSize * pixelPerMm) / 2;
  if (radiusPx < 0.5) return mask;

  // Step 1: Closing (fills holes & bridges gaps < W)
  const closed = morphologicalClosing(mask, radiusPx);

  // Step 2: Opening (removes islands & narrow features < W)
  const cleaned = morphologicalOpening(closed, radiusPx);

  return cleaned;
}
