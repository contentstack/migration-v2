import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Shared wizard toast queue (cs-audit-report trd.md TR-21, feature.md FR-9.1).
 *
 * Lives with the wizard chrome rather than with the Audit step, so Content mapping,
 * Preview and Migrate can reuse it instead of each growing its own.
 *
 * PLUMBING ONLY at this stage of the TDD run — the shape and the queue operations.
 * The dismissal *timer* belongs to the component (it is a rendering concern), and
 * FR-9.4 keeps the toast strictly non-load-bearing: it confirms a change that is
 * already visible elsewhere, never the only sign of one.
 */
export interface ToastMessage {
  /** Monotonic within a session; the component keys on it. */
  id: number;
  text: string;
}

export interface ToastState {
  queue: ToastMessage[];
  nextId: number;
}

/**
 * Bounded on purpose. Rapid actions — a bulk exclude immediately followed by an
 * include-everything — must not pile up an unbounded stack of overlapping toasts
 * that outlives the interaction that produced them.
 */
export const TOAST_QUEUE_MAX = 3;

/** Milliseconds a toast stays before dismissing itself (FR-9.3). */
export const TOAST_DISMISS_MS = 2600;

const initialState: ToastState = { queue: [], nextId: 1 };

const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    show(state, action: PayloadAction<string>) {
      state.queue.push({ id: state.nextId, text: action.payload });
      state.nextId += 1;
      if (state.queue.length > TOAST_QUEUE_MAX) {
        state.queue = state.queue.slice(-TOAST_QUEUE_MAX);
      }
    },
    dismiss(state, action: PayloadAction<number>) {
      state.queue = state.queue.filter((t) => t.id !== action.payload);
    },
    clear(state) {
      state.queue = [];
    },
  },
});

export const toastActions = toastSlice.actions;
export default toastSlice.reducer;
