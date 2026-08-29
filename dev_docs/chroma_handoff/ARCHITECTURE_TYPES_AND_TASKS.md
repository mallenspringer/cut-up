# CutUp Chroma — Architecture, Types & Autonomous Implementation Plan (ARCHITECTURE_TYPES_AND_TASKS.md)

---

## 1. System Architecture & Directory Structure

CutUp Chroma follows the exact architectural structure and separation of concerns proven in CutUp:

```text
src/
├── engine/
│   ├── chroma/
│   │   ├── oklab.ts              # sRGB <-> Linear RGB <-> OKLab <-> OKLCH transformations
│   │   ├── kmeans.ts             # K-Means++ clustering & dominant palette extraction
│   │   ├── classifier.ts         # Weighted Delta-E classification & mask generator
│   │   ├── underlap.ts           # Binary morphological dilation & underlap seam expansion
│   │   └── chroma.test.ts        # Comprehensive Vitest unit tests for color math & clustering
│   ├── layers/
│   │   ├── manualEdits.ts        # Wand hole fills & Bridge Pen capsule vector patches
│   │   └── manualEdits.test.ts   # Vitest unit tests for manual topology edits
│   ├── layout/
│   │   └── canvasLayout.ts       # Physical canvas units (in, mm, cm), margins & pixel density
│   ├── vector/
│   │   └── potraceEngine.ts      # Potrace-ts wrapper, curve optimization, & SVG serializer
│   └── types.ts                  # Core TypeScript types and data contracts
├── state/
│   ├── history.ts                # Pure atomic undo/redo history container
│   ├── history.test.ts           # History unit test suite
│   ├── preferences.ts            # LocalStorage persistence, workbench themes, shadow presets
│   └── preferences.test.ts       # Preferences test suite
├── export/
│   ├── svgGenerator.ts           # Master multi-color SVG and single-layer SVG generators
│   └── zipPackage.ts             # fflate-based ZIP archive creator
├── ui/
│   ├── components/
│   │   ├── CanvasViewport.tsx    # Multi-tab preview container, zoom/pan, & 3D stack renderer
│   │   ├── LayerManagerPanel.tsx # Palette swatches, Z-order reordering, & layer controls
│   │   ├── ChromaControlsPanel.tsx# Hue weight, Lightness weight, & clearance sliders
│   │   ├── ExportModal.tsx       # Export dialog with custom prefix & naming rules
│   │   ├── PreferencesModal.tsx  # Workspace settings, drop-shadow colors, & backdrop themes
│   │   └── CookieConsentBanner.tsx# Session persistence prompt
│   └── icons/                    # Lucide icons
├── App.tsx                       # Root container, memoized vector pipeline, keyboard shortcuts
└── index.css                     # Tailwind CSS tokens, theme backdrops, & @media print rules
```

---

## 2. Core TypeScript Schema (`src/engine/types.ts`)

```ts
export type LengthUnit = 'in' | 'mm' | 'cm';

export type PreviewTab = 'source' | 'quantized' | 'layer' | 'composite';

export type ActiveTool = 'navigate' | 'wand' | 'bridge' | 'eyedropper';

export type AssemblyMode = 'stacked_relief' | 'inlay_mosaic';

export interface CanvasSettings {
  width: number;
  height: number;
  unit: LengthUnit;
  margin: number;
}

export interface ChromaSwatch {
  id: string;
  name: string;
  hex: string;
  oklab: [number, number, number]; // [L, a, b]
  oklch: [number, number, number]; // [L, C, H]
}

export interface ChromaLayerState {
  id: string;
  order: number; // Z-index (0 = bottom base, N = top sheet)
  swatch: ChromaSwatch;
  isSolidBacking?: boolean; // For Layer 0 (true = solid sheet, false = void)
  underlapBleedMm: number; // default: 0.5mm
  manualEdits?: {
    fills?: Array<{ normX: number; normY: number; radiusNorm: number; action: 'fill' | 'erase' }>;
    bridges?: Array<{ startNormX: number; startNormY: number; endNormX: number; endNormY: number; widthMm: number }>;
  };
}

export interface ChromaProcessingSettings {
  assemblyMode: AssemblyMode;
  colorCount: number; // K (2 to 12)
  hueWeight: number; // 0.0 to 3.0 (default: 1.0)
  lightnessWeight: number; // 0.0 to 3.0 (default: 1.0)
  chromaFloor: number; // 0.0 to 0.2 (default: 0.02)
  minimumFeatureSize: number; // in mm (0.5 to 5.0mm)
  smoothing: number; // 0 to 5 (Potrace curve tolerance)
  underlapBleedMm: number; // 0.0 to 1.5mm (default: 0.5mm)
}

export interface WorkingImageState {
  position: { x: number; y: number };
  scaleX: number;
  scaleY: number;
  crop?: { left: number; top: number; width: number; height: number };
}

export interface AppState {
  sourceImage: HTMLImageElement | null;
  workingImage: WorkingImageState;
  canvas: CanvasSettings;
  processing: ChromaProcessingSettings;
  palette: ChromaSwatch[];
  layers: ChromaLayerState[];
  selectedLayerId: string | null;
  activeTool: ActiveTool;
  bridgeWidthMm: number;
}
```

