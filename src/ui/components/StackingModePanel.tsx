import React from 'react';
import { AppState } from '../../engine/types';
import { Layers, Contrast } from 'lucide-react';

interface StackingModePanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
}

export const StackingModePanel: React.FC<StackingModePanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { processing } = state;

  return (
    <div className="p-4 space-y-4 border-b border-sand-800/70">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-sand-300 flex items-center gap-2">
        <Layers className="w-4 h-4 text-emerald-400" /> Stacking & Polarity
      </h3>

      {/* Layer Mode Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs text-sand-200 font-medium">Stacking Mode</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`btn btn-sm ${processing.mode === 'cumulative' ? 'btn-primary' : 'btn-secondary text-sand-200'}`}
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
            className={`btn btn-sm ${processing.mode === 'exclusive' ? 'btn-primary' : 'btn-secondary text-sand-200'}`}
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
      <div className="flex items-center justify-between p-2.5 bg-moss-850/80 rounded border border-sand-800/70">
        <div className="flex items-center gap-2 text-xs font-medium text-sand-200">
          <Contrast className="w-4 h-4 text-sand-400" />
          Polarity Mode
        </div>
        <button
          className={`btn btn-sm ${processing.negative ? 'bg-amber-600 text-white' : 'btn-secondary text-sand-200'}`}
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
    </div>
  );
};
