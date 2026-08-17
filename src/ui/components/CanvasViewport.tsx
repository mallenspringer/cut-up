import React, { useRef, useEffect, useState } from 'react';
import { AppState, PreviewTab, Rect, CanvasTool, LayerManualEdits, ManualBridgeStroke, ManualFillPoint } from '../../engine/types';
import { UserPreferences } from '../../state/preferences';
import { getPrintableArea } from '../../engine/layout/canvasLayout';
import { ZoomIn, ZoomOut, Crop, Wand2, PenLine, RotateCcw, MousePointer } from 'lucide-react';

interface CanvasViewportProps {
  state: AppState;
  activeTab: PreviewTab;
  setActiveTab: (tab: PreviewTab) => void;
  layerPathDataMap: Map<string, string>;
  binaryMask: ImageData | null;
  processingResolution: { width: number; height: number };
  onUpdatePosition: (dx: number, dy: number) => void;
  onUpdateScale: (scaleX: number, scaleY: number) => void;
  onUpdateCrop?: (crop: Rect) => void;
  onCommitTransform?: () => void;
  onLoadSamplePattern?: () => void;
  onFileUpload?: (file: File) => void;
  onUpdateManualEdits?: (layerId: string, manualEdits: LayerManualEdits) => void;
  activeTool?: CanvasTool;
  setActiveTool?: (tool: CanvasTool) => void;
  bridgeWidthMm?: number;
  setBridgeWidthMm?: (width: number) => void;
  preferences?: UserPreferences;
  onUpdateState?: (updater: (prev: AppState) => AppState) => void;
}

