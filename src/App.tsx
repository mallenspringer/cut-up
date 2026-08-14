import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import { AppState, PreviewTab, WorkingImageState, LayerState } from './engine/types';
import { createDefaultLayers } from './engine/layers/layerGenerator';
import { createInitialHistory, pushHistorySnapshot, undoHistory, redoHistory } from './state/history';
import { resampleWorkingImage } from './engine/working/transform';
import { computeLuminance, extractAlpha } from './engine/luminance/luminance';
import { filterBinaryMaskCanvas } from './engine/manufacturing/canvasFilter';
import { generateLayerMask } from './engine/layers/layerGenerator';
import { traceBinaryMaskToSVG, calculateTurdSize, calculateAlphaMax, calculateOptTolerance } from './engine/vector/potraceEngine';
import { convertToPixels, getPrintableArea } from './engine/layout/canvasLayout';
import { extractImageDataFromImage, createSourceImageFromData } from './engine/source/sourceImage';

import { CanvasViewport } from './ui/components/CanvasViewport';
import { ImageTransformPanel } from './ui/components/ImageTransformPanel';
import { ProcessingPanel } from './ui/components/ProcessingPanel';
import { CanvasSettingsPanel } from './ui/components/CanvasSettingsPanel';
import { LayerManagerPanel } from './ui/components/LayerManagerPanel';
import { StackingModePanel } from './ui/components/StackingModePanel';
import { ExportPanel } from './ui/components/ExportPanel';

import { Scissors, Upload, Undo2, Redo2 } from 'lucide-react';

const DEFAULT_WORKING_IMAGE: WorkingImageState = {
  crop: {
    type: 'rectangle',
    geometry: { x: 0, y: 0, width: 0, height: 0 },
  },
  position: { x: 0, y: 0 },
  scaleX: 1.0,
  scaleY: 1.0,
  rasterScaleMethod: 'nearest',
};

function calculateInitialFitScale(
  imgW: number,
  imgH: number,
  canvas: AppState['canvas']
): number {
  const { widthPx, heightPx, printableWidthPx, printableHeightPx } = getPrintableArea(canvas);
  if (!imgW || !imgH) return 1.0;

  const baseScale = Math.min(widthPx / imgW, heightPx / imgH);
  const baseDisplayW = imgW * baseScale;
  const baseDisplayH = imgH * baseScale;

  const fitScaleX = printableWidthPx / baseDisplayW;
  const fitScaleY = printableHeightPx / baseDisplayH;

  return Math.min(fitScaleX, fitScaleY);
}

