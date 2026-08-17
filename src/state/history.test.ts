import { describe, it, expect } from 'vitest';
import { createInitialHistory, pushHistorySnapshot, undoHistory, redoHistory } from './history';
import { AppState, WorkingImageState } from '../engine/types';
import { createDefaultLayers } from '../engine/layers/layerGenerator';

const MOCK_WORKING_IMAGE: WorkingImageState = {
  crop: { type: 'rectangle', geometry: { x: 0, y: 0, width: 400, height: 400 } },
  position: { x: 0, y: 0 },
  scaleX: 1.0,
  scaleY: 1.0,
  lockAspect: true,
  rasterScaleMethod: 'nearest',
};

const MOCK_INITIAL_STATE: AppState = {
  sourceImage: null,
  workingImage: MOCK_WORKING_IMAGE,
  canvas: { width: 8.5, height: 11, unit: 'in', margin: 0.25, orientation: 'portrait' },
  processing: { minimumFeatureSize: 2.0, smoothing: 0 },
  layers: createDefaultLayers(2),
  selectedLayerId: 'layer-1',
  output: { registrationMarks: false, exportMode: 'combined' },
};

describe('History State Manager (Undo / Redo)', () => {
  it('1. Initializes with empty past and future', () => {
    const history = createInitialHistory(MOCK_INITIAL_STATE);
    expect(history.past.length).toBe(0);
    expect(history.future.length).toBe(0);
    expect(history.present.selectedLayerId).toBe('layer-1');
  });

  it('2. Exactly 1 push requires exactly 1 undo', () => {
    let history = createInitialHistory(MOCK_INITIAL_STATE);

    // Edit 1: User adds fill to Layer 1
    const stateAfterEdit1: AppState = {
      ...MOCK_INITIAL_STATE,
      layers: [
        MOCK_INITIAL_STATE.layers[0],
        {
          ...MOCK_INITIAL_STATE.layers[1],
          manualEdits: {
            bridges: [],
            fills: [{ id: 'fill-1', x: 0.5, y: 0.5, fillType: 0 }],
          },
        },
      ],
    };

    history = pushHistorySnapshot(history, stateAfterEdit1);
    expect(history.past.length).toBe(1);
    expect(history.present.layers[1].manualEdits?.fills.length).toBe(1);

    // Undo 1
    history = undoHistory(history);
    expect(history.past.length).toBe(0);
    expect(history.future.length).toBe(1);
    // Should be back to 0 fills
    expect(history.present.layers[1].manualEdits?.fills).toBeUndefined();
  });

  it('3. Multiple distinct edits each undo 1-for-1 in reverse order', () => {
    let history = createInitialHistory(MOCK_INITIAL_STATE);

    // Edit 1 on Layer 1
    const state1: AppState = {
      ...MOCK_INITIAL_STATE,
      layers: [
        MOCK_INITIAL_STATE.layers[0],
        { ...MOCK_INITIAL_STATE.layers[1], manualEdits: { bridges: [], fills: [{ id: 'f1', x: 0.1, y: 0.1, fillType: 0 }] } },
      ],
    };
    history = pushHistorySnapshot(history, state1);

    // Edit 2 on Layer 1
    const state2: AppState = {
      ...state1,
      layers: [
        state1.layers[0],
        { ...state1.layers[1], manualEdits: { bridges: [], fills: [...state1.layers[1].manualEdits!.fills, { id: 'f2', x: 0.2, y: 0.2, fillType: 1 }] } },
      ],
    };
    history = pushHistorySnapshot(history, state2);

    expect(history.past.length).toBe(2);
    expect(history.present.layers[1].manualEdits?.fills.length).toBe(2);

    // Undo Edit 2
    history = undoHistory(history);
    expect(history.present.layers[1].manualEdits?.fills.length).toBe(1);
    expect(history.present.layers[1].manualEdits?.fills[0].id).toBe('f1');

    // Undo Edit 1
    history = undoHistory(history);
    expect(history.present.layers[1].manualEdits?.fills).toBeUndefined();
    expect(history.past.length).toBe(0);

    // Redo Edit 1
    history = redoHistory(history);
    expect(history.present.layers[1].manualEdits?.fills.length).toBe(1);

    // Redo Edit 2
    history = redoHistory(history);
    expect(history.present.layers[1].manualEdits?.fills.length).toBe(2);
  });

  it('4. Handles large SourceImage / ImageData without JSON serialization crashes', () => {
    // 500x500 image with 1,000,000 bytes of ImageData
    const imgData = {
      width: 500,
      height: 500,
      data: new Uint8ClampedArray(500 * 500 * 4),
      colorSpace: 'srgb' as const,
    };
    const stateWithBigImage: AppState = {
      ...MOCK_INITIAL_STATE,
      sourceImage: {
        id: 'big-img',
        name: 'photo.png',
        width: 500,
        height: 500,
        aspectRatio: 1,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        imageData: imgData,
      },
    };

    const history = createInitialHistory(stateWithBigImage);
    const updated = pushHistorySnapshot(history, {
      ...stateWithBigImage,
      selectedLayerId: 'layer-2',
    });

    expect(updated.past.length).toBe(1);
    expect(updated.present.sourceImage?.id).toBe('big-img');
    expect(updated.present.sourceImage?.imageData).toBe(imgData); // Reference preserved!
  });
});