---

## 3. Autonomous Step-by-Step Implementation Roadmap

When executing this project, implement in strict phased order, running `npm test` after each phase:

### Phase 1: Pure Color Mathematics & Engine (`src/engine/chroma/`)
1. **`oklab.ts`**: Implement exact formulas for $\text{sRGB} \leftrightarrow \text{Linear RGB} \leftrightarrow \text{OKLab} \leftrightarrow \text{OKLCH}$.
2. **`kmeans.ts`**: Implement $K$-Means++ initialization and Lloyd's centroid convergence loop in OKLab space.
3. **`classifier.ts`**: Implement weighted $\Delta E_{\text{artist}}$ pixel classification to generate binary masks for each color layer.
4. **`underlap.ts`**: Implement morphological underlap dilation ($+0.5\text{mm}$) on lower layers beneath overlapping upper sheets.
5. **Unit Test Verification (`chroma.test.ts`)**:
   * Verify sRGB to OKLab roundtrip precision ($< 0.001$ error).
   * Test $K$-Means clustering on known synthetic color test arrays.
   * Verify underlap dilation expands masks beneath upper layers without leaking into void space.
   * **Target:** `npm test` passing 100%.

---

### Phase 2: Potrace Vector Integration & Layout Engine
1. **`potraceEngine.ts`**: Wrap `@kcaitech/potrace-ts` with curve optimization, turdSize filtering, and unit-accurate SVG path serialization.
2. **`canvasLayout.ts`**: Implement printable area calculations, unit conversion (inches, mm, cm), and pixel density scaling.
3. **`manualEdits.ts`**: Implement topology-safe Wand hole fills and Bridge Pen capsule rendering.
4. **Unit Test Verification**: Run `npm test` to confirm vector path accuracy.

---

### Phase 3: State Management & Undo/Redo Engine
1. **`history.ts`**: Implement atomic history snapshots with strict-mode deduplication for undo/redo (<kbd>Ctrl+Z</kbd>, <kbd>Ctrl+Shift+Z</kbd>).
2. **`preferences.ts`**: Implement local storage persistence, theme presets, and drop-shadow styling.
3. **Unit Test Verification (`history.test.ts`, `preferences.test.ts`)**.

---

### Phase 4: Canvas Viewport & Preview Tabs (`src/ui/components/CanvasViewport.tsx`)
1. Implement Tab 1 (`Source Image`) with aspect ratio fit and drag-to-crop rubberband.
2. Implement Tab 2 (`Quantized Preview`) rendering full-resolution color segmentation.
3. Implement Tab 3 (`Layer View`) with single-sheet vector cut paths and underlap boundary overlays.
4. Implement Tab 4 (`Composite 3D Stack`) with live GPU drop-shadows, Hot-Press Bristol / Cold-Press Watercolor textures, and workbench backdrops (*Drafting Pad*, *Cutting Mat*, *Neutral Gray*).

---

### Phase 5: Layer Manager & Chroma Inspector (`src/ui/components/`)
1. **`LayerManagerPanel.tsx`**:
   * Swatch list with color chips, hex values, and pixel coverage percentages.
   * Drag-and-drop or up/down buttons for physical Z-stack reordering.
   * Layer 0 Solid / Void toggle.
   * Direct per-layer color picker with instant $0\text{ ms}$ GPU repaint.
2. **`ChromaControlsPanel.tsx`**:
   * Number of Colors slider ($K=2$ to $12$).
   * Hue Weight ($w_H$) and Lightness Weight ($w_L$) sliders.
   * Underlap Bleed ($0.0\text{mm}$ to $1.5\text{mm}$) and Minimum Feature Size sliders.
   * Assembly Mode toggle (*Stacked Relief* vs. *Inlay Mosaic*).

---

### Phase 6: Export & Direct Browser Print Engine
1. **`svgGenerator.ts`**: Multi-color master SVG and per-color isolated cut SVGs.
2. **`zipPackage.ts`**: fflate ZIP packaging with customizable prefix rules.
3. **`index.css` `@media print`**: Direct 1:1 physical browser print / PDF export with zero UI clutter.

---

## 4. Key Performance Guidelines for Autonomous Agent

1. **Decoupled Pipeline Memoization:**
   * Never re-run $K$-Means or Potrace when purely visual properties change (e.g. changing shadow depth, toggling textures, or editing display preferences).
2. **Per-Layer Incremental Vector Caching:**
   * Cache vector paths using a composite key: `[layerId, swatchHex, underlapBleed, smoothing, minFeatureSize, manualEdits]`.
3. **GPU Hardware Blending:**
   * Use SVG `<defs>` filters and CSS `mix-blend-mode: multiply` for textures and simulated cardstock depth.
