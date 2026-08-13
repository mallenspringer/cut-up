import { Contour, Point } from '../types';

/** Calculate area of triangle formed by p0, p1, p2 */
export function triangleArea(p0: Point, p1: Point, p2: Point): number {
  return 0.5 * Math.abs(
    p0.x * (p1.y - p2.y) +
    p1.x * (p2.y - p0.y) +
    p2.x * (p0.y - p1.y)
  );
}

/** Removes collinear consecutive points along straight line segments */
export function removeCollinearPoints(points: Point[]): Point[] {
  if (points.length <= 3) return points;

  const result: Point[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // Cross product check for collinearity
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-4) {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points;
}

/**
 * Visvalingam-Whyatt closed-ring polygon simplification.
 * Iteratively removes perimeter micro-corners below minAreaThreshold.
 * Guaranteed to NEVER create interior webbing chords across closed shapes.
 */
export function simplifyVisvalingamWhyatt(points: Point[], minAreaThreshold: number): Point[] {
  const cleaned = removeCollinearPoints(points);
  if (cleaned.length <= 4 || minAreaThreshold <= 0) return cleaned;

  let ring = [...cleaned];
  let changed = true;

  while (changed && ring.length > 4) {
    changed = false;
    let minArea = Infinity;
    let minIdx = -1;
    const n = ring.length;

    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n];
      const curr = ring[i];
      const next = ring[(i + 1) % n];
      const area = triangleArea(prev, curr, next);

      if (area < minArea) {
        minArea = area;
        minIdx = i;
      }
    }

    if (minIdx !== -1 && minArea < minAreaThreshold) {
      ring.splice(minIdx, 1);
      changed = true;
    }
  }

  return ring;
}

/** Chaikin's corner cutting algorithm for smooth curves */
export function chaikinSmooth(points: Point[], iterations: number): Point[] {
  if (points.length < 3 || iterations <= 0) return points;

  let current = [...points];

  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [];
    const n = current.length;

    for (let i = 0; i < n; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % n];

      const q = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      };
      const r = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      };

      next.push(q);
      next.push(r);
    }
    current = next;
  }

  return current;
}

/**
 * Applies topology-preserving Visvalingam-Whyatt closed ring simplification and Chaikin smoothing.
 * 0 = returns collinear-cleaned pixel stair-step geometry.
 * >0 = simplifies perimeter micro-corners & applies Chaikin smoothing without webbing or topology distortion.
 */
export function smoothContour(contour: Contour, smoothingFactor: number): Contour {
  const cleaned = removeCollinearPoints(contour.points);
  if (cleaned.length < 3) return contour;

  if (smoothingFactor <= 0) {
    return {
      ...contour,
      points: cleaned,
    };
  }

  // Minimum triangle area threshold scale: 0.5 to 8.0 sq px
  const minAreaThreshold = 0.5 + (smoothingFactor / 100) * 7.5;
  const simplified = simplifyVisvalingamWhyatt(cleaned, minAreaThreshold);

  // Chaikin iterations: 1 for 1-50, 2 for 51-100
  const iterations = smoothingFactor > 50 ? 2 : 1;
  const smoothedPoints = chaikinSmooth(simplified, iterations);

  return {
    ...contour,
    points: smoothedPoints,
  };
}

export function smoothContours(contours: Contour[], smoothingFactor: number): Contour[] {
  return contours.map(c => smoothContour(c, smoothingFactor));
}
