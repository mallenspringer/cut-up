import { AestheticFilterType, PixelateFilterConfig, VoronoiFilterConfig, AestheticFilterState } from '../types';
import { ImagePlacementBounds } from '../working/transform';

export type { AestheticFilterType, PixelateFilterConfig, VoronoiFilterConfig, AestheticFilterState, ImagePlacementBounds };

export interface FilterContext {
  width: number;
  height: number;
  pxPerMm: number;
  alpha?: Uint8Array | null;
  imageBounds?: ImagePlacementBounds;
}
