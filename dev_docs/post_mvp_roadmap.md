# Cut Up — Post-MVP Development Roadmap & Checklist

This document tracks upcoming feature milestones, architectural decisions, and technical specifications for updates following the Cut Up v1.1 release.

---

## Roadmap Checklist

- [x] **1. Canvas Display & Direct-Print Preferences Modal (Completed in v1.1)**
- [x] **2. Interactive Touchup Suite — Wand & Bridge Pen (Completed in v1.0.1 / v1.1)**
- [x] **3. Tactile Paper Simulation Engine — Bristol & Cold-Press (Completed in v1.1)**
- [x] **4. Custom Export Dialog System — ZIP prefixes & Combined SVG naming (Completed in v1.1)**
- [ ] **5. Curated Default Layer Color Palettes**
- [ ] **6. Seamless Photographic Material Alpha Masks (Felt, Kraft, Construction Paper)**
- [ ] **7. Aesthetic Filter & Line Discretization System (Pixel Block, Topo, Halftone)**

---

## 1. Curated Default Layer Color Palettes

### Objective
Allow users to instantly restyle their entire paper stack using curated, harmonious multi-layer color palettes tailored for physical cardstock collections (rather than having to manually pick each layer's color individually).

### Proposed Palettes:
1. **Desaturated Rainbow (Default):** The classic ROYGBIV spectrum tuned for paper layers.
2. **Monochrome Cardstock (Shades of Gray):** True grayscale paper progression from pure white top sheet down to charcoal/black foundation.
3. **Warm Earth & Woodgrain:** Terracotta, ochre, sienna, espresso, and creamy ivory.
4. **Cyberpunk Neon:** Vibrant electric magenta, cyan, ultraviolet, lime, and deep void black.
5. **Botanical Forest:** Moss greens, sage, deep pine, eucalyptus, and pale birch.
6. **Vintage Pastel / Risograph:** Soft peach, dusty rose, mint, lavender, and buttercup yellow.
7. **Desert Dune:** Warm sandstones, terracotta, burnt orange, and pale limestone.

### Key Capabilities:
- **Palette Selector Dropdown / Swatches:** Located in the Layer Manager header or Settings menu.
- **Dynamic Layer Interpolation:** Automatically distributes the selected color scheme smoothly across however many layers ($2$ to $11$) are currently in the stack.
- **Per-Layer Override Retention:** Users can still click individual layer swatches to customize specific sheets after applying a palette.

---

## 2. Seamless Photographic Material Alpha Masks

### Objective
Expand the tactile paper simulation engine with custom macro-photographed alpha textures for high-tooth materials like **Craft Felt**, **Construction Paper**, **Heavy Kraft Cardstock**, and **Rough Deckle Rag**.

### Reference Specification:
See [`dev_docs/tactile_texture_capture_spec.md`](./tactile_texture_capture_spec.md) for full studio lighting, GIMP Color-to-Alpha processing, and SVG pattern integration workflows.

---

## 3. Aesthetic Filter & Line Discretization System

### Objective
Allow users to stylize the raw luminance cut patterns into distinct visual motifs (such as pixelated blocks or geometric low-poly facets) without slowing down the vector engine.

### Implementation Summary
- **Raster-Space Processing:** Filters run directly on the resampled luminance buffer prior to thresholding and vectorization in $< 1\text{ms}$.
- **Filters Included:**
  1. **Pixel Block / Voxel Mosaic:** Rectilinear quantization into clean 90° orthogonal cuts ($1\text{ mm}$–$15\text{ mm}$ block size) with Mean/Median sampling and Grid Snap.
  2. **Low-Poly / Voronoi Facets:** Geometric polygonal cell mesh with straight line segment boundaries, PRNG jitter slider ($0\%$ honeycomb to $100\%$ shards), and seed shuffle.
- **Reference Specification:** See [`dev_docs/aesthetic_filters_spec.md`](./aesthetic_filters_spec.md) for full algorithmic formulas.

---

## Completed Milestones (v1.1.0)

1. **Workspace Preferences & Persistence:** Client-side preference storage with cookie consent modal, factory reset, and workbench themes (*Drafting Pad*, *Cutting Mat*, *Neutral Gray*).
2. **Interactive Touchup Suite:** Topology-safe Island/Hole Wand deletion and Bridge Pen gap reinforcement.
3. **Tactile Paper Simulation:** Strict silhouette alpha-clipped Hot-Press Bristol and Cold-Press Watercolor shaders with per-layer GPU noise seeds.
4. **Direct Browser Print Engine:** Dedicated `@media print` isolation and `@page` 1:1 dimension matching.
5. **Custom Export Dialog:** Configurable file prefixes and custom combined SVG naming.
