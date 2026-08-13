# Luminance Cut Pattern Converter — Development Specification

## 0. Document Status

**Purpose:** Handoff specification for an LLM coding agent building a quick, client-side MVP.

**Product type:** Single-page browser application.

**Primary output:** SVG cut geometry derived from JPG/PNG raster images.

**Architecture:** Client-side only. No backend, accounts, persistence service, or server-side processing.

**Implementation principle:** Prefer a small number of explicit, deterministic modules over framework-heavy abstractions. The processing engine must be independent of the UI and testable with synthetic data.

---

# 1. Product Definition

This application converts raster images into physically cuttable, luminance-based SVG patterns.

The core transformation is:

```text
Original Image
    ↓
Working Image
    ↓
Luminance
    ↓
Threshold
    ↓
Binary Material Mask
    ↓
Manufacturability Cleanup
    ↓
Contour Extraction
    ↓
Contour Simplification / Smoothing
    ↓
Physical Output Geometry
    ↓
SVG / Print / Preview
```

The application is **not** intended to be:

- a general image editor
- an AI silhouette generator
- a semantic background-removal tool
- a general-purpose SVG editor
- a machine-specific Cricut/Silhouette integration
- a cloud application

The artistic goal is to produce deliberate, pixel-derived cut patterns suitable for stacking multiple physical layers to create luminance-like visual effects.

---

# 2. Core Product Concept

The primary use case is a **cumulative luminance stack**.

Given a grayscale image and thresholds such as:

```text
40
80
120
160
200
```

each layer represents a cumulative threshold:

```text
Layer 1 = luminance ≤ 40
Layer 2 = luminance ≤ 80
Layer 3 = luminance ≤ 120
Layer 4 = luminance ≤ 160
Layer 5 = luminance ≤ 200
```

The layers are physically stacked, with the largest-threshold layer on top.

The larger openings in upper layers reveal progressively deeper layers beneath them. This produces a physical approximation of luminance banding through layered cardstock or other sheet material.

An alternate **exclusive-band mode** is also part of MVP:

```text
Layer 1 = 0–40
Layer 2 = 40–80
Layer 3 = 80–120
Layer 4 = 120–160
Layer 5 = 160–200
Layer 6 = 200–255
```

Exclusive mode is experimental and is not the primary physical-stack workflow.

---

# 3. MVP Requirements

## 3.1 Input

Accept:

- JPG/JPEG
- PNG

The original image must remain available in memory throughout the editing session.

Do not permanently overwrite or destructively transform the source image.

---

## 3.2 Working Image

The application maintains a derived working-image representation based on the original image and transformation state.

MVP supports:

- rectangular crop
- move/position
- proportional resize
- independent X/Y scaling
- basic canvas placement

Normal resize preserves aspect ratio.

**Shift + drag** enables independent X/Y scaling.

Crop is rectangular in MVP.

The crop architecture should represent the crop as a shape object, e.g.:

```js
{
  type: "rectangle",
  geometry: { ... }
}
```

Do not implement arbitrary crop masks, oval crops, polygon crops, or second-image masks in MVP. The shape abstraction exists only so future crop shapes can be added without entangling the rest of the processing pipeline.

---

# 4. Working-Image Rasterization

The transformation from original image to working raster must use an explicit scaling/resampling strategy.

MVP strategy:

```text
nearest
```

Nearest-neighbor behavior is intentional because it preserves low-resolution pixel character and avoids introducing interpolated luminance values that were not present in the source.

Do not hardcode nearest-neighbor behavior into unrelated processing code.

The rasterization method should be represented as an engine parameter so future methods can be added.

Conceptually:

```js
rasterScaleMethod = "nearest"
```

Future methods may include other resampling strategies, but they are outside MVP.

---

# 5. Luminance Processing

Convert the working image to luminance/grayscale.

Use a deterministic luminance calculation.

The threshold control is based on a numeric luminance scale of:

```text
0–255
```

The UI should display the actual numeric threshold.

Threshold controls should support:

- slider
- keyboard adjustment
- direct numeric entry

The underlying processing engine must operate on the numeric threshold rather than an opaque "gain" value.

---

# 6. Polarity / Negative Mode

MVP supports:

- positive/default
- negative

Internally, threshold processing should resolve to semantic binary states:

