import React from 'react';
import { AppState } from '../../engine/types';
import { Move, Crop, RotateCcw } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';

interface ImageTransformPanelProps {
  state: AppState;
  onUpdateState: (updater: (prev: AppState) => AppState) => void;
  onResetTransform: () => void;
  defaultOpen?: boolean;
}

export const ImageTransformPanel: React.FC<ImageTransformPanelProps> = ({
  state,
  onUpdateState,
  onResetTransform,
  defaultOpen = true,
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
    <CollapsibleSection
      title="Image Transform"
      icon={<Move className="w-4 h-4" />}
      defaultOpen={defaultOpen}
      badge={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onResetTransform();
          }}
          className="text-[11px] text-sand-400 hover:text-sand-100 flex items-center gap-1 transition px-1.5 py-0.5 rounded hover:bg-sand-800/60"
          title="Reset position & scale"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      }
    >

      {/* Position & Scale Inputs */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-sand-400 mb-1">Position X (px)</label>
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
          <label className="block text-sand-400 mb-1">Position Y (px)</label>
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
          <label className="block text-sand-400 mb-1">Scale X</label>
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
          <label className="block text-sand-400 mb-1">Scale Y</label>
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
        <div className="col-span-2 flex items-center justify-between p-2 bg-moss-850/80 rounded border border-sand-800/70">
          <div className="flex items-center gap-2 text-sand-200 font-medium">
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
            className="w-4 h-4 accent-emerald-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Crop Rectangle Settings */}
      <div className="pt-2 border-t border-sand-800/70 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-sand-200 flex items-center gap-1.5">
            <Crop className="w-3.5 h-3.5 text-emerald-400" /> Image Crop Box
          </label>
          <button
            onClick={handleResetCrop}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 transition"
          >
            Reset Crop
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block text-sand-400 mb-1">Crop Off X</label>
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
            <label className="block text-sand-400 mb-1">Crop Off Y</label>
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
            <label className="block text-sand-400 mb-1">Crop Width</label>
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
            <label className="block text-sand-400 mb-1">Crop Height</label>
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

      <div className="p-2.5 bg-moss-850/80 rounded border border-sand-800/70 text-xs text-sand-400/80 space-y-1">
        <div className="font-medium text-sand-200">Canvas Interaction</div>
        <div>• Drag inside preview canvas to position</div>
        <div>• Shift + Drag allows non-proportional X/Y stretching</div>
        <div>• Ctrl + Mouse Wheel zooms canvas view</div>
      </div>
    </CollapsibleSection>
  );
};
