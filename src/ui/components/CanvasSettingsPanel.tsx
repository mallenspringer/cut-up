import React from 'react';
import { AppState, Unit } from '../../engine/types';
import { CANVAS_PRESETS } from '../../engine/layout/canvasLayout';
import { Layout, Maximize2, Target } from 'lucide-react';

interface CanvasSettingsPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

export const CanvasSettingsPanel: React.FC<CanvasSettingsPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { canvas, output } = state;

  return (
    <div className="p-4 space-y-4 border-b border-slate-800">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
        <Layout className="w-4 h-4 text-indigo-400" /> Physical Page
      </h3>

      {/* Preset Selector */}
      <div className="space-y-1">
        <label className="block text-xs text-slate-300 font-medium">Page Size Preset</label>
        <select
          className="w-full"
          value={
            CANVAS_PRESETS.findIndex(
              p => p.width === canvas.width && p.height === canvas.height && p.unit === canvas.unit
            )
          }
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            if (idx >= 0 && idx < CANVAS_PRESETS.length) {
              const preset = CANVAS_PRESETS[idx];
              onUpdateState(prev => ({
                ...prev,
                canvas: {
                  ...prev.canvas,
                  width: preset.width,
                  height: preset.height,
                  unit: preset.unit,
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
      </div>

      {/* Dimension & Unit Input */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Width</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.width}
            onChange={(e) => {
              const width = parseFloat(e.target.value) || 1;
              onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, width } }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Height</label>
          <input
            type="number"
            step="0.1"
            min="1"
            value={canvas.height}
            onChange={(e) => {
              const height = parseFloat(e.target.value) || 1;
              onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, height } }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Unit</label>
          <select
            value={canvas.unit}
            onChange={(e) => {
              const unit = e.target.value as Unit;
              onUpdateState(prev => ({ ...prev, canvas: { ...prev.canvas, unit } }));
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
          <label className="text-slate-300 font-medium">Page Margin</label>
          <span className="font-mono text-indigo-300">{canvas.margin} {canvas.unit}</span>
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

      {/* Registration Marks */}
      <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <Target className="w-4 h-4 text-slate-400" />
          Registration Marks
        </div>
        <input
          type="checkbox"
          checked={output.registrationMarks}
          onChange={(e) => {
            const registrationMarks = e.target.checked;
            onUpdateState(prev => ({ ...prev, output: { ...prev.output, registrationMarks } }));
          }}
          className="w-4 h-4 accent-indigo-500 cursor-pointer"
        />
      </div>
    </div>
  );
};
