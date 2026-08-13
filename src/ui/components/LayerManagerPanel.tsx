import React from 'react';
import { AppState, LayerState } from '../../engine/types';
import { Layers, Plus, Trash2, Wand2 } from 'lucide-react';
import { generateAutoThresholds, DEFAULT_LAYER_COLORS, enforceMonotonicThresholds } from '../../engine/layers/layerGenerator';

interface LayerManagerPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { layers } = state;
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  const handleAddLayer = () => {
    if (layers.length >= 10) return;
    const newCount = layers.length + 1;
    const autoThresholds = generateAutoThresholds(newCount);

    const newLayers: LayerState[] = autoThresholds.map((t, idx) => {
      if (idx < sortedLayers.length) {
        // Preserve existing layer ID and custom settings
        return {
          ...sortedLayers[idx],
          order: idx,
          threshold: t,
        };
      } else {
        // Newly added layer gets next color from default palette
        return {
          id: `layer-${Date.now()}`,
          threshold: t,
          color: DEFAULT_LAYER_COLORS[idx % DEFAULT_LAYER_COLORS.length],
          order: idx,
          isSolidBacking: false,
        };
      }
    });

    onUpdateState(prev => ({ ...prev, layers: newLayers }));
  };

  const handleRemoveLayer = (id: string) => {
    if (layers.length <= 1) return;
    const filtered = sortedLayers
      .filter(l => l.id !== id)
      .map((l, idx) => ({ ...l, order: idx }));
    const rebalanced = enforceMonotonicThresholds(filtered);
    onUpdateState(prev => ({ ...prev, layers: rebalanced }));
  };

  const handleAutoDistribute = () => {
    const autoThresholds = generateAutoThresholds(layers.length);
    const updated = sortedLayers.map((layer, idx) => ({
      ...layer,
      threshold: autoThresholds[idx],
    }));
    onUpdateState(prev => ({ ...prev, layers: updated }));
  };

  // Toggle Solid Backing ON/OFF for Layer 1 (auto-generates Layer 2 if turning ON with 1 layer)
  const handleToggleSolid = (newSolidState: boolean) => {
    if (newSolidState && layers.length === 1) {
      // Auto-generate Layer 2 when turning Solid ON on a 1-layer stack
      const newCount = 2;
      const autoThresholds = generateAutoThresholds(newCount);
      const newLayers: LayerState[] = [
        {
          ...sortedLayers[0],
          threshold: autoThresholds[0],
          isSolidBacking: true,
        },
        {
          id: `layer-${Date.now()}`,
          threshold: autoThresholds[1],
          color: DEFAULT_LAYER_COLORS[1 % DEFAULT_LAYER_COLORS.length],
          order: 1,
          isSolidBacking: false,
        },
      ];
      onUpdateState(prev => ({ ...prev, layers: newLayers }));
    } else {
      onUpdateState(prev => ({
        ...prev,
        layers: prev.layers.map(l => l.id === sortedLayers[0].id ? { ...l, isSolidBacking: newSolidState } : l),
      }));
    }
  };

  return (
    <div className="p-4 space-y-4 border-b border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" /> Layer Stack ({layers.length})
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoDistribute}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
            title="Auto distribute thresholds evenly"
          >
            <Wand2 className="w-3 h-3" /> Auto
          </button>
          <button
            onClick={handleAddLayer}
            className="btn btn-sm btn-secondary"
            title="Add new layer"
          >
            <Plus className="w-3.5 h-3.5" /> Layer
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {/* Render Top Layer (highest order) down to Bottom Layer (Layer 1) */}
        {[...sortedLayers].reverse().map((layer, reverseIdx) => {
          const actualIndex = sortedLayers.length - 1 - reverseIdx;
          const isLayer1 = actualIndex === 0;
          const isSelected = state.selectedLayerId === layer.id || (!state.selectedLayerId && isLayer1);
          const isSolid = layer.isSolidBacking === true;

          // Streamlined Layer 1 Card (Compact 2x Height)
          if (isLayer1) {
            const minThresh = layer.minThreshold !== undefined ? layer.minThreshold : 0;

            return (
              <div
                key={layer.id}
                onClick={() => {
                  onUpdateState(prev => ({ ...prev, selectedLayerId: layer.id }));
                }}
                className={`p-2.5 rounded border space-y-2 text-xs cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500/80 ring-2 ring-indigo-500/80 shadow-md'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Row: Color, Layer Name, Solid Toggle Switch, Trash */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={layer.color}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const color = e.target.value;
                        onUpdateState(prev => ({
                          ...prev,
                          layers: prev.layers.map(l => l.id === layer.id ? { ...l, color } : l),
                        }));
                      }}
                      className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
                      title="Assign Layer 1 paper color"
                    />
                    <div className="font-medium text-slate-200 flex items-center gap-1.5">
                      Layer 1
                      {isSelected && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {/* Modern Custom Toggle Switch */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                      <span>Solid</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isSolid}
                        onClick={() => handleToggleSolid(!isSolid)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isSolid ? 'bg-indigo-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isSolid ? 'translate-x-3' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLayer(layer.id);
                      }}
                      disabled={layers.length <= 1}
                      className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none p-1 transition"
                      title="Remove layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Compact Slider Controls */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800/60" onClick={(e) => e.stopPropagation()}>
                  {!isSolid ? (
                    <>
                      {/* Min Threshold */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-mono w-16 shrink-0">Min: {minThresh}</span>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(0, layer.threshold - 1)}
                          value={minThresh}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateState(prev => ({
                              ...prev,
                              layers: prev.layers.map(l => l.id === layer.id ? { ...l, minThreshold: val } : l),
                            }));
                          }}
                          className="flex-1"
                        />
                      </div>

                      {/* Max Threshold */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400 font-mono w-16 shrink-0">Max: {layer.threshold}</span>
                        <input
                          type="range"
                          min={minThresh + 1}
                          max="254"
                          value={layer.threshold}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || (minThresh + 1);
                            const updated = layers.map(l => l.id === layer.id ? { ...l, threshold: val } : l);
                            const validLayers = enforceMonotonicThresholds(updated);
                            onUpdateState(prev => ({ ...prev, layers: validLayers }));
                          }}
                          className="flex-1"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-mono w-16 shrink-0">Max: {layer.threshold}</span>
                      <input
                        type="range"
                        min="1"
                        max="254"
                        value={layer.threshold}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 128;
                          const updated = layers.map(l => l.id === layer.id ? { ...l, threshold: val } : l);
                          const validLayers = enforceMonotonicThresholds(updated);
                          onUpdateState(prev => ({ ...prev, layers: validLayers }));
                        }}
                        className="flex-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Standard Layer Card (Layers 2 to N)
          return (
            <div
              key={layer.id}
              onClick={() => {
                onUpdateState(prev => ({ ...prev, selectedLayerId: layer.id }));
              }}
              className={`p-2.5 rounded border flex items-center justify-between gap-3 text-xs cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-indigo-950/60 border-indigo-500/80 ring-2 ring-indigo-500/80 shadow-md shadow-indigo-500/10'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={layer.color}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const color = e.target.value;
                    onUpdateState(prev => ({
                      ...prev,
                      layers: prev.layers.map(l => l.id === layer.id ? { ...l, color } : l),
                    }));
                  }}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
                  title="Assign layer paper color"
                />
                <div>
                  <div className="font-medium text-slate-200 flex items-center gap-1.5">
                    Layer {actualIndex + 1}
                    {isSelected && (
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Luminance: {actualIndex > 0 ? sortedLayers[actualIndex - 1].threshold + 1 : 0} → {layer.threshold}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-[140px]" onClick={(e) => e.stopPropagation()}>
                <input
                  type="range"
                  min="1"
                  max={actualIndex === sortedLayers.length - 1 ? "255" : "254"}
                  value={layer.threshold}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 128;
                    const updated = layers.map(l => l.id === layer.id ? { ...l, threshold: val } : l);
                    const validLayers = enforceMonotonicThresholds(updated);
                    onUpdateState(prev => ({ ...prev, layers: validLayers }));
                  }}
                />
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveLayer(layer.id);
                }}
                disabled={layers.length <= 1}
                className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none p-1 transition"
                title="Remove layer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
