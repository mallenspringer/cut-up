# CutUp Chroma — Application Product Specification (APP_SPEC.md)

---

## 1. Executive Summary & Vision

**CutUp Chroma** is a browser-based, client-side vector synthesis workstation designed to convert photographs and digital art into multi-color, physical papercraft and laser/vinyl cut patterns.

While the original **CutUp** relies on scalar luminance (1D lightness thresholding), **CutUp Chroma** operates in full 3D perceptual color space ($\text{OKLab} / \text{OKLCH}$). It automatically segments imagery into discrete physical cardstock colors, computes underlap seam bleeds to prevent blade cutting gaps, and outputs unit-accurate, production-ready vector cut files (`.svg`) and assembly templates.

---

## 2. Core Physical Paradigms

CutUp Chroma supports two distinct physical manufacturing and assembly modes:

### 2.1 Mode A: Stacked Relief (Default Mode)
* **Physical Structure:** Physical sheets of cardstock stacked on top of each other in a designated $Z$-order (Layer 0 at the base up to Top Layer $N$).
* **Cutout Physics:** Upper sheets have cutouts that reveal the specific colors of the sheets beneath them.
* **Underlap Seam Bleed (+0.5mm):** Lower layers are automatically dilated beneath upper boundary lines by a configurable margin ($0.2\text{mm}$–$1.5\text{mm}$) so cutting tolerances and blade kerf do not create visible white gaps or paper misalignment.
* **Solid Base Option:** Layer 0 acts as a solid foundational paper backing or void.

### 2.2 Mode B: Inlay / Intarsia Mosaic (Toggle Mode)
* **Physical Structure:** All color pieces are cut as disjoint interlocking tiles meant to be assembled side-by-side on a single flat surface (like wooden intarsia or leather mosaic).
* **Cutout Physics:** Each color sheet contains the exact boundary outlines of its respective patches.
* **Tolerance / Kerf Offset:** Optional boundary inset/offset slider ($0.0\text{mm}$–$0.5\text{mm}$) to account for laser burn kerf or blade drag.

---

## 3. User Journey & Workflow

```text
[1. Upload Image] ──► [2. Auto K-Means Extraction] ──► [3. Palette & Tuning] ──► [4. Interactive Touchup] ──► [5. Export SVG / ZIP]
     (RAW / PNG)       (2-12 Colors in OKLab)         (Weighting Sliders)        (Wand & Bridge Tools)         (Machine-Ready)
```

1. **Upload & Canvas Sizing:**
   * User drops an image (PNG, JPEG, WebP).
   * Sets canvas dimensions ($8.5\times 11\text{ in}$, $12\times 12\text{ in}$, A4, etc.) and margins ($10\text{mm}$).
   * Crops, pans, and scales image to the desired crop frame.
2. **Automated Palette Discovery:**
   * The engine runs $K$-Means clustering in $\text{OKLab}$ perceptual space to extract $K$ dominant color centroids ($K=2$ to $12$, default: $5$).
   * User can adjust the color count slider, choose a preset cardstock swatch library (e.g., French Paper Pop-Tone, Earth & Woodgrain, Cyberpunk Neon), or sample colors directly with an eyedropper tool.
3. **Chroma Separation & Weighting:**
   * User adjusts **Hue Weight**, **Lightness Weight**, and **Chroma/Saturation Floor** sliders to fine-tune how subtle tones map to the physical paper sheets.
4. **Interactive Layer Inspection & Touchup:**
   * User inspects individual color sheets.
   * Uses the **Wand Tool** to remove stray speckles/islands or fill voids.
   * Uses the **Bridge Pen** to join fragile paper necks.
5. **Physical Stack Simulation & Export:**
   * Evaluates the 3D composite stack with real-time drop shadows, paper textures (Bristol / Cold-Press), and layer visibility toggles.
   * Exports combined multi-color SVG, individual per-color cut SVGs in a ZIP, or direct browser PDF print templates.

