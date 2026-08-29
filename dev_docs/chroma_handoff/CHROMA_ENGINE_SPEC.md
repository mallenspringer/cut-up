# CutUp Chroma — Core Engine & Mathematics Specification (CHROMA_ENGINE_SPEC.md)

---

## 1. Mathematical Foundations & Color Space

The Chroma engine relies on **$\text{OKLab}$ and $\text{OKLCH}$** (developed by Björn Ottosson). Unlike traditional sRGB or CIELAB, OKLab provides superior perceptual uniformity, eliminates the blue-shifts-to-purple artifact when saturation increases, and models human eye lightness and chroma with true Euclidean linearity.

```text
[sRGB (0..255)] ──► [Linear RGB] ──► [Cone LMS] ──► [Non-linear LMS³] ──► [OKLab (L, a, b)] ──► [OKLCH (L, C, H)]
```

### 1.1 Step 1: sRGB to Linear RGB (De-gamma)
For each channel $V \in \{R, G, B\}$ normalized to $[0.0, 1.0]$:
$$V_{\text{linear}} = \begin{cases} \frac{V}{12.92} & \text{if } V \le 0.04045 \\ \left(\frac{V + 0.055}{1.055}\right)^{2.4} & \text{if } V > 0.04045 \end{cases}$$

### 1.2 Step 2: Linear RGB to Cone Response (LMS)
$$\begin{bmatrix} l \\ m \\ s \end{bmatrix} = \mathbf{M}_1 \begin{bmatrix} R_{\text{linear}} \\ G_{\text{linear}} \\ B_{\text{linear}} \end{bmatrix}$$
Where $\mathbf{M}_1$ is:
$$\mathbf{M}_1 = \begin{bmatrix} 
0.4122214708 & 0.5363325363 & 0.0514459929 \\
0.2119034982 & 0.6806995451 & 0.1073969566 \\
0.0883024619 & 0.2817188376 & 0.6299787005 
\end{bmatrix}$$

### 1.3 Step 3: Non-linear Cube Root Transform
$$l' = \sqrt[3]{l}, \quad m' = \sqrt[3]{m}, \quad s' = \sqrt[3]{s}$$

### 1.4 Step 4: LMS to OKLab Matrix Transform
$$\begin{bmatrix} L \\ a \\ b \end{bmatrix} = \mathbf{M}_2 \begin{bmatrix} l' \\ m' \\ s' \end{bmatrix}$$
Where $\mathbf{M}_2$ is:
$$\mathbf{M}_2 = \begin{bmatrix} 
0.2104542553 & 0.7936177850 & -0.0040720468 \\
1.9779984951 & -2.4285922050 & 0.4505937099 \\
0.0259040371 & 0.7827717662 & -0.8086757660 
\end{bmatrix}$$

* **$L \in [0.0, 1.0]$**: Perceptual Lightness.
* **$a \in [-0.4, 0.4]$**: Green ($-$) to Red ($+$) axis.
* **$b \in [-0.4, 0.4]$**: Blue ($-$) to Yellow ($+$) axis.

### 1.5 Step 5: OKLab to OKLCH (Cylindrical Coordinates)
* **Chroma ($C$):** $C = \sqrt{a^2 + b^2}$
* **Hue Angle ($H$):** $H = \text{atan2}(b, a)$ (in degrees: $[0^\circ, 360^\circ)$)

---

## 2. Automated Palette Extraction: $K$-Means Clustering

To automatically discover the dominant cardstock colors on image upload, the engine runs $K$-Means clustering directly in $\text{OKLab}$ coordinate space.

### 2.1 Fast-Sampling Buffer
To achieve sub-$100\text{ms}$ performance:
1. Downsample the source image to a maximum dimension of $200\text{ px}$ (yielding $\approx 40,000$ sample pixels).
2. Convert all pixels to OKLab coordinates $(L_i, a_i, b_i)$.

### 2.2 $K$-Means++ Initialization
1. Choose the first centroid $c_1$ uniformly at random from the sample pixels.
2. For each subsequent centroid $c_j$ ($j = 2..K$), pick a pixel with probability proportional to $D(x)^2$, where $D(x)$ is the shortest distance from $x$ to any already chosen centroid.

### 2.3 Lloyd's Iteration Loop (Max 25 iterations or $\epsilon < 0.001$)
1. **Assignment Step:** Assign each sample pixel to its nearest centroid $c_k$ using Euclidean distance in OKLab:
   $$D(p, c_k) = \sqrt{(L_p - L_k)^2 + (a_p - a_k)^2 + (b_p - b_k)^2}$$
2. **Update Step:** Recalculate each centroid as the geometric mean of all pixels assigned to it:
   $$c_k = \frac{1}{|S_k|} \sum_{p \in S_k} p$$
