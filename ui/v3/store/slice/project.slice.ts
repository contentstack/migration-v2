import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 project slice (cs-project-dashboard trd.md TR-12, TR-19).
 *
 * Holds the UNFILTERED list exactly as the server returned it, plus the loading,
 * error and creating flags. The filtered view is derived, never stored, which is
 * what keeps "no projects exist" distinguishable from "no projects match the
 * search" (FR-3.3).
 */
export interface ProjectRecord {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  region: string;
  owner: string;
  isDeleted?: boolean;
  source?: { lastExport?: { status?: string } | null } | null;
  destination?: unknown;
  migration?: { status?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectState {
  items: ProjectRecord[];
  loading: boolean;
  /** Set when the list request fails. A failure is never an empty list (NFR-8). */
  error?: string;
  /**
   * True while a creation is in flight. Set synchronously before the request, so
   * a second dispatch in the same tick observes it — that is the single-flight
   * guard (FR-7.12). v3 cannot delete a project, so a duplicate is permanent.
   */
  creating: boolean;
  createError?: string;
  /**
   * Set when the list request was refused as unauthenticated. The shared apiClient
   * owns the redirect; this page must render neither an error nor an empty state
   * while that happens, because "No projects yet" would be untrue (AC-7.3).
   */
  unauthorized: boolean;
}

const initialState: ProjectState = {
  items: [],
  loading: false,
  error: undefined,
  creating: false,
  createError: undefined,
  unauthorized: false,
};

const projectSlice = createSlice({
  name: 'v3project',
  initialState,
  reducers: {
    listPending: (state) => {
      state.loading = true;
      state.error = undefined;
      state.unauthorized = false;
    },
    listLoaded: (state, action: PayloadAction<ProjectRecord[]>) => {
      state.loading = false;
      state.error = undefined;
      // Replaced, never merged — a switch to another organization must not leave
      // the previous one's projects behind.
      state.items = action.payload ?? [];
    },
    listUnauthorized: (state) => {
      state.loading = false;
      state.error = undefined;
      state.unauthorized = true;
    },
    listFailed: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
      // `items` is deliberately left alone: rendering an empty list on failure
      // would tell the user they have no projects (NFR-8).
    },

    createPending: (state) => {
      state.creating = true;
      state.createError = undefined;
    },
    createSettled: (state) => {
      state.creating = false;
    },
    createFailed: (state, action: PayloadAction<string>) => {
      state.creating = false;
      state.createError = action.payload;
    },
    createReset: (state) => {
      state.creating = false;
      state.createError = undefined;
    },

    reset: (state) => {
      state.items = [];
      state.loading = false;
      state.error = undefined;
      state.creating = false;
      state.createError = undefined;
      state.unauthorized = false;
    },
  },
});

export const projectActions = projectSlice.actions;
export default projectSlice.reducer;

/**
 * The filtered view (FR-6.2): case-insensitive substring match on the project
 * NAME only — not the description. A whitespace-only term is an empty search
 * (FR-6.6).
 */
export const filterProjects = (
  items: ProjectRecord[],
  search: string
): ProjectRecord[] => {
  const term = (search ?? '').trim().toLowerCase();
  if (!term) return items;
  return items.filter((p) => (p.name ?? '').toLowerCase().includes(term));
};
