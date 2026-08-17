import { BinaryMask, LayerManualEdits } from '../types';

/**
 * Applies non-destructive manual layer edits (flood-fill hole closures / island deletions
 * and solid paper bridge capsules) directly to the binary mask in raster space.
 */
export function applyManualEditsToMask(
  mask: BinaryMask,
  manualEdits: LayerManualEdits | undefined,
  targetW: number,
  targetH: number,
  pxPerMm: number
): BinaryMask {
  if (!manualEdits) return mask;
  const hasFills = manualEdits.fills && manualEdits.fills.length > 0;
  const hasBridges = manualEdits.bridges && manualEdits.bridges.length > 0;
  if (!hasFills && !hasBridges) return mask;

  const data = new Uint8Array(mask.data);
  const totalPixels = targetW * targetH;

  // 1. Process Smart Wand flood fills / island deletions
  if (hasFills) {
    for (const fill of manualEdits.fills) {
      const px = Math.min(targetW - 1, Math.max(0, Math.floor(fill.x * targetW)));
      const py = Math.min(targetH - 1, Math.max(0, Math.floor(fill.y * targetH)));

      const startIndex = py * targetW + px;
      const startVal = data[startIndex];
      const targetVal = fill.fillType;

      if (startVal === targetVal) continue;

      // Collect connected component via BFS
      const queue: number[] = [startIndex];
      const visited = new Uint8Array(totalPixels);
      visited[startIndex] = 1;
      const componentIndices: number[] = [startIndex];
      let touchesBorder = false;

      let head = 0;
      while (head < queue.length) {
        const currIdx = queue[head++];
        const cx = currIdx % targetW;
        const cy = Math.floor(currIdx / targetW);

        if (cx === 0 || cx === targetW - 1 || cy === 0 || cy === targetH - 1) {
          touchesBorder = true;
        }

        // 4 neighbors
        const neighbors = [
          cx > 0 ? currIdx - 1 : -1,
          cx < targetW - 1 ? currIdx + 1 : -1,
          cy > 0 ? currIdx - targetW : -1,
          cy < targetH - 1 ? currIdx + targetW : -1,
        ];

        for (const nIdx of neighbors) {
          if (nIdx !== -1 && visited[nIdx] === 0 && data[nIdx] === startVal) {
            visited[nIdx] = 1;
            queue.push(nIdx);
            componentIndices.push(nIdx);
          }
        }
      }

      // If user clicked paper (1) to erase (0):
      if (startVal === 1 && targetVal === 0) {
        if (touchesBorder) {
          // Connected to the outer border/main sheet -> Strict No-Op (preserve continuous paper sheet)
          continue;
        } else {
          // Isolated floating island scrap -> erase the entire connected component
          for (const idx of componentIndices) {
            data[idx] = 0;
          }
        }
      } else {
        // Filling hole (0 -> 1): fill entire closed void with solid paper
        for (const idx of componentIndices) {
          data[idx] = 1;
        }
      }
    }
  }

  // 2. Process Bridge Pen line capsules (stamped as solid paper material = 1)
  if (hasBridges) {
    for (const bridge of manualEdits.bridges) {
      const px1 = bridge.x1 * targetW;
      const py1 = bridge.y1 * targetH;
      const px2 = bridge.x2 * targetW;
      const py2 = bridge.y2 * targetH;

      const radiusPx = Math.max(1.5, (bridge.widthMm * pxPerMm) / 2);
      const radiusSq = radiusPx * radiusPx;

      const minX = Math.max(0, Math.floor(Math.min(px1, px2) - radiusPx));
      const maxX = Math.min(targetW - 1, Math.ceil(Math.max(px1, px2) + radiusPx));
      const minY = Math.max(0, Math.floor(Math.min(py1, py2) - radiusPx));
      const maxY = Math.min(targetH - 1, Math.ceil(Math.max(py1, py2) + radiusPx));

      const vx = px2 - px1;
      const vy = py2 - py1;
      const lenSq = vx * vx + vy * vy;

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          let distSq: number;
          if (lenSq <= 0.0001) {
            const dx = x - px1;
            const dy = y - py1;
            distSq = dx * dx + dy * dy;
          } else {
            const t = Math.max(0, Math.min(1, ((x - px1) * vx + (y - py1) * vy) / lenSq));
            const projX = px1 + t * vx;
            const projY = py1 + t * vy;
            const dx = x - projX;
            const dy = y - projY;
            distSq = dx * dx + dy * dy;
          }

          if (distSq <= radiusSq) {
            data[y * targetW + x] = 1; // Stamp solid paper material
          }
        }
      }
    }
  }

  return {
    width: targetW,
    height: targetH,
    data,
  };
}