```text
MATERIAL
NON_MATERIAL
```

Subsequent manufacturability processing should not care whether the material originated from dark or light pixels.

Recommended default:

> Darker pixels become material/cut areas.

Negative mode produces the complementary interpretation.

Processing order:

```text
luminance
    ↓
threshold
    ↓
polarity
    ↓
material mask
```

---

# 7. Layer Modes

## 7.1 Cumulative Mode

Primary/default mode.

Given ordered thresholds:

```text
[40, 80, 120, 160, 200]
```

generate:

```text
Layer 1 = <= 40
Layer 2 = <= 80
Layer 3 = <= 120
Layer 4 = <= 160
Layer 5 = <= 200
```

Thresholds must be monotonically ordered.

Users must not be allowed to create an unusable threshold ordering by dragging a threshold across another threshold.

If a user wants a different order, they reorder the layers rather than crossing threshold values.

Physical stack convention:

```text
TOP
Layer 5
Layer 4
Layer 3
Layer 2
Layer 1
BACKGROUND
```

Layer numbering/order must remain explicit in the internal state.

---

## 7.2 Exclusive / Band Mode

Experimental MVP mode.

Given thresholds:

```text
[40, 80, 120, 160, 200]
```

generate bands:

```text
Layer 1 = 0–40
Layer 2 = 40–80
Layer 3 = 80–120
Layer 4 = 120–160
Layer 5 = 160–200
Layer 6 = 200–255
```

The implementation should define the boundary convention consistently so every luminance value belongs to exactly one band.

The UI should make clear that this mode produces a different effect from cumulative stacking.

---

# 8. Layer Generation Controls

Single-layer use should be supported naturally.

Stack mode should provide:

- number of layers
- threshold list
- automatic threshold generation
- manual threshold editing
- layer reordering
- layer colors

Automatic generation should initially distribute thresholds evenly across the requested range.

Example:

```text
5 layers
0–255
```

might produce approximately:

```text
43
85
128
170
213
```

The exact distribution should be deterministic and documented in code/tests.

Manual threshold edits must preserve valid ordering.

---

# 9. Layer Colors

Each layer has an assignable preview color.

Colors are presentation metadata and must not affect image processing.

The same layer color should be used consistently in:

- individual layer preview
- composite stack preview
- combined SVG
- individual SVG exports unless the user later requests another export mode

Layer color must be stored in application state.

The composite preview should simulate the physical stack using the selected colors.

---

# 10. Minimum Feature Size

MVP provides one global physical **minimum feature size** setting.

Example:

```text
2 mm
```

This is a physical width constraint, not an area constraint.

The intent is:

> The generated cut pattern should not intentionally contain material or openings whose effective minimum width is below the selected minimum feature size.

This applies to:

- holes
- gaps
- bridges
- isolated islands
- narrow material regions

Do not implement separate hole/gap/island controls in MVP.

However, the engine should conceptually distinguish these feature types so future versions can assign different thresholds to them.

---

# 11. Manufacturability Semantics

The engine must distinguish:

### Island

A disconnected material region.

If its effective width is below the minimum feature size, remove it.

### Hole

A non-material region completely enclosed by material.

If its effective width is below the minimum feature size, fill it.

### Gap

A non-material region connecting to the exterior and separating material regions.

If its effective width is below the minimum feature size, fill it, thereby creating a bridge.

The relevant criterion is **minimum width / clearance**, not connected-component area.

A long, thin region may have substantial area while still violating the minimum-width constraint.

MVP does not attempt to account for the fact that some cutting machines may handle long straight narrow cuts differently from small irregular pieces. The single global width constraint is deliberately conservative and artistically useful.

---

# 12. Physical Measurement

Manufacturability constraints must be evaluated in physical output units, not raw source pixels.

For example:

```text
minimumFeatureSize = 2 mm
```

must mean approximately the same physical constraint regardless of whether the source image is:

```text
100 × 100 px
```

or:

```text
4000 × 4000 px
```

The implementation may internally convert physical units into raster/geometry units as appropriate, but the public engine contract is physical.

---

# 13. Recommended Manufacturing Pipeline

The conceptual pipeline is:

