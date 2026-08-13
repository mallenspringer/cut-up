import React from 'react';
import { AppState } from '../../engine/types';
import { generateCombinedSVG } from '../../export/svgGenerator';
import { exportCombinedSVGFile, exportLayerPackageZIP } from '../../export/zipExporter';
import { Download, Archive, Printer } from 'lucide-react';

interface ExportPanelProps {
  state: AppState;
  layerPathDataMap: Map<string, string>;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  state,
  layerPathDataMap,
}) => {
  const { canvas, layers, output } = state;

  const handleExportCombinedSVG = () => {
    const svgContent = generateCombinedSVG(
      layerPathDataMap,
      layers,
      canvas,
      output.registrationMarks
    );
    exportCombinedSVGFile(svgContent, `cutup-combined-${Date.now()}.svg`);
  };

  const handleExportZIPPackage = () => {
    exportLayerPackageZIP(
      layerPathDataMap,
      layers,
      canvas,
      output.registrationMarks
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Export & Print Geometry
      </h3>

      <div className="space-y-2">
        <button
          onClick={handleExportCombinedSVG}
          className="w-full btn btn-primary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Export Combined SVG
        </button>

        <button
          onClick={handleExportZIPPackage}
          className="w-full btn btn-secondary flex items-center justify-center gap-2"
        >
          <Archive className="w-4 h-4 text-indigo-400" /> Export Layer Package (.zip)
        </button>

        <button
          onClick={handlePrint}
          className="w-full btn btn-secondary flex items-center justify-center gap-2 text-slate-300"
        >
          <Printer className="w-4 h-4 text-slate-400" /> Print (100% Scale)
        </button>
      </div>

      <div className="text-[11px] text-slate-500 text-center leading-relaxed">
        SVGs use <span className="font-mono text-slate-400">evenodd</span> fill rules & physical vector coordinates compatible with Cricut, Silhouette, & Laser Cutters.
      </div>
    </div>
  );
};
