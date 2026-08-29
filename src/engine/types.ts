export type Unit = 'in' | 'mm' | 'cm';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RasterScaleMethod = 'nearest';

export interface SourceImage {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio: number;
  dataUrl: string;
  imageData?: ImageData;
}

export interface CropShape {
  type: 'rectangle';
  geometry: Rect;
}

export interface WorkingImageState {
  crop: CropShape;
  position: Point; // Offset relative to canvas printable area
  scaleX: number;  // Scale multiplier (1.0 = fit to canvas)
  scaleY: number;  // Scale multiplier
  lockAspect?: boolean; // Default true
  rasterScaleMethod: RasterScaleMethod;
}

export interface CanvasPreset {
  name: string;
  width: number;
  height: number;
  unit: Unit;
}

export interface CanvasState {
  width: number;
  height: number;
  unit: Unit;
  margin: number; // in physical unit
  orientation: 'portrait' | 'landscape';
}

export interface ProcessingState {
  minimumFeatureSize: number; // in physical unit (mm)
  smoothing: number; // 0 to 100
}

export interface ManualBridgeStroke {
  id: string;
  x1: number; // normalized 0..1 across canvas printable width
  y1: number; // normalized 0..1 across canvas printable height
  x2: number;
  y2: number;
  widthMm: number; // physical thickness in mm
}

export interface ManualFillPoint {
  id: string;
  x: number; // normalized 0..1 across canvas printable width
  y: number; // normalized 0..1 across canvas printable height
  fillType: 0 | 1; // 1 = solid paper fill, 0 = erase to hole
}

export interface LayerManualEdits {
  bridges: ManualBridgeStroke[];
  fills: ManualFillPoint[];
}

export interface LayerState {
  id: string;
  threshold: number;      // 0 to 255 (End threshold)
  minThreshold?: number;  // 0 to 255 (Start threshold for Layer 1 when solid backing is OFF, default 0)
  isSolidBacking?: boolean; // Default true for Layer 1 (uncut base paper sheet), false for higher layers
  color: string;          // Hex preview color e.g. #3b82f6
  order: number;          // 0 = bottom, higher = upper layer
  manualEdits?: LayerManualEdits;
}

export interface OutputState {
  registrationMarks: boolean;
  exportMode: 'combined' | 'package';
}

export type CanvasTool = 'navigate' | 'wand' | 'bridge';

export type AestheticFilterType = 'none' | 'pixelate' | 'voronoi';

export interface PixelateFilterConfig {
  blockSizeMm: number; // 1.0 to 15.0 mm (default: 4.0mm)
  sampleMethod: 'mean' | 'median'; // default: 'mean'
  gridSnap: boolean; // default: true
  cornerStyle: 'orthogonal' | 'rounded'; // default: 'orthogonal' (90° parallel/perpendicular cuts)
}

export interface VoronoiFilterConfig {
  facetCount: number; // 30 to 600 (default: 150)
  jitter: number; // 0 to 100% (default: 65%)
  sampleMethod: 'mean' | 'median'; // default: 'mean'
  seed: number; // integer random seed (default: 1)
  cornerStyle: 'orthogonal' | 'rounded'; // default: 'orthogonal' (sharp straight facets)
}

export interface AestheticFilterState {
  enabled: boolean;
  type: AestheticFilterType;
  pixelate: PixelateFilterConfig;
  voronoi: VoronoiFilterConfig;
}

export interface AppState {
  sourceImage: SourceImage | null;
  workingImage: WorkingImageState;
  canvas: CanvasState;
  processing: ProcessingState;
  aestheticFilter: AestheticFilterState;
  layers: LayerState[];
  selectedLayerId?: string;
  output: OutputState;
  activeTool?: CanvasTool;
  bridgeWidthMm?: number;
}

/** Binary material mask: 1 = MATERIAL, 0 = NON_MATERIAL */
export interface BinaryMask {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Vector Contour */
export interface Contour {
  points: Point[];
  isHole: boolean;
  area: number;
  bounds: Rect;
  children?: Contour[];
}

export type PreviewTab = 'source' | 'binary' | 'cut' | 'layer' | 'composite';
