import { VoronoiFilterConfig, FilterContext } from './types';

/**
 * Fast Mulberry32 deterministic pseudo-random number generator.
 */
function createPRNG(seed: number) {
  let s = (seed | 0) + 0x6d2b79f5;
  return function () {
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    s = (s + 0x9e3779b9) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface VoronoiSeed {
  x: number;
  y: number;
  id: number;
}

/**
 * Generates a jittered triangular/hexagonal lattice of seed points over the image/canvas bounds.
 *
 * - At jitter = 0%, produces regular isometric hexagonal grid points.
 * - At jitter = 100%, produces natural, crystalline low-poly seeds.
 */
export function generateJitteredSeeds(
  bounds: { left: number; top: number; width: number; height: number },
  facetCount: number,
  jitterPercent: number,
  seedNumber: number
): VoronoiSeed[] {
  const prng = createPRNG(seedNumber);
  const count = Math.max(10, Math.min(1000, facetCount));
  const jitterFactor = Math.max(0, Math.min(100, jitterPercent)) / 100;

  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const area = w * h;

  // Approximate cell radius / pitch based on hexagonal packing
  const cellArea = area / count;
  const spacing = Math.sqrt(cellArea * 1.1547);
  const dx = spacing;
  const dy = spacing * 0.866025; // sqrt(3)/2

  const seeds: VoronoiSeed[] = [];
  let id = 0;

  // Extend 1-2 steps beyond bounds to ensure clean Voronoi boundary edges
  const minX = bounds.left - dx * 1.5;
  const maxX = bounds.left + w + dx * 1.5;
  const minY = bounds.top - dy * 1.5;
  const maxY = bounds.top + h + dy * 1.5;

  let row = 0;
  for (let gy = minY; gy <= maxY; gy += dy) {
    const rowOffset = (row % 2 === 1) ? dx * 0.5 : 0;
    for (let gx = minX + rowOffset; gx <= maxX; gx += dx) {
      // Deterministic pseudo-random jitter displacement
      const jx = (prng() - 0.5) * dx * jitterFactor * 0.95;
      const jy = (prng() - 0.5) * dy * jitterFactor * 0.95;

      seeds.push({
        x: gx + jx,
        y: gy + jy,
        id: id++,
      });
    }
    row++;
  }

  return seeds;
}

/**
 * Applies the Low-Poly / Voronoi Facets Discretization Filter to a grayscale luminance buffer.
 *
 * 1. Generates a deterministic jittered hexagonal seed lattice anchored to image crop bounds.
 * 2. Rapidly computes the nearest Voronoi cell for each canvas pixel via 2D spatial grid bucketing.
 * 3. Quantizes luminance across each polygon facet using Mean or Median sampling.
 * 4. Yields clean polygonal luminance segments ready for straight-line vector tracing.
 */
export function applyVoronoiFilter(
  luminance: Uint8Array,
  config: VoronoiFilterConfig,
  context: FilterContext
): Uint8Array {
  const { width, height, pxPerMm, alpha, imageBounds } = context;
  const totalPixels = width * height;

  if (totalPixels === 0 || pxPerMm <= 0) {
    return new Uint8Array(luminance);
  }

  const bounds = imageBounds || { left: 0, top: 0, width, height };
  const seeds = generateJitteredSeeds(
    bounds,
    config.facetCount || 150,
    config.jitter !== undefined ? config.jitter : 65,
    config.seed || 1
  );

  const numSeeds = seeds.length;
  if (numSeeds === 0) {
    return new Uint8Array(luminance);
  }

  // 1. Build spatial grid buckets for O(1) nearest-seed query per pixel
  const bucketSize = Math.max(16, Math.round(Math.sqrt((width * height) / numSeeds) * 1.25));
  const gridCols = Math.ceil(width / bucketSize);
  const gridRows = Math.ceil(height / bucketSize);
  const grid: number[][] = Array.from({ length: gridCols * gridRows }, () => []);

  for (let i = 0; i < numSeeds; i++) {
    const s = seeds[i];
    const col = Math.floor(s.x / bucketSize);
    const row = Math.floor(s.y / bucketSize);

    // Insert into grid if near canvas bounds
    for (let r = Math.max(0, row - 1); r <= Math.min(gridRows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(gridCols - 1, col + 1); c++) {
        grid[r * gridCols + c].push(i);
      }
    }
  }

  // 2. Pixel assignment and accumulator structures
  const sampleMethod = config.sampleMethod || 'mean';
  const cellSum = new Uint32Array(numSeeds);
  const cellCount = new Uint32Array(numSeeds);
  const pixelToCell = new Uint32Array(totalPixels);

  // Median histograms: 256 bins per cell if median requested
  const medianHists = sampleMethod === 'median' ? new Uint32Array(numSeeds * 256) : null;

  // 3. Pixel classification pass
  for (let y = 0; y < height; y++) {
    const rowIdx = y * width;
    const gRow = Math.min(gridRows - 1, Math.max(0, Math.floor(y / bucketSize)));

    for (let x = 0; x < width; x++) {
      const idx = rowIdx + x;
      const gCol = Math.min(gridCols - 1, Math.max(0, Math.floor(x / bucketSize)));
      const candidates = grid[gRow * gridCols + gCol];

      let bestDistSq = Infinity;
      let bestSeed = 0;

      if (candidates && candidates.length > 0) {
        for (let k = 0; k < candidates.length; k++) {
          const sIdx = candidates[k];
          const s = seeds[sIdx];
          const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestSeed = sIdx;
          }
        }
      } else {
        // Fallback exhaustive search if bucket had no candidates (e.g. corner extreme)
        for (let sIdx = 0; sIdx < numSeeds; sIdx++) {
          const s = seeds[sIdx];
          const dSq = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestSeed = sIdx;
          }
        }
      }

      pixelToCell[idx] = bestSeed;

      // Accumulate luminance if within image material alpha
      if (!alpha || alpha[idx] >= 128) {
        const val = luminance[idx];
        cellCount[bestSeed]++;
        if (sampleMethod === 'median' && medianHists) {
          medianHists[bestSeed * 256 + val]++;
        } else {
          cellSum[bestSeed] += val;
        }
      }
    }
  }

  // 4. Compute quantized luminance value for each Voronoi polygon cell
  const cellVal = new Uint8Array(numSeeds);
  for (let i = 0; i < numSeeds; i++) {
    const count = cellCount[i];
    if (count > 0) {
      if (sampleMethod === 'median' && medianHists) {
        const targetRank = Math.floor(count / 2);
        let accumulated = 0;
        let medianVal = 128;
        const offset = i * 256;
        for (let v = 0; v < 256; v++) {
          accumulated += medianHists[offset + v];
          if (accumulated > targetRank) {
            medianVal = v;
            break;
          }
        }
        cellVal[i] = medianVal;
      } else {
        cellVal[i] = Math.round(cellSum[i] / count);
      }
    } else {
      cellVal[i] = 255;
    }
  }

  // 5. Output quantized luminance buffer
  const output = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    if (alpha && alpha[i] < 128) {
      output[i] = 255; // Keep un-imaged canvas space white / 255
    } else {
      const cellIdx = pixelToCell[i];
      output[i] = cellVal[cellIdx];
    }
  }

  return output;
}
