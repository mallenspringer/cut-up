import React from 'react';
import { AppState } from '../../engine/types';
import { Move, Crop, RotateCcw } from 'lucide-react';

interface ImageTransformPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onResetTransform: () => void;
}

export const ImageTransformPanel: React.FC<ImageTransformPanelProps> = ({
  state,
  onUpdateState,
  onResetTransform,
}) => {
  const { workingImage, sourceImage } = state;
  const cropGeom = workingImage.crop.geometry;
  const naturalW = sourceImage?.width || 0;
  const naturalH = sourceImage?.height || 0;

  const handleResetCrop = () => {
    if (!sourceImage) return;
    onUpdateState(prev => ({
      ...prev,
      workingImage: {
        ...prev.workingImage,
        crop: {
          type: 'rectangle',
          geometry: { x: 0, y: 0, width: naturalW, height: naturalH },
        },
      },
    }));
  };

  return (
    <div className="p-4 space-y-4 border-b border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Move className="w-4 h-4 text-indigo-400" /> Image Transform
        </h3>
        <button
          onClick={onResetTransform}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
          title="Reset position & scale"
        >
          <RotateCcw className="w-3 h-3" /> Reset All
        </button>
      </div>

      {/* Position & Scale Inputs */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">Position X (px)</label>
          <input
            type="number"
            value={Math.round(workingImage.position.x)}
            onChange={(e) => {
              const x = parseFloat(e.target.value) || 0;
              onUpdateState(prev => ({
                ...prev,
                workingImage: {
                  ...prev.workingImage,
                  position: { ...prev.workingImage.position, x },
                },
              }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Position Y (px)</label>
          <input
            type="number"
            value={Math.round(workingImage.position.y)}
            onChange={(e) => {
              const y = parseFloat(e.target.value) || 0;
              onUpdateState(prev => ({
                ...prev,
                workingImage: {
                  ...prev.workingImage,
                  position: { ...prev.workingImage.position, y },
                },
              }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Scale X</label>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="10"
            value={Number(workingImage.scaleX.toFixed(2))}
            onChange={(e) => {
              const scaleX = parseFloat(e.target.value) || 1;
              const isLocked = workingImage.lockAspect !== false;
              onUpdateState(prev => ({
                ...prev,
                workingImage: {
                  ...prev.workingImage,
                  scaleX,
                  scaleY: isLocked ? scaleX : prev.workingImage.scaleY,
                },
              }));
            }}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Scale Y</label>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="10"
            value={Number(workingImage.scaleY.toFixed(2))}
            onChange={(e) => {
              const scaleY = parseFloat(e.target.value) || 1;
              const isLocked = workingImage.lockAspect !== false;
              onUpdateState(prev => ({
                ...prev,
                workingImage: {
                  ...prev.workingImage,
                  scaleY,
                  scaleX: isLocked ? scaleY : prev.workingImage.scaleX,
                },
              }));
            }}
            className="w-full"
          />
        </div>

        {/* Lock Aspect Ratio Toggle */}
        <div className="col-span-2 flex items-center justify-between p-2 bg-slate-900/60 rounded border border-slate-800">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            Lock Aspect Ratio
          </div>
          <input
            type="checkbox"
            checked={workingImage.lockAspect !== false}
            onChange={(e) => {
              const lockAspect = e.target.checked;
              onUpdateState(prev => ({
                ...prev,
                workingImage: {
                  ...prev.workingImage,
                  lockAspect,
                  scaleY: lockAspect ? prev.workingImage.scaleX : prev.workingImage.scaleY,
                },
              }));
            }}
            className="w-4 h-4 accent-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Crop Rectangle Settings */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-indigo-400" /> Image Crop Box
          </label>
          <button
            onClick={handleResetCrop}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition"
          >
            Reset Crop
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Crop Off X</label>
            <input
              type="number"
              min="0"
              max={naturalW}
              value={Math.round(cropGeom.x)}
              onChange={(e) => {
                const x = Math.max(0, parseFloat(e.target.value) || 0);
                onUpdateState(prev => ({
                  ...prev,
                  workingImage: {
                    ...prev.workingImage,
                    crop: {
                      ...prev.workingImage.crop,
                      geometry: { ...prev.workingImage.crop.geometry, x },
                    },
                  },
                }));
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Crop Off Y</label>
            <input
              type="number"
              min="0"
              max={naturalH}
              value={Math.round(cropGeom.y)}
              onChange={(e) => {
                const y = Math.max(0, parseFloat(e.target.value) || 0);
                onUpdateState(prev => ({
                  ...prev,
                  workingImage: {
                    ...prev.workingImage,
                    crop: {
                      ...prev.workingImage.crop,
                      geometry: { ...prev.workingImage.crop.geometry, y },
                    },
                  },
                }));
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Crop Width</label>
            <input
              type="number"
              min="1"
              max={naturalW}
              value={Math.round(cropGeom.width || naturalW)}
              onChange={(e) => {
                const width = Math.max(1, parseFloat(e.target.value) || 1);
                onUpdateState(prev => ({
                  ...prev,
                  workingImage: {
                    ...prev.workingImage,
                    crop: {
                      ...prev.workingImage.crop,
                      geometry: { ...prev.workingImage.crop.geometry, width },
                    },
                  },
                }));
              }}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Crop Height</label>
            <input
              type="number"
              min="1"
              max={naturalH}
              value={Math.round(cropGeom.height || naturalH)}
              onChange={(e) => {
                const height = Math.max(1, parseFloat(e.target.value) || 1);
                onUpdateState(prev => ({
                  ...prev,
                  workingImage: {
                    ...prev.workingImage,
                    crop: {
                      ...prev.workingImage.crop,
                      geometry: { ...prev.workingImage.crop.geometry, height },
                    },
                  },
                }));
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800 text-xs text-slate-400 space-y-1">
        <div className="font-medium text-slate-300">Canvas Interaction</div>
        <div>• Drag inside preview canvas to position</div>
        <div>• Shift + Drag allows non-proportional X/Y stretching</div>
        <div>• Ctrl + Mouse Wheel zooms canvas view</div>
      </div>
    </div>
  );
};
