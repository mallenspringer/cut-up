import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react';
import { AppState, PreviewTab, WorkingImageState, LayerState } from './engine/types';
import { createDefaultLayers } from './engine/layers/layerGenerator';
import { createInitialHistory, pushHistorySnapshot, undoHistory, redoHistory, HistoryState } from './state/history';
import { UserPreferences, loadUserPreferences, saveUserPreferences } from './state/preferences';
import { resampleWorkingImage } from './engine/working/transform';
import { computeLuminance, extractAlpha } from './engine/luminance/luminance';
import { filterBinaryMaskCanvas } from './engine/manufacturing/canvasFilter';
import { cleanBinaryMaskDiscrete } from './engine/manufacturing/discreteClearance';
import { generateLayerMask } from './engine/layers/layerGenerator';
import { applyManualEditsToMask } from './engine/layers/manualEdits';
import { traceBinaryMaskToSVG, calculateTurdSize, calculateAlphaMax, calculateOptTolerance } from './engine/vector/potraceEngine';
import { convertToPixels, getPrintableArea } from './engine/layout/canvasLayout';
import { extractImageDataFromImage, createSourceImageFromData } from './engine/source/sourceImage';
import { applyAestheticFilter, DEFAULT_AESTHETIC_FILTER_STATE } from './engine/filters/filterEngine';

import { CanvasViewport } from './ui/components/CanvasViewport';
import { ImageTransformPanel } from './ui/components/ImageTransformPanel';
import { ProcessingPanel } from './ui/components/ProcessingPanel';
import { CanvasSettingsPanel } from './ui/components/CanvasSettingsPanel';
import { LayerManagerPanel } from './ui/components/LayerManagerPanel';
import { ExportPanel } from './ui/components/ExportPanel';
import { PreferencesModal } from './ui/components/PreferencesModal';
import { CookieConsentBanner } from './ui/components/CookieConsentBanner';

import { Scissors, Upload, Undo2, Redo2, Settings } from 'lucide-react';

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
    minimumFeatureSize: 2.0, // 2mm
    smoothing: 0,
  },
  aestheticFilter: DEFAULT_AESTHETIC_FILTER_STATE,
  layers: createDefaultLayers(2),
  selectedLayerId: 'layer-1',
  output: {
    registrationMarks: false,
    exportMode: 'combined',
  },
  activeTool: 'navigate',
  bridgeWidthMm: 2.0,
};