const DEFAULT_APP_STATE: AppState = {
  sourceImage: null,
  workingImage: DEFAULT_WORKING_IMAGE,
  canvas: {
    width: 8.5,
    height: 11,
    unit: 'in',
    margin: 0.25,
    orientation: 'portrait',
  },
  processing: {
    mode: 'cumulative',
    negative: false,
    minimumFeatureSize: 2.0, // 2mm
    smoothing: 0,
  },
  layers: createDefaultLayers(2),
  output: {
    registrationMarks: false,
    exportMode: 'combined',
  },
};

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(DEFAULT_APP_STATE);
  const [history, setHistory] = useState(() => createInitialHistory(DEFAULT_WORKING_IMAGE));
  const [activeTab, setActiveTab] = useState<PreviewTab>('composite');

  const loadSamplePattern = () => {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 400;
    sampleCanvas.height = 400;
    const ctx = sampleCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(200, 200, 20, 200, 200, 180);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, '#a855f7');
      grad.addColorStop(0.6, '#3b82f6');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 400, 400);

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(200, 200, 60, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(160, 160, 80, 80);

      const dataUrl = sampleCanvas.toDataURL();
      const imgData = ctx.getImageData(0, 0, 400, 400);

      const sampleSource = createSourceImageFromData(
        'sample-pattern.png',
        400,
        400,
        dataUrl,
        imgData
      );

      const newWorkingImage: WorkingImageState = {
        ...DEFAULT_WORKING_IMAGE,
        position: { x: 0, y: 0 },
        scaleX: 1.0,
        scaleY: 1.0,
        lockAspect: true,
        crop: { type: 'rectangle', geometry: { x: 0, y: 0, width: 400, height: 400 } },
      };

      setState(prev => ({
        ...prev,
        sourceImage: sampleSource,
        workingImage: newWorkingImage,
      }));
      setHistory(createInitialHistory(newWorkingImage));
      setActiveTab('source');
    }
  };

  // Handle Image File Upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WebP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const imgData = extractImageDataFromImage(img);
        const source = createSourceImageFromData(
          file.name,
          img.naturalWidth,
          img.naturalHeight,
          dataUrl,
          imgData
        );

        const newWorkingImage: WorkingImageState = {
          ...DEFAULT_WORKING_IMAGE,
          position: { x: 0, y: 0 },
          scaleX: 1.0,
          scaleY: 1.0,
          lockAspect: true,
          crop: {
            type: 'rectangle',
            geometry: { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
          },
        };

        setState(prev => ({
          ...prev,
          sourceImage: source,
          workingImage: newWorkingImage,
        }));

        setHistory(createInitialHistory(newWorkingImage));
        setActiveTab('source');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // State update wrapper with composition history snapshotting
  const updateState = (updater: (prev: AppState) => AppState, snapshotComposition: boolean = false) => {
    setState(prev => {
      const next = updater(prev);
      if (snapshotComposition && next.workingImage !== prev.workingImage) {
        setHistory(h => pushHistorySnapshot(h, next.workingImage));
      }
      return next;
    });
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    const { history: newHistory, snapshot } = undoHistory(history);
    if (snapshot) {
      setHistory(newHistory);
      setState(prev => ({ ...prev, workingImage: snapshot.workingImage }));
    }
  };

  const handleRedo = () => {
    const { history: newHistory, snapshot } = redoHistory(history);
    if (snapshot) {
      setHistory(newHistory);
      setState(prev => ({ ...prev, workingImage: snapshot.workingImage }));
    }
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  const deferredState = useDeferredValue(state);

  // Derived Processing Pipeline Computation via Potrace Vector Tracing Engine
  const { layerPathDataMap, binaryMaskData, processingResolution } = useMemo(() => {
    if (!deferredState.sourceImage || activeTab === 'source') {
      return {
        layerPathDataMap: new Map<string, string>(),
        binaryMaskData: null,
        processingResolution: { width: 400, height: 518 },
      };
    }

    const { widthPx, heightPx, printableWidthPx, printableHeightPx } = getPrintableArea(deferredState.canvas);
    const maxDim = 800;
    const canvasAspect = widthPx / Math.max(1, heightPx);
    let targetW = maxDim;
    let targetH = Math.round(maxDim / canvasAspect);
    if (targetH > maxDim) {
      targetH = maxDim;
      targetW = Math.round(maxDim * canvasAspect);
    }

    // 1. Nearest-neighbor resample scaled into full canvas processing buffer
    const resampled = resampleWorkingImage(
      deferredState.sourceImage,
      deferredState.workingImage,
      targetW,
      targetH,
      widthPx,
      heightPx,
      printableWidthPx,
      printableHeightPx
    );

    // 2. Grayscale luminance conversion & alpha extraction
    const luminance = computeLuminance(resampled);
    const alpha = extractAlpha(resampled);

    // 3. Pixel density (px/mm)
    const canvasWidthMm = deferredState.canvas.unit === 'mm'
      ? deferredState.canvas.width
      : deferredState.canvas.unit === 'cm'
        ? deferredState.canvas.width * 10
        : deferredState.canvas.width * 25.4;
    const pxPerMm = targetW / Math.max(1, canvasWidthMm);

    // 4. Potrace vector parameters
    const turdSize = calculateTurdSize(deferredState.processing.minimumFeatureSize, pxPerMm);
    const alphaMax = calculateAlphaMax(deferredState.processing.smoothing);
    const optTolerance = calculateOptTolerance(deferredState.processing.smoothing);

    const pathMap = new Map<string, string>();
    let selectedLayerImageData: ImageData | null = null;
    const activeLayerId = deferredState.selectedLayerId || (deferredState.layers[1] ? deferredState.layers[1].id : deferredState.layers[0]?.id);

    deferredState.layers.forEach((layer: LayerState, idx: number) => {
      // Binary mask thresholding
      const rawMask = generateLayerMask(
        luminance,
        targetW,
        targetH,
        idx,
        deferredState.layers,
        deferredState.processing.mode,
        deferredState.processing.negative,
        alpha
      );

      // Canvas 2D pre-filter for boundary smoothing & gap bridging
      const cleanMask = filterBinaryMaskCanvas(
        rawMask,
        deferredState.processing.minimumFeatureSize,
        pxPerMm,
        deferredState.processing.smoothing
      );

      if (layer.id === activeLayerId) {
        const imgData = new ImageData(targetW, targetH);
        for (let i = 0; i < cleanMask.data.length; i++) {
          const val = cleanMask.data[i] === 1 ? 255 : 0;
          imgData.data[i * 4] = val;
          imgData.data[i * 4 + 1] = val;
          imgData.data[i * 4 + 2] = val;
          imgData.data[i * 4 + 3] = 255;
        }
        selectedLayerImageData = imgData;
      }

      // Potrace Vector Tracing Engine
      const vectorResult = traceBinaryMaskToSVG(cleanMask, {
        turdSize,
        alphaMax,
        optCurve: true,
        optTolerance,
      });

      pathMap.set(layer.id, vectorResult.pathData);
    });

    return {
      layerPathDataMap: pathMap,
      binaryMaskData: selectedLayerImageData,
      processingResolution: { width: targetW, height: targetH },
    };
  }, [deferredState, activeTab]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-moss-950 text-slate-100">
      {/* App Header */}
      <header className="h-14 bg-[#ede7db] drafting-paper-grid border-b border-sand-300 px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shadow-md shadow-stone-900/25 border border-emerald-800/40">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center">
            <h1 className="font-bungee text-[32px] tracking-wide uppercase text-[#25282b] select-none leading-none">
              Cut Up
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/90 p-1 rounded-lg border border-[#555a60]/50 shadow-sm">
            <button
              onClick={handleUndo}
              disabled={history.past.length === 0}
              className="p-1.5 hover:bg-stone-200/70 text-[#2e3236] hover:text-black rounded disabled:opacity-30 disabled:pointer-events-none transition"
              title="Undo composition edit (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={history.future.length === 0}
              className="p-1.5 hover:bg-stone-200/70 text-[#2e3236] hover:text-black rounded disabled:opacity-30 disabled:pointer-events-none transition"
              title="Redo composition edit (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <label className="btn btn-primary cursor-pointer flex items-center gap-2 shadow-md shadow-stone-900/30 hover:shadow-lg hover:shadow-stone-900/40 transition">
            <Upload className="w-4 h-4" /> Upload Image
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Canvas Viewport */}
        <CanvasViewport
          state={state}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          layerPathDataMap={layerPathDataMap}
          binaryMask={binaryMaskData}
          processingResolution={processingResolution}
          onUpdatePosition={(dx, dy) => {
            updateState(prev => ({
              ...prev,
              workingImage: {
                ...prev.workingImage,
                position: {
                  x: prev.workingImage.position.x + dx,
                  y: prev.workingImage.position.y + dy,
                },
              },
            }), false);
          }}
          onUpdateScale={(scaleX, scaleY) => {
            updateState(prev => ({
              ...prev,
              workingImage: {
                ...prev.workingImage,
                scaleX,
                scaleY,
              },
            }), false);
          }}
          onUpdateCrop={(crop) => {
            updateState(prev => ({
              ...prev,
              workingImage: {
                ...prev.workingImage,
                crop: { type: 'rectangle', geometry: crop },
              },
            }), true);
          }}
          onCommitTransform={() => {
            setHistory(h => pushHistorySnapshot(h, state.workingImage));
          }}
          onLoadSamplePattern={loadSamplePattern}
          onFileUpload={handleFileUpload}
        />

        {/* Right Control Sidebar */}
        <aside className="w-96 bg-moss-900 border-l border-sand-800/70 flex flex-col h-full overflow-y-auto shrink-0 shadow-lg">
          {(activeTab === 'source' || activeTab === 'binary') && (
            <ImageTransformPanel
              state={state}
              onUpdateState={(updater) => updateState(updater, true)}
              onResetTransform={() => {
                updateState(prev => ({
                  ...prev,
                  workingImage: {
                    ...prev.workingImage,
                    position: { x: 0, y: 0 },
                    scaleX: 1.0,
                    scaleY: 1.0,
                  },
                }), true);
              }}
            />
          )}

          <ProcessingPanel
            state={state}
            onUpdateState={(updater) => updateState(updater, false)}
          />

          <CanvasSettingsPanel
            state={state}
            onUpdateState={(updater) => updateState(updater, false)}
          />

          <LayerManagerPanel
            state={state}
            onUpdateState={(updater) => updateState(updater, false)}
          />

          <StackingModePanel
            state={state}
            onUpdateState={(updater) => updateState(updater, false)}
          />

          <ExportPanel
            state={state}
            layerPathDataMap={layerPathDataMap}
            processingResolution={processingResolution}
            onUpdateState={(updater) => updateState(updater, false)}
          />
        </aside>
      </div>
    </div>
  );
};
