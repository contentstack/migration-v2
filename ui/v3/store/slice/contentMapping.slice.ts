import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 Content mapping slice — cs-content-type-selection trd.md §4.
 *
 * Holds the whole inventory client-side (TC-1), so paging, search and select-all
 * are pure client state. Everything the panel renders that is not stored here —
 * the visible rows, the footer count, whether select-all is checked, which
 * content types would be orphaned by an untick — is DERIVED per render. That is
 * the same derive-don't-store discipline the audit panel and project dashboard
 * use, and it is what stops the count and the checkboxes drifting apart.
 */

export interface ContentTypeInventoryItem {
  uid: string;
  title: string;
  /** Content type uids this one references. Deduped, self-edge removed. */
  references: string[];
  existsInDestination: boolean;
}

export type ConflictMode = 'source' | 'dest' | 'merge';

export interface ContentTypeSelectionView {
  contentTypes: Record<string, { conflictMode?: ConflictMode }>;
}

export interface ContentMappingState {
  phase: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  contentTypes: ContentTypeInventoryItem[];
  destinationRead: boolean;
  destinationReadFailure?: string;
  /** What the operator currently has chosen. Never written to the server directly. */
  selection: ContentTypeSelectionView;
  /** What the server last stored — absent when nothing was ever saved. */
  persistedSelection?: ContentTypeSelectionView;
  search: string;
  /** How many rows are revealed. Paging is presentational; the full set is held. */
  shown: number;
  saving: boolean;
  saveError?: string;
  saveAcknowledged: boolean;
  /** The uid awaiting an untick confirmation, if any. */
  pendingUntick?: string;
}

/** trd.md TC-2 — 25, chosen over the prototype's 8. */
export const PAGE_SIZE = 25;

const initialState: ContentMappingState = {
  phase: 'idle',
  contentTypes: [],
  destinationRead: false,
  selection: { contentTypes: {} },
  search: '',
  shown: PAGE_SIZE,
  saving: false,
  saveAcknowledged: false,
};

/**
 * Derives the working selection from a persisted record, dropping uids the
 * current export no longer contains (FR-9.6).
 *
 * Pruning happens here rather than at export time so a re-export that
 * temporarily removes a content type does not permanently destroy the choice —
 * and so a vanished uid is never round-tripped back to API-2, which would reject
 * it for a reason the operator cannot see.
 */
const hydrate = (
  persisted: ContentTypeSelectionView | undefined,
  inventory: ContentTypeInventoryItem[]
): ContentTypeSelectionView => {
  if (!persisted) return { contentTypes: {} };
  const present = new Set(inventory.map((c) => c.uid));
  const contentTypes: ContentTypeSelectionView['contentTypes'] = {};
  for (const [uid, value] of Object.entries(persisted.contentTypes ?? {})) {
    if (present.has(uid)) contentTypes[uid] = { ...value };
  }
  return { contentTypes };
};

