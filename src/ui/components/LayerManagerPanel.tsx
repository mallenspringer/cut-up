import React from 'react';
import { AppState, LayerState } from '../../engine/types';
import { Layers, Plus, Trash2, Wand2 } from 'lucide-react';
import { generateAutoThresholds, DEFAULT_LAYER_COLORS, enforceMonotonicThresholds, updateLayerThreshold } from '../../engine/layers/layerGenerator';
import { CollapsibleSection } from './CollapsibleSection';

interface LayerManagerPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  defaultOpen?: boolean;
}

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  state,
  onUpdateState,
  defaultOpen = true,
}) => {
  const { layers } = state;
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  const handleAddLayer = () => {
    if (layers.length >= 11) return; // 11 layers total: Layer 0 + 10 cut layers
    const newCount = layers.length + 1;
    const autoThresholds = generateAutoThresholds(newCount);

    const newLayers: LayerState[] = autoThresholds.map((t, idx) => {
      if (idx < sortedLayers.length) {
        // Preserve existing layer settings
        return {
          ...sortedLayers[idx],
          order: idx,
          threshold: t,
        };
      } else {
        // Newly added layer gets next color from desaturated ROYGBIV palette (idx - 1 for cut layers)
        const cutIdx = idx - 1;
        return {
          id: `layer-${Date.now()}`,
          threshold: t,
          color: DEFAULT_LAYER_COLORS[cutIdx % DEFAULT_LAYER_COLORS.length],
          order: idx,
          isSolidBacking: false,
        };
      }
    });

    onUpdateState(prev => ({ ...prev, layers: newLayers }));
  };

  const handleRemoveLayer = (id: string) => {
    // Layer 0 is foundation and cannot be removed; keep at least Layer 0 + Layer 1
    if (id === sortedLayers[0]?.id || layers.length <= 2) return;
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
    const rebalanced = enforceMonotonicThresholds(updated);
    onUpdateState(prev => ({ ...prev, layers: rebalanced }));
  };

  // Toggle Solid Backing vs Void on Layer 0
  const handleToggleSolid = (newSolidState: boolean) => {
    onUpdateState(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === sortedLayers[0].id ? { ...l, isSolidBacking: newSolidState } : l),
    }));
  };

  return (
    <CollapsibleSection
      title={`Layers (${layers.length}/11)`}
      icon={<Layers className="w-4 h-4" />}
      defaultOpen={defaultOpen}
      badge={
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleAutoDistribute}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-sand-800/60 transition"
            title="Auto distribute cut thresholds evenly"
          >
            <Wand2 className="w-3 h-3" /> Auto
          </button>
          <button
            type="button"
            onClick={handleAddLayer}
            disabled={layers.length >= 11}
            className="text-[11px] bg-sand-800/80 hover:bg-sand-700 text-sand-200 px-1.5 py-0.5 rounded border border-sand-700/60 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition"
            title="Add new cut layer (up to 10 cut layers + Layer 0 base)"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
      }
    >
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {/* Render Top Layer (highest order) down to Bottom Layer (Layer 0) */}
        {[...sortedLayers].reverse().map((layer, reverseIdx) => {
          const actualIndex = sortedLayers.length - 1 - reverseIdx;
          const isLayer0 = actualIndex === 0;
          const isSelected = state.selectedLayerId === layer.id || (!state.selectedLayerId && isLayer0);
          const isSolid = layer.isSolidBacking !== false;

          // Streamlined Layer 0 Card (Solid Base Sheet / Void Foundation)
          if (isLayer0) {
            const layer1Threshold = sortedLayers[1]?.threshold ?? 0;
            return (
              <div
                key={layer.id}
                onClick={() => {
                  onUpdateState(prev => ({ ...prev, selectedLayerId: layer.id }));
                }}
                className={`p-2.5 rounded border flex items-center justify-between gap-3 text-xs cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'bg-moss-800/90 border-emerald-500/80 ring-2 ring-emerald-500/60 shadow-md shadow-emerald-950/40'
                    : 'bg-moss-850 border-sand-800/70 hover:border-sand-700/80'
                }`}
              >
                {/* Left: Color Swatch + Name (Compact static width for maximum slider room) */}
                <div className="flex items-center gap-2 w-[125px] shrink-0">
                  <input
                    type="color"
                    value={layer.color}
                    disabled={!isSolid}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const color = e.target.value;
                      onUpdateState(prev => ({
                        ...prev,
                        layers: prev.layers.map(l => l.id === layer.id ? { ...l, color } : l),
                      }));
                    }}
                    className={`w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0 ${
                      !isSolid ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title={isSolid ? "Assign Layer 0 solid backing color" : "Void mode (transparent)"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sand-100 truncate">
                      Layer 0 <span className="text-[10px] text-sand-400 font-normal">(Base)</span>
                    </div>
                    <div className="text-[10px] text-sand-400 font-mono truncate">
                      Paper: 0 → {layer1Threshold}
                    </div>
                  </div>
                </div>

                {/* Right: Solid / Void Switch + Locked Delete */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleToggleSolid(!isSolid)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                      isSolid
                        ? 'bg-emerald-700/80 text-white border-emerald-600/60 shadow-sm'
                        : 'bg-moss-900 text-sand-400 border-sand-800 hover:text-sand-200'
                    }`}
                    title={isSolid ? "Solid paper backing sheet (Default)" : "Void (Transparent empty space behind stack)"}
                  >
                    {isSolid ? 'Solid' : 'Void'}
                  </button>

                  <button
                    disabled={true}
                    className="text-sand-600 opacity-20 cursor-not-allowed p-1"
                    title="Layer 0 is the base foundation and cannot be deleted"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          // Standard Cut Layer Card (Layer 1 to Layer 10)
          const isTop = actualIndex === sortedLayers.length - 1;
          const paperMax = isTop ? 255 : sortedLayers[actualIndex + 1].threshold;
          const paperRange = `${layer.threshold + 1} → ${paperMax}`;

          return (
            <div
              key={layer.id}
              onClick={() => {
                onUpdateState(prev => ({ ...prev, selectedLayerId: layer.id }));
              }}
              className={`p-2.5 rounded border flex items-center justify-between gap-3 text-xs cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'bg-moss-800/90 border-emerald-500/80 ring-2 ring-emerald-500/60 shadow-md shadow-emerald-950/40'
                  : 'bg-moss-850 border-sand-800/70 hover:border-sand-700/80'
              }`}
            >
              {/* Left: Color Swatch + Name (Compact static width for maximum slider room) */}
              <div className="flex items-center gap-2 w-[125px] shrink-0">
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
                  title={`Assign Layer ${actualIndex} paper color`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sand-100 truncate">
                    Layer {actualIndex}
                    {isTop && (
                      <span className="text-[10px] text-amber-300/80 font-normal ml-1">(Top)</span>
                    )}
                  </div>
                  <div className="text-[10px] text-sand-400 font-mono truncate">
                    Paper: {paperRange}
                  </div>
                </div>
              </div>

              {/* Center Slider: Extended wide track */}
              <div className="flex items-center gap-2 flex-1 px-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="range"
                  min="0"
                  max="254"
                  value={layer.threshold}
                  className="w-full cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    onUpdateState(prev => ({
                      ...prev,
                      layers: updateLayerThreshold(prev.layers, layer.id, val),
                    }));
                  }}
                  title={`Layer ${actualIndex} Cut Threshold: ≤ ${layer.threshold}`}
                />
              </div>

              {/* Right: Delete Action */}
              <div className="shrink-0 flex items-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveLayer(layer.id);
                  }}
                  disabled={layers.length <= 2}
                  className="text-sand-500 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none p-1 transition"
                  title="Remove layer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
};