```text
binary material mask
        ↓
manufacturability cleanup
        ↓
clean binary material mask
        ↓
connected components / topology
        ↓
contour extraction
        ↓
contour simplification
        ↓
controlled smoothing
        ↓
final geometry validation
        ↓
SVG geometry
```

Manufacturability cleanup is primarily a raster/topology operation.

Do not build the MVP around repeated raster → vector → raster → vector conversions.

The clean binary mask should be the authoritative source for vector topology.

---

# 14. Manufacturability Algorithm Contract

The implementation may use appropriate binary morphology, distance transforms, connected-component analysis, or other deterministic techniques.

The exact algorithm is an implementation choice.

The behavior is not.

The algorithm must reliably satisfy:

1. Tiny isolated material regions are removed.
2. Tiny enclosed holes are filled.
3. Tiny exterior-connected gaps are filled.
4. Features above the minimum width are retained whenever practical.
5. Classification is based on width/clearance rather than area alone.
6. Positive and negative modes produce equivalent semantic processing after polarity conversion.
7. Cleanup occurs before final contour vectorization.

A distance-transform or equivalent local-clearance approach is recommended because minimum width is the actual semantic requirement.

---

# 15. Contour Extraction

After manufacturability cleanup, extract vector contours from the clean binary mask.

The result must preserve:

- connected components
- holes
- nesting
- topology

The vector representation should distinguish material contours from hole contours.

SVG should use appropriate fill rules, preferably:

```text
evenodd
```

for compound paths where appropriate.

---

# 16. Contour Simplification and Smoothing

MVP provides a user-adjustable smoothing control:

```text
0–100
```

Default:

```text
0
```

At 0, the result should retain the intentionally pixel-derived/stair-stepped aesthetic.

Higher values progressively soften/smooth the contours.

The intended continuum is:

```text
0 = strongly pixelated
100 = maximally smooth within MVP constraints
```

Smoothing is a contour-style operation, not a thresholding operation.

---

# 17. Smoothing Invariants

Smoothing must not knowingly:

- create a new hole
- remove an existing valid hole
- merge previously separate components
- split a component
- change layer topology
- create a new narrow feature below the minimum feature constraint

The goal is:

> Smoothing changes contour character, not topology.

The exact smoothing algorithm is an implementation choice.

Do not add a second complete manufacturability-processing pass after smoothing unless testing demonstrates that it is necessary.

Prefer a constrained smoothing implementation that respects the established topology and minimum-feature contract.

---

# 18. Final Geometry Validation

After contour processing, perform lightweight validation.

Validate at least:

- no invalid path geometry
- expected connected-component count/topology
- expected hole relationships
- no obvious self-intersections introduced by smoothing
- minimum-feature constraints have not knowingly been violated
- physical dimensions are correct

If smoothing cannot safely operate at the requested level for a particular geometry, the implementation may constrain the effective maximum smoothing for that geometry.

Do not silently alter the threshold or minimum-feature setting to compensate.

---

# 19. Crop / Working Image Transformation Pipeline

The working-image model should be derived from the original image.

Conceptually:

```text
original image
    ↓
crop
    ↓
translation
    ↓
scaleX / scaleY
    ↓
rasterization
    ↓
luminance
```

Crop, move, and resize do not permanently mutate the source image.

Changing canvas dimensions, threshold values, polarity, smoothing, or layer parameters must regenerate derived output from authoritative state.

Avoid cumulative image degradation.

---

# 20. Canvas and Physical Output

The application must distinguish:

### Processing coordinates

Raster/image coordinate space.

### Output coordinates

Physical canvas space.

Canvas dimensions should support:

- inches
- millimeters
- centimeters

Provide useful presets, including common paper/cutting sizes, plus custom dimensions.

Suggested MVP presets:

- 4 × 6 in
- 5 × 7 in
- 8.5 × 11 in
- 11 × 8.5 in
- 12 × 12 in
- custom

The application should support portrait/landscape orientation naturally.

---

# 21. Image Placement

The working image must be independently controllable from the canvas.

Support:

- drag to position
- proportional resize
- Shift + drag for independent X/Y scaling
- crop

Image scale/position must not be baked into the canvas dimensions.

Changing canvas size must not unexpectedly resize the working image.

The SVG geometry must ultimately map the working image into the chosen physical output dimensions.

---

# 22. Margins