type HandleType = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w';

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  state,
  activeTab,
  setActiveTab,
  layerPathDataMap,
  binaryMask,
  processingResolution,
  onUpdatePosition,
  onUpdateScale,
  onUpdateCrop,
  onCommitTransform,
  onLoadSamplePattern,
  onUpdateManualEdits,
  activeTool = 'navigate',
  setActiveTool,
  bridgeWidthMm = 2.0,
  setBridgeWidthMm,
  preferences,
  onUpdateState,
}) => {
  const { canvas, workingImage, layers, sourceImage } = state;
  const { widthPx, heightPx, marginPx, printableWidthPx, printableHeightPx } = getPrintableArea(canvas);

  const [zoom, setZoom] = useState(1.0);
  const [isSelected, setIsSelected] = useState(false);
  const [isCropToolActive, setIsCropToolActive] = useState(false);

  // Dragging / Resizing / Cropping state
  const [dragMode, setDragMode] = useState<'none' | 'translate' | HandleType | 'crop'>('none');
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startScale, setStartScale] = useState<{ scaleX: number; scaleY: number }>({ scaleX: 1, scaleY: 1 });

  // Interactive Crop Box state (in container px)
  const [cropBox, setCropBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Interactive Bridge drag state
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeStart, setBridgeStart] = useState<{ normX: number; normY: number } | null>(null);
  const [bridgeCurrent, setBridgeCurrent] = useState<{ normX: number; normY: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageFrameRef = useRef<HTMLDivElement | null>(null);
  const binaryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const selectedLayer = layers.find(l => l.id === state.selectedLayerId) || sortedLayers[1] || sortedLayers[0];

  // Cropped visual presentation for Source Image tab
  const croppedSourceDataUrl = React.useMemo(() => {
    if (!sourceImage) return null;
    const geom = workingImage.crop?.geometry;
    if (!geom || geom.width <= 0 || geom.height <= 0 || (geom.width === sourceImage.width && geom.height === sourceImage.height)) {
      return sourceImage.dataUrl;
    }

    const canvas = document.createElement('canvas');
    canvas.width = geom.width;
    canvas.height = geom.height;
    const ctx = canvas.getContext('2d');
    if (!ctx || !sourceImage.imageData) return sourceImage.dataUrl;

    ctx.putImageData(
      sourceImage.imageData,
      -geom.x,
      -geom.y,
      geom.x,
      geom.y,
      geom.width,
      geom.height
    );
    return canvas.toDataURL();
  }, [sourceImage, workingImage.crop]);

  // Base fitted dimensions matching transform.ts raster engine
  const { baseW, baseH } = React.useMemo(() => {
    if (!sourceImage) return { baseW: printableWidthPx, baseH: printableHeightPx };
    const geom = workingImage.crop?.geometry;
    const cropW = (geom && geom.width > 0) ? geom.width : sourceImage.width;
    const cropH = (geom && geom.height > 0) ? geom.height : sourceImage.height;

    const cropAspect = cropW / Math.max(1, cropH);
    const targetAspect = printableWidthPx / Math.max(1, printableHeightPx);

    let bw = printableWidthPx;
    let bh = printableHeightPx;

    if (cropAspect > targetAspect) {
      bw = printableWidthPx;
      bh = printableWidthPx / cropAspect;
    } else {
      bh = printableHeightPx;
      bw = printableHeightPx * cropAspect;
    }

    return { baseW: bw, baseH: bh };
  }, [sourceImage, workingImage.crop, printableWidthPx, printableHeightPx]);

  // Dynamically calculate zoom to fit canvas comfortably with drafting paper margin visible
  const calculateFitZoom = React.useCallback(() => {
    const el = containerRef.current;
    if (!el || widthPx <= 0 || heightPx <= 0) return 0.85;

    const availableW = el.clientWidth;
    const availableH = el.clientHeight;
    if (availableW <= 0 || availableH <= 0) return 0.85;

    const pad = 64;
    const targetW = Math.max(100, availableW - pad);
    const targetH = Math.max(100, availableH - pad);

    const fitScale = Math.min(targetW / widthPx, targetH / heightPx);
    return Math.max(0.2, Math.min(2.0, Math.floor(fitScale * 100) / 100));
  }, [widthPx, heightPx]);

  // Initial load and canvas size change fit zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      const optimal = calculateFitZoom();
      setZoom(optimal);
    }, 50);

    return () => clearTimeout(timer);
  }, [calculateFitZoom]);

  // Ctrl + Wheel Zoom Listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(z => Math.max(0.25, Math.min(4.0, z * factor)));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Source Image Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTab !== 'source' || !sourceImage) return;

    if (isCropToolActive) {
      setDragMode('crop');
      setCropBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
      return;
    }

    setIsSelected(true);
    setDragMode('translate');
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleHandleMouseDown = (e: React.MouseEvent, handle: HandleType) => {
    e.stopPropagation();
    setDragMode(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setStartScale({ scaleX: workingImage.scaleX, scaleY: workingImage.scaleY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragMode === 'none' || activeTab !== 'source') return;

    if (dragMode === 'crop' && cropBox) {
      setCropBox(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
      return;
    }

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (dragMode === 'translate') {
      onUpdatePosition(dx, dy);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Resize Handles
    const sensitivity = 0.005;
    const deltaScaleX = (dx * sensitivity);
    const deltaScaleY = (dy * sensitivity);
    const isShiftHeld = e.shiftKey;
    const isLocked = workingImage.lockAspect !== false && !isShiftHeld;

    let nextScaleX = startScale.scaleX;
    let nextScaleY = startScale.scaleY;

    if (dragMode === 'se' || dragMode === 'e') {
      nextScaleX = Math.max(0.1, startScale.scaleX + deltaScaleX);
      nextScaleY = isLocked ? nextScaleX : Math.max(0.1, startScale.scaleY + deltaScaleY);
    } else if (dragMode === 'sw' || dragMode === 'w') {
      nextScaleX = Math.max(0.1, startScale.scaleX - deltaScaleX);
      nextScaleY = isLocked ? nextScaleX : Math.max(0.1, startScale.scaleY + deltaScaleY);
    } else if (dragMode === 's') {
      nextScaleY = Math.max(0.1, startScale.scaleY + deltaScaleY);
      nextScaleX = isLocked ? nextScaleY : startScale.scaleX;
    } else if (dragMode === 'n' || dragMode === 'nw' || dragMode === 'ne') {
      nextScaleX = Math.max(0.1, startScale.scaleX + deltaScaleX);
      nextScaleY = isLocked ? nextScaleX : Math.max(0.1, startScale.scaleY + deltaScaleY);
    }

    onUpdateScale(nextScaleX, nextScaleY);
  };

  const handleMouseUp = () => {
    if (dragMode === 'crop' && cropBox && sourceImage && onUpdateCrop) {
      const imgEl = imageBoxRef.current?.querySelector('img');
      const imgRect = imgEl?.getBoundingClientRect();

      if (imgRect && imgRect.width > 0 && imgRect.height > 0) {
        const screenMinX = Math.min(cropBox.startX, cropBox.currentX);
        const screenMinY = Math.min(cropBox.startY, cropBox.currentY);
        const screenW = Math.abs(cropBox.currentX - cropBox.startX);
        const screenH = Math.abs(cropBox.currentY - cropBox.startY);

        if (screenW > 10 && screenH > 10) {
          const ratioX = Math.max(0, Math.min(1, (screenMinX - imgRect.left) / imgRect.width));
          const ratioY = Math.max(0, Math.min(1, (screenMinY - imgRect.top) / imgRect.height));
          const ratioW = Math.max(0, Math.min(1 - ratioX, screenW / imgRect.width));
          const ratioH = Math.max(0, Math.min(1 - ratioY, screenH / imgRect.height));

          const currGeom = workingImage.crop?.geometry || { x: 0, y: 0, width: sourceImage.width, height: sourceImage.height };
          const activeCropX = currGeom.x || 0;
          const activeCropY = currGeom.y || 0;
          const activeCropW = currGeom.width || sourceImage.width;
          const activeCropH = currGeom.height || sourceImage.height;

          const newCropX = Math.round(activeCropX + ratioX * activeCropW);
          const newCropY = Math.round(activeCropY + ratioY * activeCropH);
          const newCropW = Math.max(1, Math.round(ratioW * activeCropW));
          const newCropH = Math.max(1, Math.round(ratioH * activeCropH));

          onUpdateCrop({ x: newCropX, y: newCropY, width: newCropW, height: newCropH });
        }
      }

      setCropBox(null);
      setIsCropToolActive(false);
    } else if (dragMode !== 'none') {
      onCommitTransform?.();
    }

    setDragMode('none');
  };

  // Accurate normalized canvas coordinate calculation (0.0 to 1.0 mapping directly to target buffer)
  const getNormalizedCanvasCoords = React.useCallback((clientX: number, clientY: number) => {
    const el = pageFrameRef.current;
    if (!el || widthPx <= 0 || heightPx <= 0) return { normX: 0.5, normY: 0.5 };
    const rect = el.getBoundingClientRect();
    const clickX = (clientX - rect.left) / zoom;
    const clickY = (clientY - rect.top) / zoom;

    const normX = Math.max(0, Math.min(1, clickX / widthPx));
    const normY = Math.max(0, Math.min(1, clickY / heightPx));

    return { normX, normY };
  }, [zoom, widthPx, heightPx]);

  // Toast message state for interactive guidance
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Manual Wand & Bridge Mouse Down
  const handleManualMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeTab === 'source') return;
    const targetLayer = selectedLayer.order === 0 ? (sortedLayers[1] || selectedLayer) : selectedLayer;

    const { normX, normY } = getNormalizedCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'wand') {
      // Sample whether clicked area is paper or hole directly from active layer's mask
      let fillType: 0 | 1 = 1; // Default to fill hole with paper
      if (binaryMask) {
        const px = Math.min(binaryMask.width - 1, Math.max(0, Math.floor(normX * binaryMask.width)));
        const py = Math.min(binaryMask.height - 1, Math.max(0, Math.floor(normY * binaryMask.height)));
        const isPaper = binaryMask.data[(py * binaryMask.width + px) * 4] > 128;

        if (isPaper) {
          // Verify if this paper area is a true isolated scrap/island
          const targetW = binaryMask.width;
          const targetH = binaryMask.height;
          const totalPixels = targetW * targetH;
          const startIndex = py * targetW + px;

          const queue: number[] = [startIndex];
          const visited = new Uint8Array(totalPixels);
          visited[startIndex] = 1;
          let touchesBorder = false;
          let head = 0;

          while (head < queue.length) {
            const currIdx = queue[head++];
            const cx = currIdx % targetW;
            const cy = Math.floor(currIdx / targetW);

            if (cx === 0 || cx === targetW - 1 || cy === 0 || cy === targetH - 1) {
              touchesBorder = true;
              break;
            }

            const neighbors = [
              cx > 0 ? currIdx - 1 : -1,
              cx < targetW - 1 ? currIdx + 1 : -1,
              cy > 0 ? currIdx - targetW : -1,
              cy < targetH - 1 ? currIdx + targetW : -1,
            ];

            for (const nIdx of neighbors) {
              if (nIdx !== -1 && visited[nIdx] === 0 && binaryMask.data[nIdx * 4] > 128) {
                visited[nIdx] = 1;
                queue.push(nIdx);
              }
            }
          }

          if (touchesBorder) {
            // Clicked on the continuous foundation paper sheet -> No-op with user hint
            setToastMessage('Continuous paper sheet. To cover this area, switch to an upper layer and fill its cutout.');
            return;
          }

          fillType = 0; // Isolated floating island -> erase scrap
        } else {
          fillType = 1; // Cutout void -> fill with solid paper
        }
      }

      const newFill: ManualFillPoint = {
        id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: normX,
        y: normY,
        fillType,
      };

      const prevEdits = targetLayer.manualEdits || { bridges: [], fills: [] };
      onUpdateManualEdits?.(targetLayer.id, {
        ...prevEdits,
        fills: [...prevEdits.fills, newFill],
      });
    } else if (activeTool === 'bridge') {
      setIsBridging(true);
      setBridgeStart({ normX, normY });
      setBridgeCurrent({ normX, normY });
    }
  };

  // Window-level mouse listeners for Bridge Pen dragging & release
  useEffect(() => {
    if (!isBridging || !bridgeStart) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const { normX, normY } = getNormalizedCanvasCoords(e.clientX, e.clientY);
      setBridgeCurrent({ normX, normY });
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      const { normX, normY } = getNormalizedCanvasCoords(e.clientX, e.clientY);
      const targetLayer = selectedLayer.order === 0 ? (sortedLayers[1] || selectedLayer) : selectedLayer;

      const dist = Math.hypot(
        (normX - bridgeStart.normX) * widthPx,
        (normY - bridgeStart.normY) * heightPx
      );

      if (dist >= 3) {
        const newBridge: ManualBridgeStroke = {
          id: `bridge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x1: bridgeStart.normX,
          y1: bridgeStart.normY,
          x2: normX,
          y2: normY,
          widthMm: bridgeWidthMm || 2.0,
        };

        const prevEdits = targetLayer.manualEdits || { bridges: [], fills: [] };
        onUpdateManualEdits?.(targetLayer.id, {
          ...prevEdits,
          bridges: [...prevEdits.bridges, newBridge],
        });
      }

      setIsBridging(false);
      setBridgeStart(null);
      setBridgeCurrent(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isBridging, bridgeStart, selectedLayer, sortedLayers, widthPx, heightPx, bridgeWidthMm, getNormalizedCanvasCoords, onUpdateManualEdits]);

  // Render Binary Mask onto HTML canvas element
  useEffect(() => {
    if (activeTab === 'binary' && binaryMask && binaryCanvasRef.current) {
      const ctx = binaryCanvasRef.current.getContext('2d');
      if (ctx) {
        binaryCanvasRef.current.width = binaryMask.width;
        binaryCanvasRef.current.height = binaryMask.height;
        ctx.putImageData(binaryMask, 0, 0);
      }
    }
  }, [activeTab, binaryMask]);

  const viewW = processingResolution.width;
  const viewH = processingResolution.height;

  // Calculate rubberband crop box overlay dimensions
  const rubberband = cropBox ? {
    left: Math.min(cropBox.startX, cropBox.currentX),
    top: Math.min(cropBox.startY, cropBox.currentY),
    width: Math.abs(cropBox.currentX - cropBox.startX),
    height: Math.abs(cropBox.currentY - cropBox.startY),
  } : null;

  const canvasWidthMm = canvas.unit === 'mm'
    ? canvas.width
    : canvas.unit === 'cm'
      ? canvas.width * 10
      : canvas.width * 25.4;
  const pxPerMm = widthPx / Math.max(1, canvasWidthMm);

  const hasManualEdits = selectedLayer && selectedLayer.manualEdits && (
    (selectedLayer.manualEdits.fills && selectedLayer.manualEdits.fills.length > 0) ||
    (selectedLayer.manualEdits.bridges && selectedLayer.manualEdits.bridges.length > 0)
  );

  const themeClass = preferences?.backdropTheme === 'cutting_mat'
    ? 'workbench-theme-cutting_mat'
    : preferences?.backdropTheme === 'clean_gray'
      ? 'workbench-theme-clean_gray'
      : 'workbench-theme-drafting';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-moss-950 relative">
      {/* Top Preview Tab & Interactive Tool Selector */}
      <div className="h-[43px] border-b border-sand-800/70 bg-moss-900 px-4 flex items-center justify-between z-10 shrink-0 shadow-sm">
        <div className="flex items-center space-x-1 h-full">
          <button
            className={`nav-tab ${activeTab === 'source' ? 'active' : ''}`}
            onClick={() => setActiveTab('source')}
          >
            Source Image
          </button>
          <button
            className={`nav-tab ${activeTab === 'binary' ? 'active' : ''}`}
            onClick={() => setActiveTab('binary')}
          >
            Binary Mask
          </button>
          <button
            className={`nav-tab ${activeTab === 'layer' ? 'active' : ''}`}
            onClick={() => setActiveTab('layer')}
          >
            Layer Preview
          </button>
          <button
            className={`nav-tab ${activeTab === 'cut' ? 'active' : ''}`}
            onClick={() => setActiveTab('cut')}
          >
            Cut Geometry
          </button>
          <button
            className={`nav-tab ${activeTab === 'composite' ? 'active' : ''}`}
            onClick={() => setActiveTab('composite')}
          >
            Composite Stack (3D)
          </button>
        </div>

        {/* Source Tab Tools: Drag Crop Button */}
        {activeTab === 'source' && sourceImage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCropToolActive(prev => !prev)}
              className={`btn btn-sm flex items-center gap-1.5 text-xs transition ${
                isCropToolActive ? 'btn-primary ring-2 ring-emerald-400' : 'btn-secondary'
              }`}
              title="Click and drag a box to crop photo"
            >
              <Crop className="w-3.5 h-3.5" />
              {isCropToolActive ? 'Drag Box to Crop...' : 'Crop Tool'}
            </button>
          </div>
        )}

        {/* Interactive Manual Touchup Toolbar (Active on Layer / Cut / Composite Tabs) */}
        {activeTab !== 'source' && activeTab !== 'binary' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-[#142017]/90 backdrop-blur-md p-1 rounded-lg border border-sand-700/80 text-xs text-sand-300">
              <button
                onClick={() => setActiveTool?.('navigate')}
                className={`px-2 py-1 rounded flex items-center gap-1.5 transition ${
                  activeTool === 'navigate'
                    ? 'bg-emerald-700 text-white font-medium shadow-sm'
                    : 'hover:text-sand-100 hover:bg-[#223627]'
                }`}
                title="Pan / Navigate Canvas"
              >
                <MousePointer className="w-3.5 h-3.5" /> Navigate
              </button>
              <button
                onClick={() => {
                  setActiveTool?.('wand');
                  if (state.selectedLayerId === sortedLayers[0]?.id && sortedLayers[1]) {
                    onUpdateState?.(prev => ({ ...prev, selectedLayerId: sortedLayers[1].id }));
                  }
                }}
                className={`px-2 py-1 rounded flex items-center gap-1.5 transition ${
                  activeTool === 'wand'
                    ? 'bg-emerald-700 text-white font-medium shadow-sm'
                    : 'hover:text-sand-100 hover:bg-[#223627]'
                }`}
                title="Smart Wand: Click holes to fill with paper, click scraps to erase"
              >
                <Wand2 className="w-3.5 h-3.5" /> Wand
              </button>
              <button
                onClick={() => {
                  setActiveTool?.('bridge');
                  if (state.selectedLayerId === sortedLayers[0]?.id && sortedLayers[1]) {
                    onUpdateState?.(prev => ({ ...prev, selectedLayerId: sortedLayers[1].id }));
                  }
                }}
                className={`px-2 py-1 rounded flex items-center gap-1.5 transition ${
                  activeTool === 'bridge'
                    ? 'bg-emerald-700 text-white font-medium shadow-sm'
                    : 'hover:text-sand-100 hover:bg-[#223627]'
                }`}
                title="Bridge Pen: Drag across gaps to draw solid paper tabs"
              >
                <PenLine className="w-3.5 h-3.5" /> Bridge
              </button>
            </div>

            {/* Bridge Width Presets */}
            {activeTool === 'bridge' && (
              <div className="flex items-center gap-1 bg-[#142017]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-sand-700/80 text-xs">
                <span className="text-[11px] text-sand-400 font-mono pr-0.5">Width:</span>
                {[1, 2, 4].map(w => (
                  <button
                    key={w}
                    onClick={() => setBridgeWidthMm?.(w)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition ${
                      bridgeWidthMm === w
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-sand-400 hover:text-sand-100'
                    }`}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            )}

            {/* Reset Layer Edits Button */}
            {hasManualEdits && (
              <button
                onClick={() => {
                  onUpdateManualEdits?.(selectedLayer.id, { bridges: [], fills: [] });
                }}
                className="btn btn-sm btn-secondary text-xs flex items-center gap-1 text-sand-300 hover:text-red-400 hover:border-red-500/50"
                title={`Reset all manual fills and bridges on Layer ${selectedLayer.order}`}
              >
                <RotateCcw className="w-3 h-3" /> Reset Edits
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-sand-400 font-mono pl-6 shrink-0 whitespace-nowrap">
          Page: {canvas.width}×{canvas.height} {canvas.unit} ({Math.round(widthPx)}×{Math.round(heightPx)} px)
        </div>
      </div>

      {/* Main Preview Container with Dynamic Workbench Backdrop */}
      <div
        ref={containerRef}
        className={`flex-1 flex items-center justify-center p-8 overflow-auto relative select-none transition-colors duration-200 ${themeClass} ${
          isCropToolActive ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
            {/* Rubberband Drag-to-Crop Overlay */}
            {isCropToolActive && rubberband && (
          <div
            className="fixed border-2 border-dashed border-emerald-500 bg-emerald-500/25 pointer-events-none z-50 rounded shadow-2xl"
            style={{
              left: `${rubberband.left}px`,
              top: `${rubberband.top}px`,
              width: `${rubberband.width}px`,
              height: `${rubberband.height}px`,
            }}
          />
        )}

        {/* Physical Paper Page Frame with Scale Zoom */}
        <div
          ref={pageFrameRef}
          className="bg-white relative transition-transform duration-75 border border-sand-700/60 overflow-hidden flex items-center justify-center shrink-0"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            boxShadow: '0 20px 50px -10px rgba(45, 38, 25, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          }}
        >
          {/* 1. Source Preview */}
          {activeTab === 'source' && (
            <div
              ref={imageBoxRef}
              className="absolute inset-0 w-full h-full flex items-center justify-center z-10"
            >
              {sourceImage ? (
                <div
                  className={`relative flex items-center justify-center transition-all duration-75 ${
                    isSelected ? 'ring-2 ring-emerald-500 ring-offset-1' : ''
                  }`}
                  style={{
                    width: `${baseW}px`,
                    height: `${baseH}px`,
                    transform: `translate(${workingImage.position.x}px, ${workingImage.position.y}px) scale(${workingImage.scaleX}, ${workingImage.scaleY})`,
                  }}
                >
                  <img
                    src={croppedSourceDataUrl || sourceImage.dataUrl}
                    alt="Source Image"
                    className="w-full h-full object-fill pointer-events-none block"
                  />

                  {/* Interactive Scale Grabber Handles (Click to Reveal) */}
                  {isSelected && !isCropToolActive && (
                    <>
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'nw')}
                        className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'ne')}
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'se')}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'sw')}
                        className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize z-30 shadow"
                      />
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="text-slate-400 text-sm font-medium">No Image Uploaded</div>
                  <div className="text-xs text-slate-500 max-w-xs">
                    Upload a JPG, PNG, or WebP photo to convert into cut layers.
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {onLoadSamplePattern && (
                      <button
                        onClick={onLoadSamplePattern}
                        className="btn btn-sm btn-secondary text-xs"
                      >
                        Load Demo Pattern
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Binary Mask Preview (Full Canvas) */}
          {activeTab === 'binary' && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black z-10">
              <canvas ref={binaryCanvasRef} className="w-full h-full object-fill" />
            </div>
          )}

          {/* 3. Cut Geometry Preview (Full Canvas - Internal Blade Cuts Only) */}
          {activeTab === 'cut' && (
            <svg
              className="absolute inset-0 w-full h-full bg-slate-950 z-10"
              viewBox={`0 0 ${viewW} ${viewH}`}
            >
              {Array.from(layerPathDataMap.entries()).map(([layerId, pathData]) => {
                const layer = layers.find(l => l.id === layerId);
                const color = layer ? layer.color : '#38bdf8';
                return pathData ? (
                  <path
                    key={layerId}
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    fillRule="evenodd"
                  />
                ) : null;
              })}
            </svg>
          )}

          {/* 4. Layer Preview (Full Sheet in Layer Color with Inner Holes Subtracted) */}
          {activeTab === 'layer' && selectedLayer && (
            <svg
              className="absolute inset-0 w-full h-full bg-transparent z-10"
              viewBox={`0 0 ${viewW} ${viewH}`}
            >
              {(() => {
                const isLayer0 = selectedLayer.order === 0;
                const isVoid = isLayer0 && selectedLayer.isSolidBacking === false;
                if (isVoid) {
                  return null;
                }

                const isSolid = isLayer0 && selectedLayer.isSolidBacking !== false;
                const sheetPath = isSolid
                  ? `M 0 0 H ${viewW} V ${viewH} H 0 Z`
                  : `M 0 0 H ${viewW} V ${viewH} H 0 Z ${layerPathDataMap.get(selectedLayer.id) || ''}`;

                return (
                  <path
                    d={sheetPath}
                    fill={selectedLayer.color}
                    fillRule="evenodd"
                    stroke="none"
                  />
                );
              })()}
            </svg>
          )}

          {/* 5. Composite Stack Simulation (Physical Paper Stack) */}
          {activeTab === 'composite' && (
            <div className="absolute inset-0 w-full h-full relative bg-transparent overflow-hidden flex items-center justify-center z-10">
              {sortedLayers.map((layer, idx) => {
                const isLayer0 = idx === 0;
                const isVoid = isLayer0 && layer.isSolidBacking === false;

                if (isVoid) return null;

                const pathData = layerPathDataMap.get(layer.id) || '';
                const isSolid = isLayer0 && layer.isSolidBacking !== false;
                const sheetPath = isSolid
                  ? `M 0 0 H ${viewW} V ${viewH} H 0 Z`
                  : `M 0 0 H ${viewW} V ${viewH} H 0 Z ${pathData}`;

                const shadowDepth = preferences?.layerShadowDepth ?? 4;
                const shadowOpacity = preferences?.layerShadowOpacity ?? 0.25;
                const shadowColor = preferences?.layerShadowColor ?? '#000000';

                const hexToRgba = (hex: string, alpha: number) => {
                  let c = (hex || '#000000').replace('#', '');
                  if (c.length === 3) c = c.split('').map(x => x + x).join('');
                  const num = parseInt(c, 16) || 0;
                  const r = (num >> 16) & 255;
                  const g = (num >> 8) & 255;
                  const b = num & 255;
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };

                const filterStyle = idx > 0 && shadowDepth > 0 && shadowOpacity > 0
                  ? `drop-shadow(0px ${Math.max(1, Math.round(shadowDepth * 0.4))}px ${shadowDepth}px ${hexToRgba(shadowColor, shadowOpacity)})`
                  : undefined;

                const paperTexture = preferences?.paperTexture ?? 'off';
                const textureStrength = paperTexture === 'smooth_bristol'
                  ? (preferences?.textureStrengths?.smooth_bristol ?? 0.10)
                  : paperTexture === 'cold_press'
                    ? (preferences?.textureStrengths?.cold_press ?? 0.10)
                    : 0;

                return (
                  <svg
                    key={layer.id}
                    className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-150"
                    style={{
                      filter: filterStyle,
                    }}
                    viewBox={`0 0 ${viewW} ${viewH}`}
                  >
                    {/* Reusable Paper Texture SVG Filters */}
                    {paperTexture !== 'off' && (
                      <defs>
                        {paperTexture === 'smooth_bristol' && (
                          <filter id={`filter-bristol-${layer.id}`} x="0%" y="0%" width="100%" height="100%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed={idx * 37 + 101} result="noise" />
                            <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" in="noise" result="grayNoise" />
                            <feComposite in="grayNoise" in2="SourceAlpha" operator="in" />
                          </filter>
                        )}
                        {paperTexture === 'cold_press' && (
                          <filter id={`filter-coldpress-${layer.id}`} x="0%" y="0%" width="100%" height="100%">
                            <feTurbulence type="fractalNoise" baseFrequency="0.045 0.075" numOctaves="4" seed={idx * 37 + 101} result="noise" />
                            <feDiffuseLighting in="noise" lightingColor="#ffffff" surfaceScale="2.2" diffuseConstant="1.2" result="light">
                              <feDistantLight azimuth="45" elevation="55" />
                            </feDiffuseLighting>
                            <feComposite in="light" in2="SourceAlpha" operator="in" />
                          </filter>
                        )}
                      </defs>
                    )}

                    {/* Solid Base Paper Sheet */}
                    <path
                      d={sheetPath}
                      fill={layer.color}
                      fillRule="evenodd"
                      stroke="rgba(0,0,0,0.15)"
                      strokeWidth="0.5"
                    />

                    {/* Tactile Paper Grain Overlay */}
                    {paperTexture !== 'off' && textureStrength > 0 && (
                      <path
                        d={sheetPath}
                        fillRule="evenodd"
                        fill={paperTexture === 'cold_press' ? '#ffffff' : '#808080'}
                        filter={paperTexture === 'cold_press' ? `url(#filter-coldpress-${layer.id})` : `url(#filter-bristol-${layer.id})`}
                        style={{
                          mixBlendMode: paperTexture === 'cold_press' ? 'multiply' : 'overlay',
                          opacity: textureStrength,
                        }}
                      />
                    )}
                  </svg>
                );
              })}
            </div>
          )}

          {/* Interactive Manual Touchup Layer (Wand / Bridge Pen Click & Drag Overlay) */}
          {activeTab !== 'source' && activeTab !== 'binary' && (activeTool === 'wand' || activeTool === 'bridge') && (
            <div
              className="absolute inset-0 z-30 cursor-crosshair"
              onMouseDown={handleManualMouseDown}
            >
              {/* Live Bridge Drag Preview */}
              {isBridging && bridgeStart && bridgeCurrent && (
                <svg
                  className="absolute inset-0 pointer-events-none w-full h-full"
                  viewBox={`0 0 ${widthPx} ${heightPx}`}
                >
                  <line
                    x1={bridgeStart.normX * widthPx}
                    y1={bridgeStart.normY * heightPx}
                    x2={bridgeCurrent.normX * widthPx}
                    y2={bridgeCurrent.normY * heightPx}
                    stroke={selectedLayer.color}
                    strokeWidth={Math.max(2, (bridgeWidthMm * pxPerMm))}
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                  <line
                    x1={bridgeStart.normX * widthPx}
                    y1={bridgeStart.normY * heightPx}
                    x2={bridgeCurrent.normX * widthPx}
                    y2={bridgeCurrent.normY * heightPx}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </div>
          )}

          {/* Overlaid Margin Guide (z-index: 40 on top of image and cut paths) */}
          <div
            className="absolute border border-dashed border-indigo-400/70 pointer-events-none z-40"
            style={{
              top: `${marginPx}px`,
              left: `${marginPx}px`,
              right: `${marginPx}px`,
              bottom: `${marginPx}px`,
            }}
          />
        </div>
      </div>

      {/* Floating Active Tool Toast Guide (Bottom-Left) */}
      {activeTab !== 'source' && activeTab !== 'binary' && (activeTool === 'wand' || activeTool === 'bridge') && (
        <div className="absolute bottom-4 left-4 z-50 bg-[#142017]/95 backdrop-blur-md border border-sand-700/90 px-3 py-2 rounded-lg shadow-2xl text-xs text-sand-200 flex items-center gap-2">
          {activeTool === 'wand' ? (
            <>
              <Wand2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>
                <strong className="text-white font-medium">Wand Tool:</strong> Click any hole to fill with paper, or click scraps to erase on <span className="font-semibold text-emerald-300">Layer {selectedLayer.order}</span>.
              </span>
            </>
          ) : (
            <>
              <PenLine className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>
                <strong className="text-white font-medium">Bridge Pen ({bridgeWidthMm}mm):</strong> Drag across gaps to join paper tabs on <span className="font-semibold text-emerald-300">Layer {selectedLayer.order}</span>.
              </span>
            </>
          )}
        </div>
      )}

      {/* Floating Guidance Toast */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-moss-900/95 text-sand-100 border border-emerald-500/70 shadow-2xl px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FIXED Bottom-Right Zoom Control Cluster (Pinned to outer viewport corner) */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-1 bg-[#142017]/90 backdrop-blur-md border border-sand-700/90 p-1.5 rounded-lg shadow-2xl text-xs text-white">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z / 1.25))}
          className="p-1.5 hover:bg-[#223627] rounded text-white hover:text-sand-100 transition"
          title="Zoom Out (Ctrl + Wheel Down)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(calculateFitZoom())}
          className="px-2 py-1 font-mono text-[11px] font-semibold hover:bg-[#223627] text-white hover:text-sand-100 transition rounded"
          title="Fit Canvas to Viewport"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(4.0, z * 1.25))}
          className="p-1.5 hover:bg-[#223627] rounded text-white hover:text-sand-100 transition"
          title="Zoom In (Ctrl + Wheel Up)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
