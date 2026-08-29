import React from 'react';
import { AppState, AestheticFilterType } from '../../engine/types';
import { ShieldAlert, Sparkles, Sliders, Grid3X3, Wand2, Dices, Diamond } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import { DEFAULT_PIXELATE_CONFIG, DEFAULT_VORONOI_CONFIG } from '../../engine/filters/filterEngine';

interface ProcessingPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  defaultOpen?: boolean;
}

export const ProcessingPanel: React.FC<ProcessingPanelProps> = ({
  state,
  onUpdateState,
  defaultOpen = true,
}) => {
  const { processing } = state;
  const filter = state.aestheticFilter || {
    enabled: false,
    type: 'none' as AestheticFilterType,
    pixelate: DEFAULT_PIXELATE_CONFIG,
    voronoi: DEFAULT_VORONOI_CONFIG,
  };

  const isPixelateActive = filter.enabled && filter.type === 'pixelate';
  const isVoronoiActive = filter.enabled && filter.type === 'voronoi';

  const handleFilterTypeChange = (newType: AestheticFilterType) => {
    onUpdateState(prev => {
      const prevFilter = prev.aestheticFilter || {
        enabled: false,
        type: 'none' as AestheticFilterType,
        pixelate: DEFAULT_PIXELATE_CONFIG,
        voronoi: DEFAULT_VORONOI_CONFIG,
      };

      const isEnabled = newType !== 'none';

      return {
        ...prev,
        aestheticFilter: {
          ...prevFilter,
          enabled: isEnabled,
          type: newType,
          pixelate: prevFilter.pixelate || DEFAULT_PIXELATE_CONFIG,
          voronoi: prevFilter.voronoi || DEFAULT_VORONOI_CONFIG,
        },
      };
    });
  };

  const handleShuffleVoronoiSeed = () => {
    onUpdateState(prev => ({
      ...prev,
      aestheticFilter: {
        ...prev.aestheticFilter,
        enabled: true,
        type: 'voronoi',
        voronoi: {
          ...prev.aestheticFilter.voronoi,
          seed: Math.floor(Math.random() * 1000000) + 1,
        },
      },
    }));
  };

  return (
    <CollapsibleSection
      title="Clearance & Filters"
      icon={<Sliders className="w-4 h-4" />}
      defaultOpen={defaultOpen}
      badge={
        isPixelateActive ? (
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            Mosaic
          </span>
        ) : isVoronoiActive ? (
          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            Voronoi
          </span>
        ) : null
      }
    >
      {/* 1. Minimum Feature Size Clearance (Physical Blade & Laser Safety) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-sand-200 font-medium flex items-center gap-1.5">
            <ShieldAlert
              className={`w-3.5 h-3.5 transition-colors ${
                processing.minimumFeatureSize === 0
                  ? 'text-red-500 animate-pulse'
                  : 'text-amber-400'
              }`}
            />{' '}
            Min Clearance
          </label>
          <span
            className={`font-mono font-medium ${
              processing.minimumFeatureSize === 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {processing.minimumFeatureSize === 0
              ? '0.0 mm (Off / Print)'
              : `${processing.minimumFeatureSize.toFixed(1)} mm`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={processing.minimumFeatureSize}
          onChange={(e) => {
            const minimumFeatureSize = parseFloat(e.target.value);
            onUpdateState(prev => ({
              ...prev,
              processing: {
                ...prev.processing,
                minimumFeatureSize: isNaN(minimumFeatureSize) ? 0 : minimumFeatureSize,
              },
            }));
          }}
        />
        <div className="text-[11px] text-sand-400/80 leading-tight">
          {processing.minimumFeatureSize === 0
            ? 'Clearance filter disabled. 100% raw detail preserved (Ideal for high-res print or fine laser detail).'
            : `Removes islands, fills holes, & bridges gaps narrower than ${processing.minimumFeatureSize.toFixed(1)} mm.`}
        </div>
      </div>

      {/* 2. Aesthetic Filter Selector */}
      <div className="pt-2 border-t border-sand-800/60 space-y-2">
        <label className="text-xs text-sand-200 font-medium flex items-center gap-1.5">
          <Wand2 className="w-3.5 h-3.5 text-emerald-400" /> Aesthetic Filter
        </label>
        <select
          value={filter.enabled ? filter.type : 'none'}
          onChange={(e) => handleFilterTypeChange(e.target.value as AestheticFilterType)}
          className="w-full bg-[#142017] text-sand-100 text-xs rounded-lg px-3 py-2 border border-sand-700/80 focus:border-emerald-500 focus:outline-none transition shadow-sm font-medium"
        >
          <option value="none">None (Standard Organic Curves)</option>
          <option value="pixelate">Pixel Block / Voxel Mosaic (90° Cuts)</option>
          <option value="voronoi">Low-Poly / Voronoi Facets (Geometric Shards)</option>
        </select>
      </div>

      {/* 3. Dynamic Filter Parameters */}
      {isPixelateActive ? (
        <div className="p-3 bg-[#111a13]/80 rounded-lg border border-sand-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sand-200 flex items-center gap-1.5">
              <Grid3X3 className="w-3.5 h-3.5 text-emerald-400" /> Block Mosaic Settings
            </span>
            <span className="text-[10px] text-emerald-400/90 font-mono">90° Rectilinear</span>
          </div>

          {/* Block Size Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-sand-300 font-medium">Block Size</label>
              <span className="font-mono text-emerald-400 font-medium">
                {filter.pixelate.blockSizeMm.toFixed(1)} mm
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="15.0"
              step="0.5"
              value={filter.pixelate.blockSizeMm}
              onChange={(e) => {
                const blockSizeMm = parseFloat(e.target.value);
                onUpdateState(prev => ({
                  ...prev,
                  aestheticFilter: {
                    ...prev.aestheticFilter,
                    enabled: true,
                    type: 'pixelate',
                    pixelate: {
                      ...prev.aestheticFilter.pixelate,
                      blockSizeMm: isNaN(blockSizeMm) ? 4.0 : blockSizeMm,
                    },
                  },
                }));
              }}
            />
            <div className="flex justify-between text-[10px] text-sand-500 font-mono">
              <span>1.0 mm (Fine)</span>
              <span>15.0 mm (Chunky)</span>
            </div>
          </div>

          {/* Corner Style Segmented Control */}
          <div className="space-y-1">
            <span className="text-[11px] text-sand-300 font-medium block">Corner Geometry</span>
            <div className="flex rounded-md bg-[#0d140e] p-0.5 border border-sand-800">
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    aestheticFilter: {
                      ...prev.aestheticFilter,
                      enabled: true,
                      type: 'pixelate',
                      pixelate: {
                        ...prev.aestheticFilter.pixelate,
                        cornerStyle: 'orthogonal',
                      },
                    },
                  }));
                }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                  (filter.pixelate.cornerStyle ?? 'orthogonal') === 'orthogonal'
                    ? 'bg-emerald-700/80 text-white shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="90° Crisp: Strictly parallel and perpendicular cutlines with 90° sharp corners"
              >
                90° Crisp Cuts
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    aestheticFilter: {
                      ...prev.aestheticFilter,
                      enabled: true,
                      type: 'pixelate',
                      pixelate: {
                        ...prev.aestheticFilter.pixelate,
                        cornerStyle: 'rounded',
                      },
                    },
                  }));
                }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                  filter.pixelate.cornerStyle === 'rounded'
                    ? 'bg-emerald-700/80 text-white shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="Rounded / Soft: Filleted corners and organic rounded voxel edges"
              >
                Rounded / Soft
              </button>
            </div>
          </div>

          {/* Sampling Method & Grid Snap Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Sampling Mode Segmented Control */}
            <div className="space-y-1">
              <span className="text-[11px] text-sand-300 font-medium block">Sampling</span>
              <div className="flex rounded-md bg-[#0d140e] p-0.5 border border-sand-800">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState(prev => ({
                      ...prev,
                      aestheticFilter: {
                        ...prev.aestheticFilter,
                        enabled: true,
                        type: 'pixelate',
                        pixelate: {
                          ...prev.aestheticFilter.pixelate,
                          sampleMethod: 'mean',
                        },
                      },
                    }));
                  }}
                  className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                    filter.pixelate.sampleMethod === 'mean'
                      ? 'bg-emerald-700/80 text-white shadow-sm'
                      : 'text-sand-400 hover:text-sand-200'
                  }`}
                  title="Mean: Average luminance of cell for smooth tonal transitions"
                >
                  Mean
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState(prev => ({
                      ...prev,
                      aestheticFilter: {
                        ...prev.aestheticFilter,
                        enabled: true,
                        type: 'pixelate',
                        pixelate: {
                          ...prev.aestheticFilter.pixelate,
                          sampleMethod: 'median',
                        },
                      },
                    }));
                  }}
                  className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                    filter.pixelate.sampleMethod === 'median'
                      ? 'bg-emerald-700/80 text-white shadow-sm'
                      : 'text-sand-400 hover:text-sand-200'
                  }`}
                  title="Median: Median luminance of cell for high-contrast edges"
                >
                  Median
                </button>
              </div>
            </div>

            {/* Grid Snap Toggle */}
            <div className="space-y-1">
              <span className="text-[11px] text-sand-300 font-medium block">Alignment</span>
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    aestheticFilter: {
                      ...prev.aestheticFilter,
                      enabled: true,
                      type: 'pixelate',
                      pixelate: {
                        ...prev.aestheticFilter.pixelate,
                        gridSnap: !prev.aestheticFilter.pixelate.gridSnap,
                      },
                    },
                  }));
                }}
                className={`w-full py-1 px-2 text-[10px] font-medium rounded border transition flex items-center justify-center gap-1.5 ${
                  filter.pixelate.gridSnap
                    ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                    : 'bg-[#0d140e] border-sand-800 text-sand-400 hover:text-sand-200'
                }`}
                title="Grid Snap: Align block edges to whole pixel boundaries"
              >
                <Grid3X3 className="w-3 h-3" />
                <span>{filter.pixelate.gridSnap ? 'Grid Snapped' : 'Sub-pixel'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : isVoronoiActive ? (
        /* Low-Poly / Voronoi Facets Settings */
        <div className="p-3 bg-[#111a13]/80 rounded-lg border border-sand-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-sand-200 flex items-center gap-1.5">
              <Diamond className="w-3.5 h-3.5 text-emerald-400" /> Voronoi Facet Settings
            </span>
            <span className="text-[10px] text-emerald-400/90 font-mono">Polygonal Shards</span>
          </div>

          {/* Facet Count Density Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-sand-300 font-medium">Facet Density</label>
              <span className="font-mono text-emerald-400 font-medium">
                {filter.voronoi.facetCount} facets
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="500"
              step="10"
              value={filter.voronoi.facetCount}
              onChange={(e) => {
                const facetCount = parseInt(e.target.value) || 150;
                onUpdateState(prev => ({
                  ...prev,
                  aestheticFilter: {
                    ...prev.aestheticFilter,
                    enabled: true,
                    type: 'voronoi',
                    voronoi: {
                      ...prev.aestheticFilter.voronoi,
                      facetCount,
                    },
                  },
                }));
              }}
            />
            <div className="flex justify-between text-[10px] text-sand-500 font-mono">
              <span>30 (Coarse)</span>
              <span>500 (Fine Mesh)</span>
            </div>
          </div>

          {/* Jitter / Regularity Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-sand-300 font-medium">Jitter / Regularity</label>
              <span className="font-mono text-emerald-400 font-medium">
                {filter.voronoi.jitter}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={filter.voronoi.jitter}
              onChange={(e) => {
                const jitter = parseInt(e.target.value) || 0;
                onUpdateState(prev => ({
                  ...prev,
                  aestheticFilter: {
                    ...prev.aestheticFilter,
                    enabled: true,
                    type: 'voronoi',
                    voronoi: {
                      ...prev.aestheticFilter.voronoi,
                      jitter,
                    },
                  },
                }));
              }}
            />
            <div className="flex justify-between text-[10px] text-sand-500 font-mono">
              <span>0% (Hex Honeycomb)</span>
              <span>100% (Organic Shards)</span>
            </div>
          </div>

          {/* Corner Style Segmented Control */}
          <div className="space-y-1">
            <span className="text-[11px] text-sand-300 font-medium block">Cut Geometry</span>
            <div className="flex rounded-md bg-[#0d140e] p-0.5 border border-sand-800">
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    aestheticFilter: {
                      ...prev.aestheticFilter,
                      enabled: true,
                      type: 'voronoi',
                      voronoi: {
                        ...prev.aestheticFilter.voronoi,
                        cornerStyle: 'orthogonal',
                      },
                    },
                  }));
                }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                  (filter.voronoi.cornerStyle ?? 'orthogonal') === 'orthogonal'
                    ? 'bg-emerald-700/80 text-white shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="Straight Cuts: Crisp straight-line polygon edges without curve fitting"
              >
                Straight Cutlines
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateState(prev => ({
                    ...prev,
                    aestheticFilter: {
                      ...prev.aestheticFilter,
                      enabled: true,
                      type: 'voronoi',
                      voronoi: {
                        ...prev.aestheticFilter.voronoi,
                        cornerStyle: 'rounded',
                      },
                    },
                  }));
                }}
                className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                  filter.voronoi.cornerStyle === 'rounded'
                    ? 'bg-emerald-700/80 text-white shadow-sm'
                    : 'text-sand-400 hover:text-sand-200'
                }`}
                title="Rounded / Soft: Gently rounded facet corners"
              >
                Rounded / Soft
              </button>
            </div>
          </div>

          {/* Sampling Method & Seed Shuffle Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Sampling Mode Segmented Control */}
            <div className="space-y-1">
              <span className="text-[11px] text-sand-300 font-medium block">Sampling</span>
              <div className="flex rounded-md bg-[#0d140e] p-0.5 border border-sand-800">
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState(prev => ({
                      ...prev,
                      aestheticFilter: {
                        ...prev.aestheticFilter,
                        enabled: true,
                        type: 'voronoi',
                        voronoi: {
                          ...prev.aestheticFilter.voronoi,
                          sampleMethod: 'mean',
                        },
                      },
                    }));
                  }}
                  className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                    filter.voronoi.sampleMethod === 'mean'
                      ? 'bg-emerald-700/80 text-white shadow-sm'
                      : 'text-sand-400 hover:text-sand-200'
                  }`}
                  title="Mean: Average luminance across each polygon facet"
                >
                  Mean
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateState(prev => ({
                      ...prev,
                      aestheticFilter: {
                        ...prev.aestheticFilter,
                        enabled: true,
                        type: 'voronoi',
                        voronoi: {
                          ...prev.aestheticFilter.voronoi,
                          sampleMethod: 'median',
                        },
                      },
                    }));
                  }}
                  className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                    filter.voronoi.sampleMethod === 'median'
                      ? 'bg-emerald-700/80 text-white shadow-sm'
                      : 'text-sand-400 hover:text-sand-200'
                  }`}
                  title="Median: Median luminance for enhanced facet contrast"
                >
                  Median
                </button>
              </div>
            </div>

            {/* Shuffle Seed Button */}
            <div className="space-y-1">
              <span className="text-[11px] text-sand-300 font-medium block">Variation</span>
              <button
                type="button"
                onClick={handleShuffleVoronoiSeed}
                className="w-full py-1 px-2 text-[10px] font-medium rounded border border-sand-700 bg-sand-850 hover:bg-sand-800 text-sand-200 hover:text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                title="Shuffle Seed: Re-roll random facet shard distribution"
              >
                <Dices className="w-3.5 h-3.5 text-emerald-400" />
                <span>Shuffle</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Contour Smoothing Slider (When No Filter is Active) */
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="text-sand-200 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Contour Smoothing
            </label>
            <span className="font-mono text-emerald-400">{processing.smoothing} / 100</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={processing.smoothing}
            onChange={(e) => {
              const smoothing = parseInt(e.target.value) || 0;
              onUpdateState(prev => ({
                ...prev,
                processing: { ...prev.processing, smoothing },
              }));
            }}
          />
          <div className="text-[11px] text-sand-400/80 leading-tight">
            Reduces high-frequency noise and fillets organic paths.
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};