const slice = createSlice({
  name: 'contentMapping',
  initialState,
  reducers: {
    loadStarted: (state) => {
      state.phase = 'loading';
      state.error = undefined;
    },

    inventoryLoaded: (state, action: PayloadAction<Partial<ContentMappingState>>) => {
      const p = action.payload;
      if (p.phase === 'error') {
        state.phase = 'error';
        state.error = p.error;
        state.contentTypes = [];
        return;
      }
      state.phase = 'ready';
      state.error = undefined;
      state.contentTypes = p.contentTypes ?? [];
      state.destinationRead = p.destinationRead ?? false;
      state.destinationReadFailure = p.destinationReadFailure;
      state.persistedSelection = p.persistedSelection;
      state.selection = p.selection ?? hydrate(p.persistedSelection, state.contentTypes);
      state.shown = p.shown ?? PAGE_SIZE;
      state.search = p.search ?? '';
    },

    loadFailed: (state, action: PayloadAction<string>) => {
      state.phase = 'error';
      state.error = action.payload;
      state.contentTypes = [];
    },

    setSearch: (state, action: PayloadAction<string>) => {
      // `shown` is deliberately untouched: clearing the search must restore the
      // page the operator had reached, not reset it (FR-3.7).
      state.search = action.payload;
    },

    loadMore: (state) => {
      state.shown += PAGE_SIZE;
    },

    /** Adds or removes one content type. The confirmation is the panel's concern. */
    toggleContentType: (
      state,
      action: PayloadAction<{ uid: string; existsInDestination: boolean }>
    ) => {
      const { uid, existsInDestination } = action.payload;
      if (state.selection.contentTypes[uid]) {
        delete state.selection.contentTypes[uid];
        return;
      }
      // `Use source` is pre-selected for a conflicting content type, and recorded
      // in the selection rather than only rendered — otherwise the persist would
      // send a conflicting type with no mode, which is precisely what G-2 counts
      // as the failure it exists to prevent.
      state.selection.contentTypes[uid] = existsInDestination
        ? { conflictMode: 'source' }
        : {};
    },

    /** Replaces the selection wholesale — used by select-all in either direction. */
    setSelection: (state, action: PayloadAction<ContentTypeSelectionView>) => {
      state.selection = action.payload;
    },

    setConflictMode: (
      state,
      action: PayloadAction<{ uid: string; mode: ConflictMode }>
    ) => {
      const entry = state.selection.contentTypes[action.payload.uid];
      if (entry) entry.conflictMode = action.payload.mode;
    },

    askUntickConfirmation: (state, action: PayloadAction<string>) => {
      state.pendingUntick = action.payload;
    },

    dismissUntickConfirmation: (state) => {
      state.pendingUntick = undefined;
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.saving = action.payload;
      if (action.payload) {
        state.saveError = undefined;
        state.saveAcknowledged = false;
      }
    },

    saveSucceeded: (state, action: PayloadAction<ContentTypeSelectionView>) => {
      state.saving = false;
      state.persistedSelection = action.payload;
      state.saveError = undefined;
      state.saveAcknowledged = true;
    },

    saveFailed: (state, action: PayloadAction<string>) => {
      // The working selection is deliberately untouched: a failed save must leave
      // the operator exactly where they were so they can simply press again
      // (FR-9.7).
      state.saving = false;
      state.saveError = action.payload;
      state.saveAcknowledged = false;
    },

    reset: () => initialState,
  },
});

export const contentMappingActions = slice.actions;
export default slice.reducer;

// ───────────────────────── derived helpers (pure, shared with the panel) ─────────────────────────

/** Content types matching the active search — the scope search and select-all act on. */
export const matchingContentTypes = (
  contentTypes: ContentTypeInventoryItem[],
  search: string
): ContentTypeInventoryItem[] => {
  const term = search.trim().toLowerCase();
  if (!term) return contentTypes;
  // A literal substring match on the display title. Never a constructed regular
  // expression: an operator typing "(" would otherwise throw during render, and
  // a search that filters on uid would match text the operator cannot see.
  return contentTypes.filter((c) => c.title.toLowerCase().includes(term));
};

/** The rows actually rendered: every match while searching, one page otherwise. */
export const visibleContentTypes = (
  contentTypes: ContentTypeInventoryItem[],
  search: string,
  shown: number
): ContentTypeInventoryItem[] => {
  const matches = matchingContentTypes(contentTypes, search);
  return search.trim() ? matches : matches.slice(0, shown);
};

/**
 * The ticked content types that reference `uid` — the reverse edge, computed on
 * demand (trd.md TC-4). Empty means unticking `uid` breaks nothing.
 */
export const referencingSelected = (
  contentTypes: ContentTypeInventoryItem[],
  selection: ContentTypeSelectionView,
  uid: string
): ContentTypeInventoryItem[] =>
  contentTypes.filter(
    (c) =>
      c.uid !== uid &&
      !!selection.contentTypes[c.uid] &&
      c.references.includes(uid)
  );

/** FR-8.1 / FR-8.2 — the status line the panel publishes to the chrome. */
export const statusLineFor = (count: number): string => {
  if (count === 0) return 'No content types selected';
  if (count === 1) return '1 content type ships';
  return `${count} content types ship`;
};
