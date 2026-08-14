import { CanvasPreset, CanvasState, Unit, Point } from '../types';

export const CANVAS_PRESETS: CanvasPreset[] = [
  // 1. Letter
  { name: '8.5 × 11 in (Letter)', width: 8.5, height: 11, unit: 'in' },
  // 2. 12 × 12 in
  { name: '12 × 12 in (Cardstock)', width: 12, height: 12, unit: 'in' },
  // 3. A-Series (A3–A6)
  { name: 'A3 (297 × 420 mm)', width: 297, height: 420, unit: 'mm' },
  { name: 'A4 (210 × 297 mm)', width: 210, height: 297, unit: 'mm' },
  { name: 'A5 (148 × 210 mm)', width: 148, height: 210, unit: 'mm' },
  { name: 'A6 (105 × 148 mm)', width: 105, height: 148, unit: 'mm' },
  // 4. Common Photo & Print Sizes
  { name: '4 × 6 in (Photo)', width: 4, height: 6, unit: 'in' },
  { name: '5 × 7 in (Greeting)', width: 5, height: 7, unit: 'in' },
  { name: '8 × 10 in (Photo)', width: 8, height: 10, unit: 'in' },
  { name: '6 × 9 in (Trade)', width: 6, height: 9, unit: 'in' },
];

/** Converts physical unit value to Inches */
export function convertToInches(value: number, unit: Unit): number {
  if (unit === 'in') return value;
  if (unit === 'mm') return value / 25.4;
  if (unit === 'cm') return value / 2.54;
  return value;
}

/** Converts Inches to physical unit value */
export function convertFromInches(inches: number, unit: Unit): number {
  if (unit === 'in') return inches;
  if (unit === 'mm') return inches * 25.4;
  if (unit === 'cm') return inches * 2.54;
  return inches;
}

/** Converts physical unit value to pixels (at target DPI, default 96 DPI for web/SVG) */
export function convertToPixels(value: number, unit: Unit, dpi: number = 96): number {
  const inches = convertToInches(value, unit);
  return inches * dpi;
}

/** Calculates printable interior dimensions taking margins into account */
export function getPrintableArea(canvas: CanvasState) {
  const widthPx = convertToPixels(canvas.width, canvas.unit);
  const heightPx = convertToPixels(canvas.height, canvas.unit);
  const marginPx = convertToPixels(canvas.margin, canvas.unit);

  return {
    widthPx,
    heightPx,
    marginPx,
    printableWidthPx: Math.max(10, widthPx - marginPx * 2),
    printableHeightPx: Math.max(10, heightPx - marginPx * 2),
  };
}

/** Generates SVG path string for 4 corner registration targets */
export function generateRegistrationMarksSVG(canvas: CanvasState, viewW?: number, viewH?: number): string {
  const { widthPx, heightPx, marginPx } = getPrintableArea(canvas);
  const w = viewW || widthPx;
  const h = viewH || heightPx;
  const scale = w / Math.max(1, widthPx);

  const size = 12 * scale; // 12px crosshair size
  const offset = Math.max(4, (marginPx / 2) * scale);

  const corners: Point[] = [
    { x: offset, y: offset },                     // Top-Left
    { x: w - offset, y: offset },                 // Top-Right
    { x: offset, y: h - offset },                // Bottom-Left
    { x: w - offset, y: h - offset },             // Bottom-Right
  ];

  let pathData = '';
  corners.forEach(p => {
    // Crosshair lines
    pathData += `M ${p.x - size / 2} ${p.y} H ${p.x + size / 2} M ${p.x} ${p.y - size / 2} V ${p.y + size / 2} `;
  });

  return pathData;
}
