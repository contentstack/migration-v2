import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 session slice (cs-project-dashboard trd.md TR-6).
 *
 * Holds only the authenticated user's display identity, for the projects page
 * avatar. Nothing is persisted: there is no selected organization to remember
 * since the 2026-08-05 revision, which is also why the `ui/v3/storage` module and
 * its ESLint `localStorage` exception were removed — `auth/token.ts` is again the
 * single file in v3 permitted to touch storage.
 */
export interface SessionUser {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface SessionState {
  user: SessionUser;
  userLoading: boolean;
  /**
   * Set when the user read fails. Non-fatal: the avatar falls back to its icon and
   * the project list is unaffected, because the two requests are independent
   * (feature.md EC-19).
   */
  userError?: string;
}

const initialState: SessionState = {
  user: {},
  userLoading: false,
  userError: undefined,
};

const sessionSlice = createSlice({
  name: 'v3session',
  initialState,
  reducers: {
    userLoading: (state) => {
      state.userLoading = true;
      state.userError = undefined;
    },
    userLoaded: (state, action: PayloadAction<SessionUser | undefined>) => {
      state.userLoading = false;
      state.userError = undefined;
      state.user = action.payload ?? {};
    },
    userFailed: (state, action: PayloadAction<string>) => {
      state.userLoading = false;
      state.userError = action.payload;
      // `user` is left empty on purpose, so the avatar takes its icon fallback
      // rather than showing a half-resolved identity.
      state.user = {};
    },
    reset: (state) => {
      state.user = {};
      state.userLoading = false;
      state.userError = undefined;
    },
  },
});

export const sessionActions = sessionSlice.actions;
export default sessionSlice.reducer;
