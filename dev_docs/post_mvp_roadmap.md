# Cut Up — Post-MVP Development Roadmap & Checklist

This document tracks upcoming feature milestones, architectural decisions, and technical specifications for updates following the initial MVP launch.

---

## Roadmap Checklist

- [ ] **1. Aesthetic Filter & Line Discretization System**
- [ ] **2. Canvas Display & Direct-Print Preferences Modal**
- [ ] **3. Interactive Wand Tool (Per-Layer Manual Island & Gap Cleanup)**

---

## 1. Aesthetic Filter & Line Discretization System

### Objective
Allow users to stylize the raw luminance cut patterns into distinct visual motifs (such as pixelated blocks, geometric low-poly facets, or flowing topographic contours) without slowing down the vector engine.

### Implementation Summary
- **Raster-Space Processing:** Filters run directly on the resampled luminance buffer prior to thresholding and vectorization.
- **Filters Included:**
  1. **Pixel Block / Voxel Mosaic (Priority 1):** Rectilinear quantization into clean 90° orthogonal cuts ($1\text{ mm}$–$15\text{ mm}$ block size).
  2. **Low-Poly / Voronoi Facets:** Geometric polygonal cell mesh with straight line segment boundaries.
  3. **Topographic / Elevation Curves:** Smooth multi-pass contour elevation map style.
  4. **Woodcut / Engraving Ribbons:** Modulated parallel scanline louvers.
  5. **Hexagonal Honeycomb:** Isometric hexagonal tiling.
  6. **Halftone Dot Matrix:** Pop-art dot/diamond growth screens.
- **Reference Specification:** See [`dev_docs/aesthetic_filters_spec.md`](./aesthetic_filters_spec.md) for full algorithmic formulas.

---

## 2. Canvas Display & Direct-Print Preferences Modal

### Objective
Provide an "Options / Preferences" modal for customizing on-screen visual presentation, workflow guidelines, and browser direct-print aesthetics without bloating or altering core machine SVG cut exports.

### Key Capabilities & Settings
- **Enhanced Visual Simulation & Print Pop:**
  - **Layer Drop Shadows:** Adjustable simulated shadow depth ($0\text{px}$ to $12\text{px}$) and opacity ($0\%$ to $60\%$) between sheets in Composite View. Makes physical stack depth pop dramatically when printing or exporting image snapshots directly from the browser.
  - **Ambient Paper Texture / Lighting:** Subtle tactile paper grain overlay in Composite simulation.
- **Workflow & Canvas Guides:**
  - **Guideline Visibility & Color:** Toggle and customize draft margin guides, center crosshairs, and rule alignments.
  - **Unit Display Preferences:** Independent selection of default measurement units (Inches, Millimeters, Centimeters) for margins and rulers.
  - **Canvas Backdrop Styles:** Switch workbench background between drafting paper grid, dark studio felt, cutting mat grid, or clean neutral gray.
- **Non-Interference Guarantee:** These settings apply exclusively to viewport rendering and direct browser printing; raw machine SVG exports remain strictly 1:1, unit-accurate, and unbloated.

---

## 3. Interactive Wand Tool (Per-Layer Manual Cleanup)

### Objective
Give artists semi-manual, surgical control over specific islands, holes, or high-noise areas on individual layers without needing to raise global minimum clearance or contour smoothing sliders (which affects the entire project).

### Key Capabilities & Workflow
- **Targeted Selection & Repair:**
  - **Interactive Tool Modes:**
    - **Bridge / Seal Gap:** Click-drag a gesture across a thin neck or gap to bridge material and reinforce structural integrity on that specific layer.
    - **Remove Island:** Click an unwanted floating scrap or speckle to delete it from the active layer mask.
    - **Fill Hole:** Click a hole or void to fill it solid on that specific layer.
- **Non-Destructive Layer Mask Overlays:**
  - Manual edits are stored as delta masks / vector patches associated with the specific `layer.id`.
  - Global image adjustments (crop, position, scale) can re-rasterize the base while maintaining manual user touchups.
- **Selective Fidelity:**
  - Allows an artist to preserve intricate, high-frequency facial or text details on one layer while selectively wiping out clutter or bridging weak tabs on another layer.

---

## Milestone Execution Order

1. **Phase 1: Aesthetic Filters Engine (Pixel Block & Topo first)**
2. **Phase 2: Display & Print Preferences Modal**
3. **Phase 3: Interactive Wand / Manual Patch Tool**
