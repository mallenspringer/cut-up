import React from 'react';
import { AppState, LayerMode } from '../../engine/types';
import { Sliders, ShieldAlert, Sparkles, Contrast } from 'lucide-react';

interface ProcessingPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

export const ProcessingPanel: React.FC<ProcessingPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { processing } = state;

  return (
    <div className="p-4 space-y-4 border-b border-slate-800">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-indigo-400" /> Processing Engine
      </h3>

      {/* Layer Mode Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs text-slate-300 font-medium">Stacking Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`btn btn-sm ${processing.mode === 'cumulative' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              onUpdateState(prev => ({
                ...prev,
                processing: { ...prev.processing, mode: 'cumulative' },
              }));
            }}
          >
            Cumulative Stack
          </button>
          <button
            className={`btn btn-sm ${processing.mode === 'exclusive' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              onUpdateState(prev => ({
                ...prev,
                processing: { ...prev.processing, mode: 'exclusive' },
              }));
            }}
          >
            Exclusive Band
          </button>
        </div>
      </div>

      {/* Polarity Switcher */}
      <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <Contrast className="w-4 h-4 text-slate-400" />
          Polarity Mode
        </div>
        <button
          className={`btn btn-sm ${processing.negative ? 'bg-amber-600 text-white' : 'btn-secondary'}`}
          onClick={() => {
            onUpdateState(prev => ({
              ...prev,
              processing: { ...prev.processing, negative: !prev.processing.negative },
            }));
          }}
        >
          {processing.negative ? 'Negative Mode' : 'Positive (Default)'}
        </button>
      </div>

      {/* Minimum Feature Size Clearance */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-slate-300 font-medium flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Physical Min Feature Clearance
          </label>
          <span className="font-mono text-indigo-300">{processing.minimumFeatureSize} mm</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={processing.minimumFeatureSize}
          onChange={(e) => {
            const minimumFeatureSize = parseFloat(e.target.value) || 1;
            onUpdateState(prev => ({
              ...prev,
              processing: { ...prev.processing, minimumFeatureSize },
            }));
          }}
        />
        <div className="text-[11px] text-slate-400">
          Removes islands, fills holes, & bridges gaps narrower than {processing.minimumFeatureSize} mm.
        </div>
      </div>

      {/* Smoothing Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="text-slate-300 font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Contour Smoothing
          </label>
          <span className="font-mono text-purple-300">{processing.smoothing} / 100</span>
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
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>0 (Crisp / Raw Details)</span>
          <span>100 (Max Cleanup & Curves)</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Wipes out high-frequency noise, speckles, & smooths organic contours.
        </div>
      </div>
    </div>
  );
};
