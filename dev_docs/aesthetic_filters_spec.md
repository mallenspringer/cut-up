# Aesthetic Filters & Line-Style Discretization Specification

## Overview
Cut Up utilizes a high-performance raster-to-vector pipeline where working images are converted to grayscale luminance, thresholded into binary layer masks, filtered for physical manufacturability (island clearance / gap bridging), and vectorized into SVG cut contours using Potrace.

By inserting **Aesthetic Discretization Filters** into the luminance processing stage, transformations execute in $< 1\text{ms}$ with zero CPU lag, while Potrace automatically produces clean, non-bloated vector paths.

---

## 1. Supported Aesthetic Filters

### 1.1 Pixelation / Block Mosaic
- **Concept:** Quantizes the luminance field into rectilinear grid cells of configurable physical dimensions.
- **Algorithm:**
  1. Subdivide the image bounds into square blocks of size $B \times B$ ($1.0\text{ mm}$ to $15.0\text{ mm}$).
  2. Compute the mean or median luminance for each block.
  3. Assign all pixels within the block to that computed value prior to layer thresholding.
  4. Potrace vectorization traces clean 90° orthogonal edges without curve fitting.
- **Parameters:**
  - `Block Size`: $1.0\text{ mm}$ to $15.0\text{ mm}$.
  - `Corner Geometry`: `90° Crisp Cuts` (strict parallel/perpendicular lines) vs. `Rounded / Soft` (filleted voxel corners).
  - `Sampling`: `Mean` (smooth tonal transitions) vs. `Median` (high-contrast edges).
  - `Grid Snap`: Lock block boundaries to integer grid intervals.
- **Visual Aesthetic:** Retro 8-bit / isometric voxel / Minecraft style. Ideal for clean laser and vinyl blade cuts with zero blade drag tearing.

---

### 1.2 Low-Poly / Voronoi Facets
- **Concept:** Subdivides the image space into a geometric Voronoi tessellation where each polygon adopts the average luminance of its enclosed area.
- **Algorithm:**
  1. Generate $N$ seed points using a deterministic PRNG with user-controllable jitter.
  2. Map pixels to their nearest Voronoi seed center.
  3. Sample mean or median luminance inside each Voronoi polygon cell.
  4. Threshold cells to generate polygonal binary masks.
- **Parameters:**
  - `Facet Density`: $30$ to $500$ cells.
  - `Jitter / Regularity`: $0\%$ (Hexagonal Honeycomb) to $100\%$ (Crystalline Organic Shards).
  - `Cut Geometry`: `Straight Cutlines` (sharp straight-line polygons) vs. `Rounded / Soft` (filleted corners).
  - `Sampling`: `Mean` vs. `Median`.
  - `Seed Shuffle`: Re-rolls random facet distribution.
- **Visual Aesthetic:** Modern geometric low-poly / stained-glass / folded origami look. All cut segments are clean straight lines.

---

## 2. Pipeline Integration Architecture

```text
Source Image
    ↓
Working Image Resample (Nearest)
    ↓
Luminance Buffer [0..255]
    ↓
[AESTHETIC DISCRETIZATION FILTER] (Block Mosaic / Voronoi Facets)
    ↓
Layer Cutout Thresholding (val <= Tk)
    ↓
Morphological Min Clearance Filter (Island/hole suppression)
    ↓
Potrace Vector Tracing Engine
    ↓
SVG Cut Geometry & Composite Simulation
```
