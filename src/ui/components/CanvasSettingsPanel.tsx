import React from 'react';
import { AppState, Unit } from '../../engine/types';
import { CANVAS_PRESETS, convertToInches, convertFromInches } from '../../engine/layout/canvasLayout';
import { Layout, Smartphone, Monitor } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface CanvasSettingsPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  defaultOpen?: boolean;
}

export const CanvasSettingsPanel: React.FC<CanvasSettingsPanelProps> = ({
  state,
  onUpdateState,
  defaultOpen = true,
}) => {
  const { canvas } = state;

  const currentPresetIdx = CANVAS_PRESETS.findIndex(p => {
    const minD = Math.min(p.width, p.height);
    const maxD = Math.max(p.width, p.height);
    const cMinD = Math.min(canvas.width, canvas.height);
    const cMaxD = Math.max(canvas.width, canvas.height);
    return Math.abs(minD - cMinD) < 0.01 && Math.abs(maxD - cMaxD) < 0.01 && p.unit === canvas.unit;
  });

  const handleOrientationChange = (newOrientation: 'portrait' | 'landscape') => {
    if (newOrientation === canvas.orientation) return;
    const isLandscape = newOrientation === 'landscape';
    const newW = isLandscape ? Math.max(canvas.width, canvas.height) : Math.min(canvas.width, canvas.height);
    const newH = isLandscape ? Math.min(canvas.width, canvas.height) : Math.max(canvas.width, canvas.height);
    onUpdateState(prev => ({
      ...prev,
      canvas: {
        ...prev.canvas,
        width: newW,
        height: newH,
        orientation: newOrientation,
      },
    }));
  };

  return (
    <CollapsibleSection
      title="Page Layout"
      icon={<Layout className="w-4 h-4" />}
      defaultOpen={defaultOpen}
    >

      {/* Preset Selector & Orientation Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-sand-200 font-medium">Page Size Preset</label>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="flex-1 text-xs"
            value={currentPresetIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value);
              if (idx >= 0 && idx < CANVAS_PRESETS.length) {
                const preset = CANVAS_PRESETS[idx];
                const isLandscape = canvas.orientation === 'landscape';
                const w = isLandscape ? Math.max(preset.width, preset.height) : Math.min(preset.width, preset.height);
                const h = isLandscape ? Math.min(preset.width, preset.height) : Math.max(preset.width, preset.height);

                // Convert margin to new preset unit seamlessly
                let convertedMargin = canvas.margin;
                if (canvas.unit !== preset.unit) {
                  const marginInches = convertToInches(canvas.margin, canvas.unit);
                  convertedMargin = convertFromInches(marginInches, preset.unit);
                  convertedMargin = Math.round(convertedMargin * 100) / 100;
                }

                onUpdateState(prev => ({
                  ...prev,
                  canvas: {
                    ...prev.canvas,
                    width: w,
                    height: h,
                    unit: preset.unit,
                    margin: convertedMargin,
                  },
                }));
              }
            }}
          >
            {CANVAS_PRESETS.map((p, idx) => (
              <option key={idx} value={idx}>
                {p.name}
              </option>
            ))}
            <option value="-1">Custom Dimensions</option>
          </select>

          {/* Orientation Toggle Buttons */}
          <div className="flex items-center bg-moss-900 border border-sand-800/80 rounded p-0.5 shrink-0">
            <button
              onClick={() => handleOrientationChange('portrait')}
              className={`p-1.5 rounded transition ${
                canvas.orientation === 'portrait'
                  ? 'bg-emerald-700 text-white shadow border border-emerald-600/40'
                  : 'text-sand-400 hover:text-sand-200'
              }`}
              title="Portrait Orientation"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleOrientationChange('landscape')}
              className={`p-1.5 rounded transition ${
                canvas.orientation === 'landscape'
                  ? 'bg-emerald-700 text-white shadow border border-emerald-600/40'
                  : 'text-sand-400 hover:text-sand-200'
              }`}
              title="Landscape Orientation"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dimension & Unit Input */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <label className="block text-sand-400 mb-1">Width</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.width}
            onChange={(e) => {
              const width = parseFloat(e.target.value) || 1;
              const orientation = width > canvas.height ? 'landscape' : 'portrait';
              onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, width, orientation } }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sand-400 mb-1">Height</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.height}
            onChange={(e) => {
              const height = parseFloat(e.target.value) || 1;
              const orientation = canvas.width > height ? 'landscape' : 'portrait';
              onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, height, orientation } }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sand-400 mb-1">Unit</label>
          <select
            value={canvas.unit}
            onChange={(e) => {
              const newUnit = e.target.value as Unit;
              if (newUnit !== canvas.unit) {
                const wInches = convertToInches(canvas.width, canvas.unit);
                const hInches = convertToInches(canvas.height, canvas.unit);
                const marginInches = convertToInches(canvas.margin, canvas.unit);

                onUpdateState(prev => ({
                  ...prev,
                  canvas: {
                    ...prev.canvas,
                    width: Math.round(convertFromInches(wInches, newUnit) * 100) / 100,
                    height: Math.round(convertFromInches(hInches, newUnit) * 100) / 100,
                    margin: Math.round(convertFromInches(marginInches, newUnit) * 100) / 100,
                    unit: newUnit,
                  },
                }));
              }
            }}
            className="w-full"
          >
            <option value="in">in</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>

      {/* Margins */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <label className="text-sand-200 font-medium">Page Margin</label>
          <span className="font-mono text-emerald-400">{canvas.margin} {canvas.unit}</span>
        </div>
        <input
          type="number"
          step="0.05"
          min="0"
          value={canvas.margin}
          onChange={(e) => {
            const margin = parseFloat(e.target.value) || 0;
            onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, margin } }));
          }}
          className="w-full"
        />
      </div>
    </CollapsibleSection>
  );
};
