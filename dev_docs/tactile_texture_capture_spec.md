# Tactile Paper & Material Texture Capture Specification

This document defines the studio photography, digital post-processing, and web integration standards for creating custom, high-fidelity tactile material alpha masks (such as **Craft Felt**, **Construction Paper**, **Heavy Kraft Cardstock**, and **Rough Deckle Rag**) for the Cut Up rendering engine.

---

## 1. Studio Capture Protocol (Raking Light Photography)

The goal of physical capture is to isolate **surface relief micro-shadows** without color distortion.

```text
[Grazing COB Light (30°-40°)] ───────►  [ White / Light Material Sample ]
                                                    │
                                                    ▼
                                          [ Macro Lens (f/8 - f/11) ]
```

### Physical Setup:
1. **Material Selection:**
   - Use **white, off-white, or neutral light gray** samples (e.g., white wool craft felt, light gray construction paper, unbleached cotton rag).
   - *Why:* Eliminates color contamination and chromatic aberration in the shadow crevice extraction.
2. **Lighting Architecture (Raking Light):**
   - Use a single continuous point source (COB LED).
   - Position light at a **low grazing angle ($30^\circ\text{–}40^\circ$)** relative to the material surface from the top-left ($45^\circ$ azimuth).
   - Diffuse slightly (softbox or diffusion silk) to soften harsh synthetic specular highlights while casting deep micro-shadows into fibrous crevices.
3. **Optics & Camera:**
   - **Lens:** True 1:1 Macro or high-resolving prime lens.
   - **Aperture:** $f/8$ to $f/11$ for uniform, edge-to-edge sensor plane sharpness and deep depth of field across micro-fibers.
   - **Exposure:** Base ISO (100), RAW capture, manual focus with focus peaking on texture plane.

---

## 2. GIMP / Photoshop Post-Processing Pipeline

> [!IMPORTANT]
> **Do not threshold into 1-bit binary black/white.** 
> An 8-bit alpha gradient (0..255) is required to preserve soft fiber fuzz, sub-pixel hairs, and tactile micro-gradients.

### Step-by-Step Workflow:

```text
RAW Photo
   ↓
[Grayscale Conversion]
   ↓
[Flat-Field Lighting Neutralization (High-Pass)]
   ↓
[Seamless Tiling (Offset & Clone)]
   ↓
[Color to Alpha (#FFFFFF -> 0 Alpha)]
   ↓
Optimized 8-Bit Alpha WebP / PNG (512x512)
```

1. **Grayscale Conversion:**
   - In GIMP: `Image → Mode → Grayscale`.
2. **Flat-Field Neutralization (Remove Vignetting / Global Falloff):**
   - The texture must have identical average brightness from center to corner.
   - Apply a High-Pass filter (`Filters → Enhance → High Pass Filter...`) with a large radius ($\sim 100\text{–}200\text{px}$) to strip large-scale lighting gradients while preserving microscopic fiber tooth.
3. **Seamless Tiling:**
   - In GIMP: `Layer → Transform → Offset...` (offset by $50\%$ width and $50\%$ height).
   - Use the **Clone Stamp** and **Healing Brush** along the seam crosshair to eliminate visible boundary repetitions.
   - Crop to a clean square power-of-two resolution: **$512 \times 512\text{ px}$** or **$1024 \times 1024\text{ px}$**.
4. **Color-to-Alpha Extraction:**
   - Adjust `Colors → Levels` so that the illuminated surface peaks reach pure white (`#FFFFFF`, RGB $255, 255, 255$).
   - Choose `Colors → Color to Alpha...`
   - Select Color: **`#FFFFFF` (Pure White)**.
   - **Result:** Illuminated peaks become **$100\%$ transparent**, while shadow crevices, pits, and dark fiber strands remain as varying shades of **semi-transparent black**.
5. **Web Export:**
   - Export as **WebP (Lossless, with Alpha)** or **PNG-32**.
   - Target file size: **$\le 80\text{ KB}$** per tile.

---

## 3. Web & SVG Integration Architecture

Photographic alpha masks are integrated as vector SVG `<pattern>` tiles and composited directly over each layer's cut vector path.

### SVG Pattern Definition:
```xml
<defs>
  <pattern 
    id="pattern-felt" 
    patternUnits="userSpaceOnUse" 
    width="256" 
    height="256"
  >
    <image 
      href="/textures/craft_felt_512.webp" 
      width="256" 
      height="256" 
    />
  </pattern>
</defs>
```

### Layer Composite Rendering:
```tsx
{/* Solid Base Paper Layer */}
<path
  d={sheetPath}
  fill={layer.color}
  fillRule="evenodd"
/>

{/* Tactile Photographic Alpha Overlay */}
<path
  d={sheetPath}
  fill="url(#pattern-felt)"
  fillRule="evenodd"
  style={{
    mixBlendMode: 'multiply',
    opacity: textureStrength, // User slider (0.05 to 1.0)
  }}
/>
```

### Performance & Memory Benefits:
* **GPU Hardware Compositing:** SVG patterns with CSS `mix-blend-mode: multiply` execute entirely on the GPU compositor.
* **Zero Re-Vectorization:** Adjusting texture intensity or changing materials does not re-run Potrace or alter vector paths.
* **Independent Layer Seeds:** Seamless patterns can be given random spatial coordinate offsets (`x={layerIdx * 73}`, `y={layerIdx * 127}`) so each cardstock sheet in the stack displays a distinct section of the texture.
