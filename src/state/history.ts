import { AppState, WorkingImageState } from '../engine/types';

export interface CompositionSnapshot {
  timestamp: number;
  workingImage: WorkingImageState;
}

export interface HistoryState {
  past: CompositionSnapshot[];
  present: CompositionSnapshot;
  future: CompositionSnapshot[];
}

export function createInitialHistory(workingImage: WorkingImageState): HistoryState {
  const initialSnapshot: CompositionSnapshot = {
    timestamp: Date.now(),
    workingImage: JSON.parse(JSON.stringify(workingImage)),
  };
  return {
    past: [],
    present: initialSnapshot,
    future: [],
  };
}

export function pushHistorySnapshot(history: HistoryState, workingImage: WorkingImageState): HistoryState {
  const newSnapshot: CompositionSnapshot = {
    timestamp: Date.now(),
    workingImage: JSON.parse(JSON.stringify(workingImage)),
  };

  return {
    past: [...history.past, history.present],
    present: newSnapshot,
    future: [], // Clear redo stack on divergent edit
  };
}

export function undoHistory(history: HistoryState): { history: HistoryState; snapshot: CompositionSnapshot | null } {
  if (history.past.length === 0) {
    return { history, snapshot: null };
  }

  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);

  const newHistory: HistoryState = {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };

  return { history: newHistory, snapshot: previous };
}

export function redoHistory(history: HistoryState): { history: HistoryState; snapshot: CompositionSnapshot | null } {
  if (history.future.length === 0) {
    return { history, snapshot: null };
  }

  const next = history.future[0];
  const newFuture = history.future.slice(1);

  const newHistory: HistoryState = {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };

  return { history: newHistory, snapshot: next };
}
