# Aesthetic Filters & Line-Style Discretization Specification

## Overview
Cut Up utilizes a raster-to-vector pipeline where working images are converted to grayscale luminance, thresholded into binary masks, filtered for manufacturability (island clearance / gap bridging), and finally vectorized into SVG contours using Potrace.

By inserting **Aesthetic Discretization Filters** into the raster space (operating on the luminance buffer or binary mask before vector tracing), transformations execute in milliseconds (< 2–5ms) with zero CPU lag, while Potrace automatically handles clean, non-bloated vector curve/polygon generation.

---

## 1. Filter Catalog & Technical Specifications

### 1.1 Pixelation / Block Mosaic (Priority #1)
- **Concept:** Quantizes the luminance field into rectilinear grid cells of configurable physical/pixel dimensions.
- **Algorithm:**
  1. Subdivide the $W \times H$ canvas into blocks of size $B \times B$ (where $B$ corresponds to $1\text{ mm}$ to $15\text{ mm}$ based on canvas resolution).
  2. Compute the mean or median luminance for each block.
  3. Assign all pixels within the block to that computed value prior to layer thresholding.
  4. Potrace vectorization traces orthogonal 90° edges without curve fitting.
- **Parameters:**
  - `Block Size`: $1\text{ mm}$ to $15\text{ mm}$ (or $4\text{ px}$ to $64\text{ px}$).
  - `Grid Snap`: Lock block boundaries to integer grid intervals.
- **Visual Aesthetic:** Retro 8-bit / isometric voxel / Minecraft style. Ideal for clean laser and vinyl blade cuts with zero blade drag tearing.

---

### 1.2 Low-Poly / Voronoi Facets
- **Concept:** Subdivides the image space into a geometric Voronoi tessellation where each polygon adopts the average luminance of its enclosed area.
- **Algorithm:**
  1. Generate $N$ seed points (uniform random or luminance-weighted blue noise).
  2. Compute the Voronoi diagram / Delaunay triangulation across the canvas printable area.
  3. Sample mean luminance inside each Voronoi polygon cell.
  4. Threshold cells to generate polygonal binary masks.
- **Parameters:**
  - `Facet Count / Density`: $50$ to $1000$ cells.
  - `Jitter / Regularity`: Controls geometric randomness vs. hexagonal grid alignment.
- **Visual Aesthetic:** Modern geometric low-poly / stained-glass / folded origami look. All cut segments are clean straight lines.

---

### 1.3 Topographic / Elevation Contours
- **Concept:** Creates smooth, sweeping organic contour lines reminiscent of geographic elevation maps or stacked laser-cut plywood landscapes.
- **Algorithm:**
  1. Apply a multi-pass bilateral / geodesic blur to the luminance buffer to suppress micro-textures while preserving major tonal boundaries.
  2. Quantize luminance into discrete steps prior to layer evaluation.
- **Parameters:**
  - `Contour Smoothness`: 1 to 10 iterations.
  - `Edge Preservation`: Threshold for keeping high-contrast feature edges sharp.
- **Visual Aesthetic:** Topographic elevation maps, organic flowing contour art.

---

### 1.4 Linear Woodcut / Banknote Engraving Ribbons
- **Concept:** Replaces solid fills with parallel scanline ribbons (horizontal, vertical, or diagonal) whose line thickness modulates with luminance.
- **Algorithm:**
  1. Define a periodic carrier function $S(x, y)$ at angle $\theta$ with pitch $P$.
  2. Modulate line thickness: a pixel is material if $(S(x, y) \pmod P) / P \le \text{normalized luminance}$.
  3. Intersect with the layer's luminance threshold.
- **Parameters:**
  - `Ribbon Angle`: $0^\circ$ (horizontal), $45^\circ$ (diagonal), $90^\circ$ (vertical).
  - `Ribbon Pitch`: $2\text{ mm}$ to $10\text{ mm}$.
- **Visual Aesthetic:** Vintage woodcut, banknote engraving, architectural shading louvers.

---

### 1.5 Hexagonal / Honeycomb Matrix
- **Concept:** Discretizes the luminance buffer into an isometric hexagonal tiling.
- **Algorithm:**
  1. Map pixel coordinates $(x, y)$ to an axial hexagonal grid coordinate system $(q, r)$.
  2. Average luminance per hexagon cell and threshold.
- **Parameters:**
  - `Cell Radius`: $2\text{ mm}$ to $12\text{ mm}$.
- **Visual Aesthetic:** Sci-fi / architectural honeycomb mesh.

---

### 1.6 Halftone Screen (Pop-Art Dots / Diamonds)
- **Concept:** Simulates halftone dot matrices with variable dot radii according to luminance.
- **Algorithm:**
  1. Compare luminance to a circular or diamond dot growth matrix.
  2. Apply the existing minimum feature clearance filter so dots near the threshold merge into contiguous sheets rather than loose confetti.
- **Parameters:**
  - `Screen Frequency (LPI / Pitch)`: $1\text{ mm}$ to $8\text{ mm}$.
  - `Dot Shape`: Circular, Diamond, or Square.
- **Visual Aesthetic:** Roy Lichtenstein pop-art, vintage comic book printing.

---

## 2. Pipeline Integration Architecture

```text
Source Image
    ↓
Working Image Resample (Nearest)
    ↓
Luminance Buffer [0..255]
    ↓
[AESTHETIC DISCRETIZATION FILTER] (Block / Voronoi / Topo / Ribbons / Hex / Halftone)
    ↓
Layer Cutout Thresholding (val <= Tk)
    ↓
Morphological Min Clearance Filter (Island/hole suppression)
    ↓
Potrace Vector Tracing Engine
    ↓
SVG Cut Geometry & Composite Simulation
```
