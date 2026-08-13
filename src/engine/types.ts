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

export type LayerMode = 'cumulative' | 'exclusive';

export interface ProcessingState {
  mode: LayerMode;
  negative: boolean;
  minimumFeatureSize: number; // in physical unit (mm)
  smoothing: number; // 0 to 100
}

export interface LayerState {
  id: string;
  threshold: number;      // 0 to 255 (End threshold)
  minThreshold?: number;  // 0 to 255 (Start threshold for Layer 1 when solid backing is OFF, default 0)
  isSolidBacking?: boolean; // Default true for Layer 1 (uncut base paper sheet), false for higher layers
  color: string;          // Hex preview color e.g. #3b82f6
  order: number;          // 0 = bottom, higher = upper layer
}

export interface OutputState {
  registrationMarks: boolean;
  exportMode: 'combined' | 'package';
}

export interface AppState {
  sourceImage: SourceImage | null;
  workingImage: WorkingImageState;
  canvas: CanvasState;
  processing: ProcessingState;
  layers: LayerState[];
  selectedLayerId?: string;
  output: OutputState;
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