---

## 4. Navigation Tabs & Workspace Viewports

The central workspace provides 4 specialized preview tabs matching CutUp's tab navigation:

### 4.1 Tab 1: `Source Image`
* **Purpose:** Image positioning, scaling, aspect ratio fitting, and crop boundaries.
* **Controls:** Drag-to-crop rubberband, scale/rotation, fit-to-canvas buttons.

### 4.2 Tab 2: `Quantized Preview`
* **Purpose:** High-resolution 2D raster preview of the color segmentation prior to vectorization.
* **Features:** Allows checking how clean color boundaries are before Potrace vector curve-fitting.

### 4.3 Tab 3: `Layer View` (Single Color Sheet Inspector)
* **Purpose:** Inspects one isolated color sheet at a time.
* **Features:**
  * Displays physical vector cut paths with underlap boundary indicators (dashed lines showing hidden overlap).
  * Color chip indicator showing sheet area percentage and total cut path count.
  * Active tool surface for Wand and Bridge Pen touchups.

### 4.4 Tab 4: `Composite 3D Stack`
* **Purpose:** Full assembly simulation of the physical cardstock artwork.
* **Features:**
  * Simulated layer drop-shadows with adjustable depth ($0\text{px}$–$16\text{px}$), opacity ($0\%$–$70\%$), and custom shadow tint.
  * Tactile paper shaders (Hot-Press Bristol, Cold-Press Watercolor Rag) with independent layer seeds.
  * Workbench backdrops (*Drafting Pad*, *Cutting Mat*, *Neutral Gray*).

---

## 5. Screen Layout & Component Hierarchy

CutUp Chroma strictly adopts the established dark studio aesthetic of CutUp:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: Logo [CutUp Chroma V1.0] | Undo / Redo | Export Modal | Settings    │
├───────────────────┬─────────────────────────────────────┬───────────────────┤
│ Left Panel:       │ Central Viewport:                   │ Right Panel:      │
│ 1. Canvas Setup   │ - Top Preview Tab Switcher          │ 1. Active Palette │
│    - Dimensions   │ - Interactive Canvas / Paper Sheet  │    - Swatch List  │
│    - Margins      │ - Floating Wand / Bridge Toolbar    │    - K Slider     │
│ 2. Processing     │ - Pinned Zoom Controls (Bottom-R)   │ 2. Color Layers   │
│    - Min Feature  │ - Dynamic Workbench Backdrop        │    - Z-Order Drag │
│    - Smoothing    │                                     │    - Underlap Pad │
│    - Underlap Bleed│                                    │    - Solid/Void   │
│ 3. Chroma Tuning  │                                     │                   │
│    - Hue Weight   │                                     │                   │
│    - Luma Weight  │                                     │                   │
└───────────────────┴─────────────────────────────────────┴───────────────────┘
```

---

## 6. Export Requirements & File Specifications

All exported files must adhere strictly to physical CNC, laser cutter (Glowforge, xTool), and digital vinyl cutter (Cricut, Silhouette) standards:

1. **Combined Multi-Color Master SVG (`.svg`):**
   * Contains all color layers organized into discrete SVG `<g id="layer-N-colorname">` groups.
   * Includes standard stroke metadata (`stroke="#000000" stroke-width="0.1mm" fill="none"` or colored fills).
   * Exact unit-accurate root attributes (`width="8.5in" height="11in" viewBox="0 0 W H"`).
2. **Layer-by-Layer ZIP Archive (`.zip`):**
   * Exports each color as an isolated individual cut sheet named `01_Base_Navy.svg`, `02_Layer_Mustard.svg`, `03_Layer_Terracotta.svg`.
   * Packaged cleanly using `fflate`.
3. **Direct Browser Print / PDF Export:**
   * Uses `@media print` with dynamic `@page` physical dimensions.
   * Completely strips UI chrome and workbench backgrounds for pristine 1:1 color prints or papercraft templates.
