import { AestheticFilterState, FilterContext, PixelateFilterConfig, VoronoiFilterConfig } from './types';
import { applyPixelateFilter } from './pixelate';
import { applyVoronoiFilter } from './voronoi';

export const DEFAULT_PIXELATE_CONFIG: PixelateFilterConfig = {
  blockSizeMm: 4.0,
  sampleMethod: 'mean' as const,
  gridSnap: true,
  cornerStyle: 'orthogonal' as const,
};

export const DEFAULT_VORONOI_CONFIG: VoronoiFilterConfig = {
  facetCount: 150,
  jitter: 65,
  sampleMethod: 'mean' as const,
  seed: 1,
  cornerStyle: 'orthogonal' as const,
};

export const DEFAULT_AESTHETIC_FILTER_STATE: AestheticFilterState = {
  enabled: false,
  type: 'none',
  pixelate: DEFAULT_PIXELATE_CONFIG,
  voronoi: DEFAULT_VORONOI_CONFIG,
};

/**
 * Main entry point for the Aesthetic Discretization Filter Pipeline.
 *
 * If no filter is active, returns the input luminance buffer untouched.
 * Otherwise, applies the selected discretization algorithm to the luminance buffer.
 */
export function applyAestheticFilter(
  luminance: Uint8Array,
  filterState: AestheticFilterState | undefined,
  context: FilterContext
): Uint8Array {
  if (!filterState || !filterState.enabled || filterState.type === 'none') {
    return luminance;
  }

  switch (filterState.type) {
    case 'pixelate':
      return applyPixelateFilter(
        luminance,
        filterState.pixelate || DEFAULT_PIXELATE_CONFIG,
        context
      );

    case 'voronoi':
      return applyVoronoiFilter(
        luminance,
        filterState.voronoi || DEFAULT_VORONOI_CONFIG,
        context
      );

    default:
      return luminance;
  }
}
