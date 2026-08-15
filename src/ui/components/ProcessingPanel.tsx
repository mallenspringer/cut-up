import React from 'react';
import { AppState } from '../../engine/types';
import { ShieldAlert, Sparkles, Sliders } from 'lucide-react';

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
    <div className="p-4 space-y-4 border-b border-sand-800/70">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-sand-300 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-emerald-400" /> Smoothing
      </h3>

      {/* Minimum Feature Size Clearance */}
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
        <div className="text-[11px] text-sand-400/80">
          {processing.minimumFeatureSize === 0
            ? 'Clearance filter disabled. 100% raw detail preserved (Ideal for high-res print or fine laser detail).'
            : `Removes islands, fills holes, & bridges gaps narrower than ${processing.minimumFeatureSize.toFixed(1)} mm.`}
        </div>
      </div>

      {/* Smoothing Slider */}
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
        <div className="flex justify-between text-[10px] text-sand-500 font-mono">
          <span>0 (Crisp / Raw Details)</span>
          <span>100 (Max Cleanup & Curves)</span>
        </div>
        <div className="text-[11px] text-sand-400/80">
          Wipes out high-frequency noise, speckles, & smooths organic contours.
        </div>
      </div>
    </div>
  );
};