MVP supports a configurable canvas margin.

Margins are layout/output concerns, not image-processing concerns.

Suggested default:

```text
0.25 in
```

The application must not allow registration marks or cut geometry to unintentionally overlap the configured margin unless explicitly designed to do so.

---

# 23. Registration Marks

Registration marks are optional output/layout elements.

They are not part of the image-processing or luminance-processing pipeline.

They should be generated identically for each layer so that future cutting devices/material workflows can use them for alignment.

For Cricut use, users may instead rely on page/canvas edges.

MVP should therefore provide:

```text
Registration marks: On / Off
```

but should not attempt machine-specific alignment protocols.

---

# 24. Preview System

The application should have at least these conceptual views:

### Source Preview

Shows the original image.

### Threshold / Binary Preview

Shows the current material mask before or alongside manufacturability cleanup.

### Cut Preview

Shows the actual generated vector geometry.

### Layer Preview

Shows individual layers using assigned colors.

### Composite Stack Preview

Simulates the physical stacked object by rendering layers in their actual stack order.

The composite stack preview is important and must use the same generated geometry as export.

Do not implement a visually approximate second tracing system for the composite preview.

---

# 25. Composite Stack Behavior

In cumulative mode, layers should render in physical order:

```text
TOP
highest threshold
...
lowest threshold
BACKGROUND
```

The composite simulator should place the selected layer colors according to this order and render their cutouts as actual transparent openings.

The goal is to let the user answer:

> "If I cut these sheets and physically stack them, what will the resulting object look like?"

---

# 26. State Model

Maintain authoritative application state.

Conceptually:

```js
{
  sourceImage: {...},

  workingImage: {
    crop: {...},
    position: {...},
    scaleX: 1,
    scaleY: 1,
    rasterScaleMethod: "nearest"
  },

  canvas: {
    width: ...,
    height: ...,
    unit: "in",
    margin: ...
  },

  processing: {
    mode: "cumulative",
    thresholds: [...],
    negative: false,
    minimumFeatureSize: ...,
    smoothing: 0
  },

  layers: [
    {
      id: "...",
      threshold: ...,
      color: "...",
      order: ...
    }
  ],

  output: {
    registrationMarks: false,
    exportMode: ...
  }
}
```

The exact schema may differ, but the separation of concerns must remain.

---

# 27. Derived State

Do not treat generated raster masks, contours, SVG strings, or previews as authoritative application state.

They are derived artifacts.

When relevant parameters change, regenerate them from authoritative state.

For example:

```text
threshold changes
    ↓
recalculate mask
    ↓
cleanup
    ↓
vectorize
    ↓
render preview
    ↓
export uses same geometry
```

Changing output dimensions should not require redoing luminance processing if the underlying geometry remains unchanged.

---

# 28. Undo / Redo

Implement basic:

```text
Ctrl+Z
Ctrl+Shift+Z
```

and reasonable Mac equivalents where appropriate.

Undo/redo is required for:

- crop
- move
- resize
- free X/Y scaling
- related basic composition edits

Threshold, smoothing, and similar parameter changes do not need to create individual undo entries in MVP.

However, all such parameters must exist in the snapshot/state schema so a more comprehensive undo model can be added later.

Do not snapshot and duplicate the source image for every history state.

Snapshots should store state references/values.

---

# 29. Suggested History Model

Conceptually:

```js
history = {
  past: [...snapshots],
  present: snapshot,
  future: [...]
}
```

A user action that changes an undoable editing state creates a snapshot.

Redo history is invalidated after a new divergent edit.

Generated geometry is never stored as the source of truth.

---

# 30. SVG Output

SVG is the canonical output format.

Each layer should be represented by one or more compound paths as necessary.

Recommended semantics:

```xml
<g id="layer-03" data-threshold="120">
  <path
    d="..."
    fill="#..."
    fill-rule="evenodd"
    stroke="none"/>
</g>
```

Combined SVG should preserve distinct layer groups.

Individual layer SVGs should contain only the corresponding layer.

Use stable IDs/names.

Where practical, include useful metadata such as:

- layer number
- threshold
- mode
- physical dimensions

Do not require external applications to interpret proprietary metadata in order to cut the SVG.

---

# 31. Export Modes

MVP supports:

