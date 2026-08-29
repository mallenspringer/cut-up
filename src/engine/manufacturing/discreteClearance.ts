import { BinaryMask } from '../types';

/**
 * Fast connected-component morphological clearance for rectilinear / polygonal cut masks.
 * 
 * Unlike Gaussian blur, this operates directly on discrete pixel topology:
 * 1. Eliminates positive material islands smaller than minAreaPx.
 * 2. Fills negative space cutout pinholes smaller than minAreaPx.
 * 3. Preserves 100% strictly parallel and perpendicular 90° cutlines with ZERO corner rounding.
 */
export function cleanBinaryMaskDiscrete(
  mask: BinaryMask,
  minFeaturePhysicalSizeMm: number,
  pixelPerMm: number
): BinaryMask {
  const { width, height, data } = mask;
  const totalPixels = width * height;

  if (totalPixels === 0 || pixelPerMm <= 0 || minFeaturePhysicalSizeMm <= 0.2) {
    return mask;
  }

  // Minimum feature area in pixels (e.g. 3mm x 3mm square)
  const diameterPx = minFeaturePhysicalSizeMm * pixelPerMm;
  const minAreaPx = Math.max(2, Math.round(diameterPx * diameterPx));

  const result = new Uint8Array(data);
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);

  // Pass 1: Eliminate small positive material islands (1s)
  for (let startIdx = 0; startIdx < totalPixels; startIdx++) {
    if (result[startIdx] === 1 && visited[startIdx] === 0) {
      let head = 0;
      let tail = 0;

      queue[tail++] = startIdx;
      visited[startIdx] = 1;

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;

        // 4-connected neighbors
        // Left
        if (cx > 0) {
          const n = curr - 1;
          if (result[n] === 1 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Right
        if (cx < width - 1) {
          const n = curr + 1;
          if (result[n] === 1 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Top
        if (cy > 0) {
          const n = curr - width;
          if (result[n] === 1 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Bottom
        if (cy < height - 1) {
          const n = curr + width;
          if (result[n] === 1 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }

      const componentSize = tail;
      if (componentSize < minAreaPx) {
        // Clear small island to 0
        for (let i = 0; i < tail; i++) {
          result[queue[i]] = 0;
        }
      }
    }
  }

  // Pass 2: Fill small negative space holes (0s)
  visited.fill(0);

  for (let startIdx = 0; startIdx < totalPixels; startIdx++) {
    if (result[startIdx] === 0 && visited[startIdx] === 0) {
      let head = 0;
      let tail = 0;
      let touchesBorder = false;

      queue[tail++] = startIdx;
      visited[startIdx] = 1;

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = (curr / width) | 0;

        if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
          touchesBorder = true;
        }

        // Left
        if (cx > 0) {
          const n = curr - 1;
          if (result[n] === 0 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Right
        if (cx < width - 1) {
          const n = curr + 1;
          if (result[n] === 0 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Top
        if (cy > 0) {
          const n = curr - width;
          if (result[n] === 0 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
        // Bottom
        if (cy < height - 1) {
          const n = curr + width;
          if (result[n] === 0 && visited[n] === 0) {
            visited[n] = 1;
            queue[tail++] = n;
          }
        }
      }

      const componentSize = tail;
      // Do not fill background border negative space
      if (!touchesBorder && componentSize < minAreaPx) {
        // Fill small pinhole to 1
        for (let i = 0; i < tail; i++) {
          result[queue[i]] = 1;
        }
      }
    }
  }

  return {
    width,
    height,
    data: result,
  };
}
