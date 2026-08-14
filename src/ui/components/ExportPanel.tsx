import React from 'react';
import { AppState } from '../../engine/types';
import { generateCombinedSVG } from '../../export/svgGenerator';
import { exportCombinedSVGFile, exportLayerPackageZIP } from '../../export/zipExporter';
import { Download, Archive, Printer, Target } from 'lucide-react';

interface ExportPanelProps {
  state: AppState;
  layerPathDataMap: Map<string, string>;
  processingResolution?: { width: number; height: number };
  onUpdateState?: (updater: (prev: AppState) => AppState) => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  state,
  layerPathDataMap,
  processingResolution,
  onUpdateState,
}) => {
  const { canvas, layers, output } = state;

  const handleExportCombinedSVG = () => {
    const svgContent = generateCombinedSVG(
      layerPathDataMap,
      layers,
      canvas,
      output.registrationMarks,
      processingResolution
    );
    exportCombinedSVGFile(svgContent, `cutup-combined-${Date.now()}.svg`);
  };

  const handleExportZIPPackage = () => {
    exportLayerPackageZIP(
      layerPathDataMap,
      layers,
      canvas,
      output.registrationMarks,
      processingResolution
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-sand-300">
        Export & Print Geometry
      </h3>

      {/* Registration Marks */}
      {onUpdateState && (
        <div className="flex items-center justify-between p-2.5 bg-moss-850/80 rounded border border-sand-800/70">
          <div className="flex items-center gap-2 text-xs font-medium text-sand-200">
            <Target className="w-4 h-4 text-emerald-400" />
            Registration Marks
          </div>
          <input
            type="checkbox"
            checked={output.registrationMarks}
            onChange={(e) => {
              const registrationMarks = e.target.checked;
              onUpdateState(prev => ({ ...prev, output: { ...prev.output, registrationMarks } }));
            }}
            className="w-4 h-4 accent-emerald-600 cursor-pointer"
          />
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleExportCombinedSVG}
          className="w-full btn btn-primary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Export Combined SVG
        </button>

        <button
          onClick={handleExportZIPPackage}
          className="w-full btn btn-secondary flex items-center justify-center gap-2 text-sand-200"
        >
          <Archive className="w-4 h-4 text-emerald-400" /> Export Layer Package (.zip)
        </button>

        <button
          onClick={handlePrint}
          className="w-full btn btn-secondary flex items-center justify-center gap-2 text-sand-200"
        >
          <Printer className="w-4 h-4 text-sand-400" /> Print (100% Scale)
        </button>
      </div>
    </div>
  );
};