### Combined SVG

One SVG containing all layers/groups.

### Layer Package

A ZIP containing individual SVG files.

Example:

```text
layer-01-threshold-040.svg
layer-02-threshold-080.svg
layer-03-threshold-120.svg
layer-04-threshold-160.svg
layer-05-threshold-200.svg
```

The exact filename padding should be deterministic.

A future manifest file may be added but is not required for MVP.

---

# 32. Printing

Provide built-in print functionality.

MVP print options:

- print individual selected layer
- print composite stack preview

The print layout should respect the chosen physical dimensions as closely as browser printing permits.

The print UI should explicitly communicate:

> Print at 100% / Actual Size. Disable "Fit to Page" or equivalent browser scaling.

The application cannot fully control browser print settings.

---

# 33. Important Physical-Output Principle

SVG width/height and viewBox must preserve the intended physical dimensions.

Changing:

```text
8 × 10 in
```

to:

```text
12 × 12 in
```

should change physical output mapping without changing the underlying image-derived geometry.

The geometry should remain in a stable coordinate system until physical output mapping.

---

# 34. No Semantic Background Removal

The application must not attempt to understand the subject of the photograph.

A photograph of a person against a wall is processed according to luminance.

The application is a:

> luminance-based cut pattern converter

not a:

> silhouette maker / subject segmentation system.

A solid physical backing/background is outside the application's concern.

---

# 35. Explicit MVP Non-Goals

Do not implement:

- AI background removal
- semantic subject detection
- arbitrary vector node editing
- Bézier drawing tools
- general SVG editing
- color tracing
- gradient tracing
- machine-specific export dialects
- direct Cricut/Silhouette integrations
- cloud storage
- accounts
- backend
- project persistence
- image libraries
- arbitrary crop masks
- oval/circular crops
- polygon crops
- second-image crop masks
- per-feature-type minimum dimensions
- selective feature thickening
- sophisticated material-specific cutting models
- automatic machine calibration

These may be considered later but should not shape MVP implementation beyond clean module boundaries.

---

# 36. Architecture

The application should be organized around a pure processing engine and a thin UI layer.

Suggested conceptual modules:

```text
/source
    image loading and source representation

/working-image
    crop
    transform
    rasterization

/luminance
    grayscale conversion
    thresholding
    polarity

/manufacturing
    connected components
    hole analysis
    gap analysis
    island analysis
    minimum-feature cleanup

/vector
    contour extraction
    contour simplification
    smoothing
    geometry validation

/layout
    physical canvas
    margins
    registration marks
    scaling

/layers
    cumulative masks
    exclusive bands
    layer ordering
    colors

/render
    source preview
    binary preview
    cut preview
    composite stack preview

/export
    SVG
    ZIP
    print

/state
    authoritative application state
    history / undo / redo
```

Exact folder/module names may differ.

The important requirement is that the geometry engine must not depend on DOM UI state.

---

# 37. Single Geometry Source of Truth

Preview, composite simulation, print, and SVG export must consume the same generated geometry.

Do not maintain separate implementations for:

- screen preview
- SVG export
- printing
- composite visualization

The pipeline should generate a canonical geometry representation, and all output consumers should render from it.

---

# 38. Testability Requirement

The processing engine must be deterministic and independently testable.

Do not require browser UI interaction to test core image-processing behavior.

Synthetic raster fixtures should be generated programmatically wherever practical.

The test suite should be considered part of the MVP, not optional polish.

For an LLM-built application, robust automated geometry tests are explicitly preferred over minimizing test code.

---

# 39. Required Geometry Tests

At minimum, include synthetic tests for:

### Islands

- isolated large island survives
- isolated tiny island is removed

### Holes

- large enclosed hole survives
- tiny enclosed hole is filled

### Gaps

- wide exterior gap survives
- narrow exterior gap is bridged

### Bridges

- material bridge above minimum width survives
- bridge below minimum width is created/merged appropriately

### Components

- multiple disconnected components remain independent
- cleanup does not unexpectedly merge sufficiently separated components

### Nested topology

- holes inside connected regions are preserved
- multiple holes are handled correctly
- nested topology remains valid after vectorization

### Polarity

- positive and negative modes produce complementary masks as expected

### Thresholds

