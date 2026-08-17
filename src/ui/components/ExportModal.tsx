import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Archive, FileCode, CheckCircle2 } from 'lucide-react';
import { AppState } from '../../engine/types';
import { generateCombinedSVG } from '../../export/svgGenerator';
import { exportCombinedSVGFile, exportLayerPackageZIP } from '../../export/zipExporter';

export type ExportModalMode = 'combined' | 'zip' | null;

interface ExportModalProps {
  isOpen: boolean;
  mode: ExportModalMode;
  state: AppState;
  layerPathDataMap: Map<string, string>;
  processingResolution?: { width: number; height: number };
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  mode,
  state,
  layerPathDataMap,
  processingResolution,
  onClose,
}) => {
  const { canvas, layers, output, sourceImage } = state;
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Derive initial default name based on source image or generic timestamp
  const getDefaultName = (exportMode: ExportModalMode): string => {
    const baseName = sourceImage?.name
      ? sourceImage.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'cutup';
    return exportMode === 'combined' ? `${baseName}-combined` : `${baseName}-layers`;
  };

  const [filename, setFilename] = useState<string>('');

  useEffect(() => {
    if (isOpen && mode) {
      setFilename(getDefaultName(mode));
      // Focus input on open
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, mode, sourceImage]);

  // Handle keyboard shortcuts (Escape to close, Enter to export)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mode) return null;

  const sanitizedBase = filename.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || (mode === 'combined' ? 'cutup-combined' : 'cutup-layers');
  const finalFilename = mode === 'combined' ? `${sanitizedBase}.svg` : `${sanitizedBase}.zip`;

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
  const activeCutLayers = sortedLayers.filter(l => !(l.order === 0 && l.isSolidBacking === false));

  const handleConfirmExport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (mode === 'combined') {
      const svgContent = generateCombinedSVG(
        layerPathDataMap,
        layers,
        canvas,
        output.registrationMarks,
        processingResolution
      );
      exportCombinedSVGFile(svgContent, finalFilename);
    } else if (mode === 'zip') {
      exportLayerPackageZIP(
        layerPathDataMap,
        layers,
        canvas,
        output.registrationMarks,
        processingResolution,
        finalFilename,
        sanitizedBase
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-moss-900 border border-sand-700/90 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-sand-800/80 flex items-center justify-between bg-moss-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-700/20 text-emerald-400 border border-emerald-600/30">
              {mode === 'combined' ? <FileCode className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-sand-100">
                {mode === 'combined' ? 'Export Combined SVG' : 'Export Layer Package (.zip)'}
              </h3>
              <p className="text-[11px] text-sand-400">
                {mode === 'combined'
                  ? 'All cutting paths merged into a single multi-layer SVG'
                  : `Individual SVGs for ${activeCutLayers.length} layers bundled in a ZIP`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-sand-400 hover:text-sand-100 hover:bg-moss-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleConfirmExport} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-sand-200">
              {mode === 'combined' ? 'File Name' : 'File Name & Layer Prefix'}
            </label>
            <div className="flex items-center rounded-lg border border-sand-700 bg-moss-950/80 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 overflow-hidden transition">
              <input
                ref={inputRef}
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={mode === 'combined' ? 'cutup-combined' : 'cutup-layers'}
                className="flex-1 px-3 py-2 text-xs bg-transparent text-sand-100 placeholder-sand-600 focus:outline-none font-mono"
              />
              <span className="px-3 py-2 text-xs font-mono font-medium text-sand-400 bg-moss-900 border-l border-sand-800 select-none">
                {mode === 'combined' ? '.svg' : '.zip'}
              </span>
            </div>
            <p className="text-[10px] text-sand-400">
              {mode === 'combined'
                ? `Will save as ${finalFilename}`
                : `Will save as ${finalFilename} with layer files prefixed by "${sanitizedBase}-"`}
            </p>
          </div>

          {/* Layer Preview / Summary Box */}
          <div className="p-3 rounded-lg bg-moss-950/60 border border-sand-800/70 text-xs space-y-2">
            <div className="flex items-center justify-between text-sand-300 font-medium">
              <span>Export Details</span>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            </div>

            <div className="text-[11px] text-sand-400 space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Canvas Size:</span>
                <span className="text-sand-200">{canvas.width} × {canvas.height} {canvas.unit}</span>
              </div>
              <div className="flex justify-between">
                <span>Registration Marks:</span>
                <span className="text-sand-200">{output.registrationMarks ? 'Enabled (Corner crosses)' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between">
                <span>Layers Included:</span>
                <span className="text-sand-200">{activeCutLayers.length} layers</span>
              </div>
            </div>

            {mode === 'zip' && (
              <div className="mt-2 pt-2 border-t border-sand-800/60 text-[10px] text-sand-400">
                <span className="font-semibold text-sand-300">Sample Archive Contents:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-[10px] text-sand-400 truncate">
                  {activeCutLayers.slice(0, 3).map((l, i) => (
                    <li key={l.id} className="truncate">
                      {sanitizedBase}-{l.order === 0 ? 'layer-00-backing-solid.svg' : `layer-${String(l.order).padStart(2, '0')}-threshold-${String(l.threshold).padStart(3, '0')}.svg`}
                    </li>
                  ))}
                  {activeCutLayers.length > 3 && (
                    <li className="text-sand-500 italic">...and {activeCutLayers.length - 3} more files</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
            >
              <Download className="w-3.5 h-3.5" />
              {mode === 'combined' ? 'Export SVG' : 'Export ZIP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
