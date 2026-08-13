import { BinaryMask, Contour, Point, Rect } from '../types';
import { removeCollinearPoints } from './smoothing';

/**
 * Computes polygon area using the Shoelace formula.
 * Positive = Clockwise in screen coordinates, Negative = Counter-clockwise.
 */
export function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

export function calculateBoundingBox(points: Point[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

/** Check if bounding box A is within bounding box B */
export function isRectInsideRect(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - 1e-4 &&
    inner.y >= outer.y - 1e-4 &&
    inner.x + inner.width <= outer.x + outer.width + 1e-4 &&
    inner.y + inner.height <= outer.y + outer.height + 1e-4
  );
}

/** Check if point p is strictly inside polygon */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const { x, y } = point;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 1e-10) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Extracts closed contours from a binary material mask using boundary tracing on pixel grid.
 */
export function extractContours(mask: BinaryMask): Contour[] {
  const { width, height, data } = mask;
  const visitedHorizontal = new Uint8Array((width + 1) * (height + 1));
  const visitedVertical = new Uint8Array((width + 1) * (height + 1));

  function getPixel(x: number, y: number): number {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return data[y * width + x];
  }

  const contours: Contour[] = [];

  // Edge directions: 0: Right (+x), 1: Down (+y), 2: Left (-x), 3: Up (-y)
  const dx = [1, 0, -1, 0];
  const dy = [0, 1, 0, -1];

  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      const top = getPixel(x, y - 1);
      const bot = getPixel(x, y);

      // Horizontal edge transition between material and non-material
      if (top !== bot) {
        const edgeIdx = y * (width + 1) + x;
        if (!visitedHorizontal[edgeIdx]) {
          // Trace boundary loop
          const points: Point[] = [];
          let currX = x;
          let currY = y;
          let dir = top === 0 && bot === 1 ? 0 : 2;

          let startX = currX;
          let startY = currY;
          let startDir = dir;
          let step = 0;

          while (step === 0 || !(currX === startX && currY === startY && dir === startDir)) {
            if (step > 10000) break;
            step++;

            if (dir === 0) visitedHorizontal[currY * (width + 1) + currX] = 1;
            else if (dir === 2) visitedHorizontal[currY * (width + 1) + (currX - 1)] = 1;
            else if (dir === 1) visitedVertical[currY * (width + 1) + currX] = 1;
            else if (dir === 3) visitedVertical[(currY - 1) * (width + 1) + currX] = 1;

            points.push({ x: currX, y: currY });

            let pL = 0, pR = 0;
            if (dir === 0) { pL = getPixel(currX, currY - 1); pR = getPixel(currX, currY); }
            else if (dir === 1) { pL = getPixel(currX, currY); pR = getPixel(currX - 1, currY); }
            else if (dir === 2) { pL = getPixel(currX - 1, currY); pR = getPixel(currX - 1, currY - 1); }
            else if (dir === 3) { pL = getPixel(currX - 1, currY - 1); pR = getPixel(currX, currY - 1); }

            if (pL === 1) {
              dir = (dir + 3) % 4; // Turn Left
            } else if (pR === 0) {
              dir = (dir + 1) % 4; // Turn Right
            }

            currX += dx[dir];
            currY += dy[dir];
          }

          const cleanPoints = removeCollinearPoints(points);
          if (cleanPoints.length >= 3) {
            const area = calculatePolygonArea(cleanPoints);
            // Clockwise loop (area > 0) = Outer material boundary; Counter-clockwise (area < 0) = Inner hole
            const isHole = area < 0;
            contours.push({
              points: cleanPoints,
              isHole,
              area: Math.abs(area),
              bounds: calculateBoundingBox(cleanPoints),
            });
          }
        }
      }
    }
  }

  // Build hierarchy: assign hole contours to their parent material contour
  const outerContours = contours.filter(c => !c.isHole);
  const holeContours = contours.filter(c => c.isHole);

  for (const hole of holeContours) {
    let bestParent: Contour | null = null;
    let smallestParentArea = Infinity;

    for (const outer of outerContours) {
      // Fast O(1) bounding box check before expensive point-in-polygon vertex loop
      if (
        outer.area > hole.area &&
        isRectInsideRect(hole.bounds, outer.bounds) &&
        isPointInPolygon(hole.points[0], outer.points)
      ) {
        if (outer.area < smallestParentArea) {
          bestParent = outer;
          smallestParentArea = outer.area;
        }
      }
    }

    if (bestParent) {
      if (!bestParent.children) bestParent.children = [];
      bestParent.children.push(hole);
    }
  }

  return contours;
}