export const App: React.FC = () => {
  const [history, setHistory] = useState<HistoryState>(() => createInitialHistory(DEFAULT_APP_STATE));
  const state = history.present;
  const [activeTab, setActiveTab] = useState<PreviewTab>('composite');

  // User preferences & Cookie storage state
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadUserPreferences());
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const updatePreferences = (updater: (prev: UserPreferences) => UserPreferences) => {
    setPreferences(prev => {
      const next = updater(prev);
      saveUserPreferences(next);
      return next;
    });
  };

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

      const nextState: AppState = {
        ...state,
        sourceImage: sampleSource,
        workingImage: newWorkingImage,
        selectedLayerId: 'layer-1',
      };
      setHistory(createInitialHistory(nextState));
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

        // Detect orientation from image dimensions
        const isImageLandscape = img.naturalWidth > img.naturalHeight;
        const orientation: 'portrait' | 'landscape' = isImageLandscape ? 'landscape' : 'portrait';
        const canvasW = isImageLandscape
          ? Math.max(state.canvas.width, state.canvas.height)
          : Math.min(state.canvas.width, state.canvas.height);
        const canvasH = isImageLandscape
          ? Math.min(state.canvas.width, state.canvas.height)
          : Math.max(state.canvas.width, state.canvas.height);

        const nextState: AppState = {
          ...state,
          sourceImage: source,
          workingImage: newWorkingImage,
          canvas: {
            ...state.canvas,
            width: canvasW,
            height: canvasH,
            orientation,
          },
          selectedLayerId: 'layer-1',
        };

        setHistory(createInitialHistory(nextState));
        setActiveTab('source');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // State update wrapper with pure, atomic history snapshotting
  const updateState = (updater: (prev: AppState) => AppState, snapshotHistory: boolean = false) => {
    setHistory(prevHistory => {
      const nextState = updater(prevHistory.present);
      if (snapshotHistory) {
        return pushHistorySnapshot(prevHistory, nextState);
      } else {
        return {
          ...prevHistory,
          present: nextState,
        };
      }
    });
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    setHistory(prev => undoHistory(prev));
  };

  const handleRedo = () => {
    setHistory(prev => redoHistory(prev));
  };

  // Keyboard shortcut listener for Ctrl+Z and Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fast geometric signature of layers (excluding visual-only properties like color or solid backing)
  const layerGeometricKey = state.layers
    .map(l => `${l.id}:${l.order}:${l.threshold}:${JSON.stringify(l.manualEdits || {})}`)
    .join('|');

  // 1. Resample & Luminance Buffer Memoization (Only re-computes when image, position, scale, crop, or canvas size changes)
  // 1a. Base Resample & Grayscale Luminance Memoization (Only re-computes when image, position, scale, crop, or canvas size changes)
  const baseLuminanceData = useMemo(() => {
    if (!state.sourceImage || activeTab === 'source') {
      return null;
    }

    const { widthPx, heightPx, printableWidthPx, printableHeightPx } = getPrintableArea(state.canvas);
    const maxDim = 800;
    const canvasAspect = widthPx / Math.max(1, heightPx);
    let targetW = maxDim;
    let targetH = Math.round(maxDim / canvasAspect);
    if (targetH > maxDim) {
      targetH = maxDim;
      targetW = Math.round(maxDim * canvasAspect);
    }

    // Nearest-neighbor resample scaled into full canvas processing buffer
    const resampled = resampleWorkingImage(
      state.sourceImage,
      state.workingImage,
      targetW,
      targetH,
      widthPx,
      heightPx,
      printableWidthPx,
      printableHeightPx
    );

    // Grayscale luminance conversion & alpha extraction
    const rawLuminance = computeLuminance(resampled);
    const alpha = extractAlpha(resampled);

    // Pixel density (px/mm)
    const canvasWidthMm = state.canvas.unit === 'mm'
      ? state.canvas.width
      : state.canvas.unit === 'cm'
        ? state.canvas.width * 10
        : state.canvas.width * 25.4;
    const pxPerMm = targetW / Math.max(1, canvasWidthMm);

    return {
      rawLuminance,
      alpha,
      targetW,
      targetH,
      pxPerMm,
      imageBounds: resampled.imageBounds,
    };
  }, [
    state.sourceImage,
    state.workingImage,
    state.canvas,
    activeTab,
  ]);

  // 1b. Aesthetic Filter Discretization (Fast <2ms pass on cached grayscale buffer)
  const luminanceBufferData = useMemo(() => {
    if (!baseLuminanceData) return null;
    const { rawLuminance, alpha, targetW, targetH, pxPerMm, imageBounds } = baseLuminanceData;

    const luminance = applyAestheticFilter(rawLuminance, state.aestheticFilter, {
      width: targetW,
      height: targetH,
      pxPerMm,
      alpha,
      imageBounds,
    });

    return {
      luminance,
      alpha,
      targetW,
      targetH,
      pxPerMm,
    };
  }, [
    baseLuminanceData,
    state.aestheticFilter,
  ]);

  // Persistent Per-Layer Vector Path Cache (Key -> Traced SVG Path)
  const vectorPathCacheRef = useRef<Map<string, string>>(new Map());
  const prevLuminanceRef = useRef(luminanceBufferData);
  if (prevLuminanceRef.current !== luminanceBufferData) {
    prevLuminanceRef.current = luminanceBufferData;
    vectorPathCacheRef.current.clear();
  }

  // Defer heavy multi-layer Potrace vector path tracing during rapid continuous slider dragging
  const deferredLuminance = useDeferredValue(luminanceBufferData);
  const deferredProcessing = useDeferredValue(state.processing);
  const deferredFilter = useDeferredValue(state.aestheticFilter);

  // 2. Derived Processing Pipeline Computation with Per-Layer Incremental Tracing
  const { layerPathDataMap, binaryMaskData, processingResolution } = useMemo(() => {
    const activeLuminanceData = deferredLuminance || luminanceBufferData;
    if (!activeLuminanceData) {
      return {
        layerPathDataMap: new Map<string, string>(),
        binaryMaskData: null,
        processingResolution: { width: 400, height: 518 },
      };
    }

    const { luminance, alpha, targetW, targetH, pxPerMm } = activeLuminanceData;
    const processing = deferredProcessing || state.processing;
    const filter = deferredFilter || state.aestheticFilter;

    // Check if aesthetic filter is active
    const isPixelate = filter?.enabled && filter?.type === 'pixelate';
    const isVoronoi = filter?.enabled && filter?.type === 'voronoi';
    const isAestheticActive = isPixelate || isVoronoi;

    const cornerStyle = isPixelate
      ? (filter?.pixelate?.cornerStyle ?? 'orthogonal')
      : isVoronoi
        ? (filter?.voronoi?.cornerStyle ?? 'orthogonal')
        : 'rounded';

    // When an aesthetic filter is active, use discrete topology clearance to keep block/facet edges intact
    const useDiscreteClearance = isAestheticActive;
    const effectiveClearance = processing.minimumFeatureSize;
    const effectiveSmoothing = isAestheticActive ? 0 : processing.smoothing;

    // Potrace vector parameters:
    // - Orthogonal/Straight: alphaMax: 0.0, optCurve: false (Strict 90° sharp corners)
    // - Rounded/Soft: alphaMax: 1.0, optCurve: true, optTolerance: 0.4 (Tapered slanted edges and gentle rounded corners)
    // - Standard Organic: dynamic alphaMax & optTolerance derived from smoothing slider
    const turdSize = calculateTurdSize(processing.minimumFeatureSize, pxPerMm);
    const alphaMax = isAestheticActive
      ? (cornerStyle === 'orthogonal' ? 0.0 : 1.0)
      : calculateAlphaMax(effectiveSmoothing);
    const optTolerance = isAestheticActive
      ? (cornerStyle === 'orthogonal' ? 0.0 : 0.4)
      : calculateOptTolerance(effectiveSmoothing);
    const optCurve = isAestheticActive ? (cornerStyle === 'rounded') : true;

    const pathMap = new Map<string, string>();
    let selectedLayerImageData: ImageData | null = null;
    const activeLayerId = state.selectedLayerId || (state.layers[1] ? state.layers[1].id : state.layers[0]?.id);

    state.layers.forEach((layer: LayerState, idx: number) => {
      const cacheKey = `${layer.id}:${layer.threshold}:${effectiveClearance}:${effectiveSmoothing}:${cornerStyle}:${JSON.stringify(filter || {})}:${JSON.stringify(layer.manualEdits || {})}`;
      let pathData = vectorPathCacheRef.current.get(cacheKey);

      // If this is the active layer (for binary mask preview) or if path data is missing from cache, generate mask
      if (!pathData || layer.id === activeLayerId) {
        // Binary mask thresholding
        const rawMask = generateLayerMask(
          luminance,
          targetW,
          targetH,
          idx,
          state.layers,
          alpha
        );

        // 1. Pre-filter: discrete topology clearance keeps block/facet structure crisp without Gaussian melting
        const baseCleanMask = useDiscreteClearance
          ? cleanBinaryMaskDiscrete(rawMask, effectiveClearance, pxPerMm)
          : filterBinaryMaskCanvas(
              rawMask,
              effectiveClearance,
              pxPerMm,
              effectiveSmoothing
            );

        // 2. Corner geometry: if rounded aesthetic is selected, apply subtle corner chamfer/fillet
        const cleanMask = (isAestheticActive && cornerStyle === 'rounded')
          ? filterBinaryMaskCanvas(baseCleanMask, 0, pxPerMm, 40)
          : baseCleanMask;

        // Apply manual touchups (Wand fills & Bridge capsules) ON TOP of cleaned mask
        const finalMask = applyManualEditsToMask(
          cleanMask,
          layer.manualEdits,
          targetW,
          targetH,
          pxPerMm
        );

        if (layer.id === activeLayerId) {
          const imgData = new ImageData(targetW, targetH);
          for (let i = 0; i < finalMask.data.length; i++) {
            const val = finalMask.data[i] === 1 ? 255 : 0;
            imgData.data[i * 4] = val;
            imgData.data[i * 4 + 1] = val;
            imgData.data[i * 4 + 2] = val;
            imgData.data[i * 4 + 3] = 255;
          }
          selectedLayerImageData = imgData;
        }

        if (!pathData) {
          // Potrace Vector Tracing Engine (sharp 90° corners for orthogonal pixelation)
          const vectorResult = traceBinaryMaskToSVG(finalMask, {
            turdSize,
            alphaMax,
            optCurve,
            optTolerance,
          });
          pathData = vectorResult.pathData;
          vectorPathCacheRef.current.set(cacheKey, pathData);
        }
      }

      pathMap.set(layer.id, pathData);
    });

    return {
      layerPathDataMap: pathMap,
      binaryMaskData: selectedLayerImageData,
      processingResolution: { width: targetW, height: targetH },
    };
  }, [
    deferredLuminance,
    luminanceBufferData,
    deferredProcessing,
    state.processing,
    deferredFilter,
    state.aestheticFilter,
    layerGeometricKey,
    state.selectedLayerId,
    state.layers,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-moss-950 text-slate-100">
      {/* App Header */}
      <header className="h-14 bg-[#ede7db] drafting-paper-grid border-b border-sand-300 px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shadow-md shadow-stone-900/25 border border-emerald-800/40">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-bungee text-[32px] tracking-wide uppercase text-[#25282b] select-none leading-none">
              Cut Up
            </h1>
            <span className="text-xs font-sans font-semibold text-black tracking-wide select-none">
              V 1.2
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#142017]/90 backdrop-blur-md border border-sand-700/90 p-1 rounded-lg shadow-md text-xs text-white">
            <button
              onClick={handleUndo}
              disabled={history.past.length === 0}
              className="p-1.5 hover:bg-[#223627] text-white hover:text-sand-100 rounded disabled:opacity-30 disabled:pointer-events-none transition"
              title="Undo composition edit (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={history.future.length === 0}
              className="p-1.5 hover:bg-[#223627] text-white hover:text-sand-100 rounded disabled:opacity-30 disabled:pointer-events-none transition"
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

          <button
            onClick={() => setIsPreferencesOpen(true)}
            className="p-2 rounded-lg bg-[#142017]/90 text-sand-200 hover:text-white hover:bg-[#223627] border border-sand-700/90 shadow-md transition"
            title="Workspace Preferences & Display Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
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
          preferences={preferences}
          activeTool={state.activeTool || 'navigate'}
          setActiveTool={(tool) => updateState(prev => ({ ...prev, activeTool: tool }), false)}
          bridgeWidthMm={state.bridgeWidthMm || 2.0}
          setBridgeWidthMm={(width) => updateState(prev => ({ ...prev, bridgeWidthMm: width }), false)}
          onUpdateManualEdits={(layerId, manualEdits) => {
            updateState(prev => ({
              ...prev,
              layers: prev.layers.map(l => l.id === layerId ? { ...l, manualEdits } : l),
            }), true);
          }}
          onUpdateState={(updater) => updateState(updater, false)}
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
            updateState(prev => ({ ...prev }), true);
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

          <ExportPanel
            state={state}
            layerPathDataMap={layerPathDataMap}
            processingResolution={processingResolution}
            onUpdateState={(updater) => updateState(updater, false)}
          />

          {/* App Footer */}
          <footer className="p-4 mt-auto border-t border-sand-800/70 text-center text-xs text-sand-400/90 leading-relaxed bg-moss-950/30">
            <div>© 2026 M. Springer</div>
            <div>
              a{' '}
              <a
                href="https://poemware.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 transition"
              >
                Poemware
              </a>{' '}
              Application
            </div>
          </footer>
        </aside>
      </div>

      {/* Preferences & Display Settings Modal */}
      <PreferencesModal
        isOpen={isPreferencesOpen}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        onClose={() => setIsPreferencesOpen(false)}
      />

      {/* First-Visit Cookie & Persistence Consent Banner */}
      {!preferences.cookieConsentDismissed && (
        <CookieConsentBanner
          onAccept={() => {
            updatePreferences(prev => ({
              ...prev,
              enableCookiePersistence: true,
              cookieConsentDismissed: true,
            }));
          }}
          onDecline={() => {
            updatePreferences(prev => ({
              ...prev,
              enableCookiePersistence: false,
              cookieConsentDismissed: true,
            }));
          }}
        />
      )}
    </div>
  );
};