- threshold behavior is deterministic
- boundary values follow documented inclusive/exclusive semantics

### Cumulative mode

- thresholds generate monotonically expanding material masks

### Exclusive mode

- each luminance value belongs to exactly one band

### Smoothing

- smoothing 0 preserves expected pixel-derived contour
- smoothing changes contour character
- smoothing preserves topology
- smoothing does not knowingly violate minimum-feature constraints

### Physical scaling

- a known raster feature maps to the expected physical dimension
- minimum-feature interpretation remains stable across different source resolutions

### SVG

- generated SVG parses successfully
- path data is valid
- fill rules behave correctly
- physical dimensions are correct
- combined SVG contains expected layer groups
- individual SVG contains only its layer

---

# 40. Test Fixtures Should Include Edge Cases

Include deliberately awkward patterns such as:

```text
tiny isolated dot
long thin line
tiny rectangular hole
long narrow hole
tiny gap
long narrow gap
two nearly touching shapes
nested holes
multiple disconnected islands
checkerboard-like patterns
single-pixel structures
very low-resolution source masks
```

The purpose is not to make the algorithm perfect for every pathological case.

The purpose is to prevent regressions in the behavior the app explicitly promises.

---

# 41. State/Interaction Tests

Also test:

- crop changes working geometry
- moving the working image does not modify source data
- proportional resize preserves aspect ratio
- Shift/free-scale permits independent X/Y scaling
- threshold changes regenerate geometry from the original/working source
- negative mode can be toggled after other edits
- canvas size changes do not mutate source image data
- smoothing changes do not alter threshold state
- layer colors do not affect geometry
- changing one threshold does not alter unrelated thresholds
- layer reordering preserves threshold validity
- undo restores prior editing state
- redo restores undone editing state
- divergent edit clears redo history

---

# 42. UI Philosophy

The interface should feel like a focused utility, not a professional graphics editor.

Prioritize:

- immediate visual feedback
- obvious controls
- minimal modal dialogs
- direct manipulation
- numeric values where precision matters
- clear distinction between image editing and cut processing

The application should make the workflow obvious without requiring a tutorial.

The user should be able to:

1. drop a JPEG/PNG
2. crop/position/resize it
3. choose threshold/layers
4. adjust manufacturability
5. inspect the cut result
6. preview the stack
7. export

without leaving the page.

---

# 43. Suggested UI Organization

A reasonable layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Image / Canvas / Preview                                   │
│                                                            │
│                     WORK AREA                              │
│                                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘

