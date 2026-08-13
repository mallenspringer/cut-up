import React, { useRef, useEffect, useState } from 'react';
import { AppState, PreviewTab, Rect } from '../../engine/types';
import { getPrintableArea } from '../../engine/layout/canvasLayout';
import { ZoomIn, ZoomOut, Crop, Move } from 'lucide-react';

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const binaryCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const selectedLayer = layers.find(l => l.id === state.selectedLayerId) || sortedLayers[0];

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

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTab !== 'source' || !sourceImage) return;

    if (isCropToolActive) {
      setDragMode('crop');
      setCropBox({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
      return;
    }

    // Default translate drag
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
          // Calculate normalized ratios relative to displayed img element bounding box
          const ratioX = Math.max(0, Math.min(1, (screenMinX - imgRect.left) / imgRect.width));
          const ratioY = Math.max(0, Math.min(1, (screenMinY - imgRect.top) / imgRect.height));
          const ratioW = Math.max(0, Math.min(1 - ratioX, screenW / imgRect.width));
          const ratioH = Math.max(0, Math.min(1 - ratioY, screenH / imgRect.height));

          // Current active crop in natural pixel space
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
      // Single history snapshot on completed drag action
      onCommitTransform?.();
    }

    setDragMode('none');
  };

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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 relative">
      {/* Top Preview Tab & Tool Selector */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center space-x-1">
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
                isCropToolActive ? 'btn-primary ring-2 ring-indigo-400' : 'btn-secondary'
              }`}
              title="Click and drag a box to crop photo"
            >
              <Crop className="w-3.5 h-3.5" />
              {isCropToolActive ? 'Drag Box to Crop...' : 'Crop Tool'}
            </button>
          </div>
        )}

        <div className="text-xs text-slate-400 font-mono">
          Page: {canvas.width}×{canvas.height} {canvas.unit} ({Math.round(widthPx)}×{Math.round(heightPx)} px)
        </div>
      </div>

      {/* Main Preview Container with Ctrl+Wheel Zoom */}
      <div
        ref={containerRef}
        className={`flex-1 flex items-center justify-center p-8 overflow-auto relative select-none ${
          isCropToolActive ? 'cursor-crosshair' : ''
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Rubberband Drag-to-Crop Overlay */}
        {isCropToolActive && rubberband && (
          <div
            className="fixed border-2 border-dashed border-indigo-400 bg-indigo-500/25 pointer-events-none z-50 rounded shadow-2xl"
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
          className="bg-white shadow-2xl relative transition-transform duration-75 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
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
                    isSelected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
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
                        className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'ne')}
                        className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'se')}
                        className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize z-30 shadow"
                      />
                      <div
                        onMouseDown={(e) => handleHandleMouseDown(e, 'sw')}
                        className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize z-30 shadow"
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
              className="absolute inset-0 w-full h-full bg-slate-950 z-10"
              viewBox={`0 0 ${viewW} ${viewH}`}
            >
              <rect width="100%" height="100%" fill="#0f172a" />
              <path
                d={`M 0 0 H ${viewW} V ${viewH} H 0 Z ${layerPathDataMap.get(selectedLayer.id) || ''}`}
                fill={selectedLayer.color}
                fillRule="evenodd"
                stroke="none"
              />
            </svg>
          )}

          {/* 5. Composite Stack Simulation (Physical Paper Stack) */}
          {activeTab === 'composite' && (
            <div className="absolute inset-0 w-full h-full relative bg-slate-950 overflow-hidden flex items-center justify-center z-10">
              {sortedLayers.map((layer, idx) => {
                const pathData = layerPathDataMap.get(layer.id) || '';

                // Solid backing base paper sheet only if layer 1 explicitly has isSolidBacking === true
                const isSolid = idx === 0 && layer.isSolidBacking === true;
                const sheetPath = isSolid
                  ? `M 0 0 H ${viewW} V ${viewH} H 0 Z`
                  : `M 0 0 H ${viewW} V ${viewH} H 0 Z ${pathData}`;

                return (
                  <svg
                    key={layer.id}
                    className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-150"
                    style={{
                      filter: idx > 0 ? 'drop-shadow(0px 2px 3px rgba(0,0,0,0.25))' : undefined,
                    }}
                    viewBox={`0 0 ${viewW} ${viewH}`}
                  >
                    <path
                      d={sheetPath}
                      fill={layer.color}
                      fillRule="evenodd"
                      stroke="rgba(0,0,0,0.15)"
                      strokeWidth="0.5"
                    />
                  </svg>
                );
              })}
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

      {/* FIXED Bottom-Right Zoom Control Cluster (Pinned to outer viewport corner) */}
      <div className="absolute bottom-4 right-4 z-50 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-800 p-1 rounded-lg shadow-xl text-xs text-slate-300">
        <button
          onClick={() => setZoom(z => Math.max(0.25, z / 1.25))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition"
          title="Zoom Out (Ctrl + Wheel Down)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1.0)}
          className="px-2 py-1 font-mono text-[11px] hover:bg-slate-800 text-slate-300 transition rounded"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoom(z => Math.min(4.0, z * 1.25))}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition"
          title="Zoom In (Ctrl + Wheel Up)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
