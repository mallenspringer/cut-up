import { AppState } from '../engine/types';

export interface HistoryState {
  past: AppState[];
  present: AppState;
  future: AppState[];
}

/**
 * Deep-clones editable application state (layers, transforms, canvas settings)
 * while preserving sourceImage reference without stringifying multi-megabyte ImageData buffers.
 */
export function cloneAppState(state: AppState): AppState {
  return {
    ...state,
    sourceImage: state.sourceImage, // Preserved by reference (never JSON.stringified)
    workingImage: JSON.parse(JSON.stringify(state.workingImage)),
    layers: JSON.parse(JSON.stringify(state.layers)),
    canvas: { ...state.canvas },
    processing: { ...state.processing },
    output: { ...state.output },
  };
}

export function createInitialHistory(initialState: AppState): HistoryState {
  return {
    past: [],
    present: cloneAppState(initialState),
    future: [],
  };
}

export function pushHistorySnapshot(
  history: HistoryState,
  nextState: AppState
): HistoryState {
  return {
    past: [...history.past, history.present],
    present: cloneAppState(nextState),
    future: [], // Clear redo stack on divergent edit
  };
}

export function undoHistory(history: HistoryState): HistoryState {
  if (history.past.length === 0) {
    return history;
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);

  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory(history: HistoryState): HistoryState {
  if (history.future.length === 0) {
    return history;
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}