┌───────────────────┐  ┌─────────────────────────────────────┐
│ Image             │  │ Processing                          │
│ Crop              │  │ Mode                                │
│ Scale             │  │ Threshold(s)                        │
│ Position          │  │ Negative                            │
│                   │  │ Minimum feature                     │
│                   │  │ Smoothing                           │
├───────────────────┤  ├─────────────────────────────────────┤
│ Canvas            │  │ Layers                              │
│ Size              │  │ Colors                              │
│ Margin            │  │ Ordering                             │
│ Registration      │  │                                     │
├───────────────────┤  ├─────────────────────────────────────┤
│ Export / Print    │  │ Preview mode                        │
└───────────────────┘  └─────────────────────────────────────┘
```

Exact UI layout is implementation-flexible.

---

# 44. Performance Expectations

This is a client-side utility, so prioritize responsiveness for ordinary consumer images.

The engine should avoid unnecessary full-resolution recomputation where possible.

Reasonable optimization opportunities:

- cache decoded source image
- cache working raster when only output layout changes
- cache luminance raster when only output layout changes
- cache masks when only layer colors change
- cache geometry when only print/export settings change

Do not prematurely optimize the algorithm at the expense of clarity.

If Web Workers are useful for keeping large-image processing responsive, they may be introduced, but they are not required unless profiling demonstrates a need.

---

# 45. Error Handling

Handle at minimum:

- unsupported file type
- corrupt/unreadable image
- impossible/invalid dimensions
- invalid threshold ordering
- invalid minimum feature size
- export failure
- print-preview failure where detectable

Errors should be understandable to a nontechnical user.

Do not expose stack traces in the primary UI.

---

# 46. Data Persistence

MVP does not require persistent projects.

A page reload may discard the current project.

Do not add a backend.

Do not add accounts.

Do not add cloud storage.

Local browser persistence may be considered later but is not required.

---

# 47. Accessibility / Input

Support normal mouse interaction and keyboard access for numeric controls.

Keyboard interactions should include:

- arrow-key threshold adjustment
- direct numeric entry
- Ctrl/Cmd+Z
- Ctrl/Cmd+Shift+Z
- Escape to cancel crop/active transient interactions

Do not make Shift-dependent free scaling the only way to access non-proportional scaling if that becomes an accessibility problem; the underlying state model must support it regardless.

---

# 48. Implementation Invariants

The following are non-negotiable architectural invariants:

1. Original image data is never destructively overwritten.
2. Working image state is derived from original image plus transformation parameters.
3. Processing parameters are explicit state.
4. Generated masks and geometry are derived state.
5. Manufacturability operates in physical terms even when internally implemented in raster coordinates.
6. Polarity resolves to semantic material/non-material states before manufacturing logic.
7. Manufacturing cleanup precedes authoritative contour extraction.
8. Smoothing does not intentionally change topology.
9. Preview and export use the same canonical geometry.
10. Combined and individual SVG outputs derive from the same layer geometry.
11. Layer threshold ordering remains valid.
12. Crop/resize/position operations do not permanently degrade source image quality.
13. The raster scaling method is configurable even though MVP uses nearest-neighbor.
14. The processing engine can be tested without the UI.
15. Core behavior is covered by deterministic automated tests.

---

# 49. Recommended Development Order

Build in this order:

## Phase 1 — Engine foundation

- source image loading
- working-image transforms
- nearest-neighbor rasterization abstraction
- luminance conversion
- thresholding
- polarity

## Phase 2 — Manufacturing

- connected components
- holes
- gaps
- islands
- minimum-feature cleanup
- synthetic geometry tests

## Phase 3 — Vectorization

- contour extraction
- compound paths
- topology tests
- SVG generation

## Phase 4 — Contour styling

- simplification
- smoothing slider
- topology/feature validation
- smoothing tests

## Phase 5 — Layers

- cumulative masks
- exclusive bands
- threshold generation
- threshold ordering
- layer colors
- layer ordering

## Phase 6 — Canvas / composition

- physical dimensions
- margins
- crop
- move
- resize
- free X/Y scaling
- undo/redo

## Phase 7 — Preview

- source
- binary
- cut geometry
- individual layer
- composite stack simulation

## Phase 8 — Output

- combined SVG
- individual SVGs
- ZIP package
- registration marks
- print individual layer
- print composite

## Phase 9 — Integration testing

Test complete workflows from image input through SVG output.

---

# 50. Definition of Done

MVP is complete when a user can:

1. Load a JPG or PNG.
2. Crop it.
3. Move and resize it.
4. Independently stretch it with free X/Y scaling.
5. Set a physical canvas size.
6. Convert it to luminance.
7. Set a numeric luminance threshold.
8. Toggle positive/negative polarity.
9. Set a minimum physical feature size.
10. Generate a usable single cut layer.
11. Generate multiple cumulative layers.
12. Generate experimental exclusive bands.
13. Generate automatically distributed thresholds.
14. Adjust thresholds manually while maintaining valid ordering.
15. Reorder layers.
16. Assign colors to layers.
17. Adjust contour smoothing.
18. Inspect the cleaned cut geometry.
19. Preview the physical stack using layer colors.
20. Add margins.
21. Optionally add registration marks.
22. Export a combined SVG.
23. Export individual SVGs as a package.
24. Print an individual layer.
25. Print the composite.
26. Undo/redo basic composition edits.
27. Change earlier processing settings at any time without losing source-image fidelity.
28. Pass the automated geometry/state/output test suite.

---

# 51. Final Engineering Principle

This project is intentionally quick and dirty at the product level, but **not careless at the geometry-engine level**.

The application should favor:

- deterministic transformations
- explicit state
- pure processing functions
- testable geometry
- simple UI
- no backend
- no unnecessary abstraction

The coding agent should not invent product behavior where this document establishes a contract.

Where implementation details remain unspecified, choose the simplest robust client-side implementation that satisfies the behavioral requirements and tests.

The application should remain small enough to understand, modify, and extend by an LLM coding agent.