3. Convert final OKLab centroids back to sRGB hex codes for cardstock layer swatches.

### 2.4 Default Z-Stack Ordering
After extraction, layers are automatically sorted by Lightness $L$ in ascending order:
* **Layer 0 (Base Foundation):** Darkest color ($L_{\min}$).
* **Layer $N$ (Top Sheet):** Lightest color ($L_{\max}$).
* *User can freely drag-and-drop to reorder Z-stacking in the UI.*

---

## 3. Pixel Classification & Artist-Weighted $\Delta E$ Metric

When mapping full-resolution image pixels to the active palette swatches, CutUp Chroma uses a weighted $\text{OKLCH}$ distance metric that gives artists direct control over how colors separate into layers:

$$\Delta E_{\text{artist}} = \sqrt{w_L \cdot (\Delta L)^2 + w_C \cdot (\Delta C)^2 + w_H \cdot (\Delta H_{\text{rad}} \cdot \bar{C})^2}$$

Where:
* $\Delta L = L_p - L_k$
* $\Delta C = C_p - C_k$
* $\Delta H_{\text{rad}} = 2 \sin\left(\frac{H_p - H_k}{2}\right)$ (true circular angular distance in radians)
* $\bar{C} = \sqrt{C_p \cdot C_k}$ (chroma weighting so hue differences in near-gray colors do not trigger false classifications)

### Artist Control Parameters:
1. **Hue Weight ($w_H \in [0.0, 3.0]$, default $1.0$):**
   * Higher values aggressively separate distinct colors (e.g., isolating a pale yellow petal from a pale pink petal even if brightness is identical).
2. **Lightness Weight ($w_L \in [0.0, 3.0]$, default $1.0$):**
   * Higher values prioritize separating shadows from highlights.
3. **Chroma / Desaturation Floor ($C_{\min} \in [0.0, 0.2]$, default $0.02$):**
   * Any pixel with $C_p < C_{\min}$ is treated as neutral and assigned to the closest achromatic/gray swatch, preventing noisy color speckles in background gradients.

---

## 4. Physical Underlap & Seam Bleed Dilation

```text
[ Top Sheet (Layer 2) ] ────────►  |══════| (Top Edge)
                                   |      |
[ Bottom Sheet (Layer 1) ] ─────►  |══════════════| (Underlap Bleed +0.5mm)
```

In physical cardstock layering, if Layer 1's cutout boundary perfectly touches Layer 2's boundary at a 1:1 mathematical line, minor cutting blade kerf or glue misalignment will expose ugly white gaps.

### The Underlap Algorithm:
For each Layer $k$ in the stack from top ($N$) down to bottom ($0$):

1. **Raw Cluster Mask ($M_k^{\text{raw}}$):**
   $$M_k^{\text{raw}}(x, y) = \begin{cases} 1 & \text{if pixel }(x, y)\text{ is classified as Color }k \\ 0 & \text{otherwise} \end{cases}$$

2. **Morphological Noise & Island Cleanup:**
   Apply morphological opening/closing with circular structuring element of radius $R_{\text{clean}} = \text{calculateTurdSize}(\text{minimumFeatureSize})$ to eliminate single-pixel speckles.

3. **Cumulative Physical Occlusion:**
   In a physical stack, Layer $k$ must exist wherever Color $k$ is visible, **PLUS** extend underneath all upper layers $j > k$ that physically border it:
   $$M_k^{\text{underlap}} = M_k \cup \left( \mathcal{D}_{R_{\text{bleed}}}(M_k) \cap \bigcup_{j > k} M_j \right)$$
   Where:
   * $\mathcal{D}_{R_{\text{bleed}}}$ is the binary morphological dilation operator.
   * $R_{\text{bleed}} = \text{underlapBleedMm} \times \text{pxPerMm}$ (default: $+0.5\text{mm}$).
   * This guarantees that Layer $k$ dilates **only underneath higher overlapping layers**, never expanding into empty void space.

---

## 5. Vectorization Pipeline with Potrace

The final cleaned and dilated binary mask $M_k^{\text{underlap}}$ for each layer is passed directly into the Potrace vector tracing engine:

```ts
const vectorResult = traceBinaryMaskToSVG(finalMask, {
  turdSize: calculateTurdSize(minimumFeatureSize, pxPerMm),
  alphaMax: calculateAlphaMax(smoothing),
  optCurve: true,
  optTolerance: calculateOptTolerance(smoothing),
});
```

* **Output:** Precise, continuous SVG path strings (`<path d="..." fillRule="evenodd" />`).
* **Unit Accuracy:** Paths are scaled $1:1$ to the physical canvas millimeters/inches without resolution loss.
