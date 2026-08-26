import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Which project the store's project-scoped state currently belongs to.
 *
 * Exists to enforce one rule: **state belonging to one project must never be visible in
 * another.** See `useProjectScope`, which is the only thing that writes it.
 *
 * ⚠️ This lives in the STORE rather than in a component ref on purpose. Returning to the
 * dashboard and opening a different project unmounts the wizard page, so a component-local
 * "previous project id" is undefined on arrival while the store still holds the previous
 * project's audit findings and content graph. That is exactly the flow that was reported:
 * the Audit page showing the stats of the project opened before it.
 *
 * Deliberately one field. It is not a cache and it holds no data — it is the answer to
 * "whose state is this?", which is the single fact the reset rule needs.
 */
export interface ScopeState {
  /** Undefined before any project has been entered in this session. */
  projectId?: string;
}

const initialState: ScopeState = {};

const scopeSlice = createSlice({
  name: 'v3Scope',
  initialState,
  reducers: {
    /**
     * Records the project whose state the store now holds. Dispatched by
     * `useProjectScope` immediately after it clears the previous project's slices, so the
     * two always move together.
     */
    enterProject(state, action: PayloadAction<string>) {
      state.projectId = action.payload;
    },
    reset: () => initialState,
  },
});

export const scopeActions = scopeSlice.actions;
export default scopeSlice.reducer;
