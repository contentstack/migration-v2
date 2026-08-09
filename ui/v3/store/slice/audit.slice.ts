import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 Audit step state (cs-audit-report trd.md TR-19).
 *
 * PLUMBING ONLY at this stage of the TDD run — the shape, the initial state and
 * the setters. It holds no audit *behaviour*: the resolution and impact rules live
 * in the shared pure functions the api side already declares
 * (`auditDecisions.service`), so the client and the server can never disagree
 * ([trd.md §4](../../../docs/features/cs-audit-report/trd.md) data flow step 6).
 *
 * The panel's three states are DERIVED from `phase` + `error`, never stored as a
 * separate flag (TR-15) — the same derive-don't-store discipline the project
 * dashboard uses for status and resume step.
 */
export type AuditPhase = 'idle' | 'analyzing' | 'ready' | 'error';

export type AuditCheckState =
  | 'queued'
  | 'checking'
  | 'done'
  | 'notPresent'
  | 'unavailable';

export type AuditCategory =
  | 'unusedAssets'
  | 'unpublishedEntries'
  | 'emptyContentTypes'
  | 'unusedGlobalFields';

export type DecisionState = 'include' | 'exclude';

export interface AuditCheckView {
  id: AuditCategory;
  label: string;
  state: AuditCheckState;
  /** Absent — never zero — for `notPresent` and `unavailable` (FR-2.11). */
  count?: number;
}

export interface AuditItemView {
  key: string;
  category: AuditCategory;
  type: string;
  title: string;
  uid: string;
  contentType?: string;
  locale?: string;
  status: string;
}

export interface AuditTotalsView {
  contentTypes: number;
  globalFields: number;
  assets: number;
  entryRecords: number;
  denominator: number;
}

export interface AuditDecisionsView {
  categories: Partial<Record<AuditCategory, DecisionState>>;
  itemOverrides: Record<string, DecisionState>;
}

export type AuditFilter =
  | 'all'
  | 'entries'
  | 'assets'
  | 'contentTypes'
  | 'globalFields';

export interface AuditState {
  phase: AuditPhase;
  /** Fixed classification from the server; drives the error state's copy. */
  error?: string;
  jobId?: string;
  checks: AuditCheckView[];
  totals?: AuditTotalsView;
  variantsInspected: boolean;
  /** The working decision set — written to the server only on Continue (FR-7.5). */
  decisions: AuditDecisionsView;
  /** The last set persisted, so the panel knows whether anything is unsaved. */
  persistedDecisions: AuditDecisionsView;
  tableOpen: boolean;
  filter: AuditFilter;
  search: string;
  page: number;
  pageCount: number;
  total: number;
  counts: Record<AuditFilter, number>;
  items: AuditItemView[];
  itemsLoading: boolean;
  saving: boolean;
}

const emptyDecisions = (): AuditDecisionsView => ({ categories: {}, itemOverrides: {} });

const initialState: AuditState = {
  phase: 'idle',
  checks: [],
  variantsInspected: false,
  decisions: emptyDecisions(),
  persistedDecisions: emptyDecisions(),
  tableOpen: true,
  filter: 'all',
  search: '',
  page: 1,
  pageCount: 1,
  total: 0,
  counts: { all: 0, entries: 0, assets: 0, contentTypes: 0, globalFields: 0 },
  items: [],
  itemsLoading: false,
  saving: false,
};

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    scanStarted(state, action: PayloadAction<{ jobId: string; checks: AuditCheckView[] }>) {
      state.phase = 'analyzing';
      state.error = undefined;
      state.jobId = action.payload.jobId;
      state.checks = action.payload.checks;
    },
    scanProgress(state, action: PayloadAction<AuditCheckView[]>) {
      state.checks = action.payload;
    },
    scanFailed(state, action: PayloadAction<string>) {
      state.phase = 'error';
      state.error = action.payload;
    },
    findingsLoaded(
      state,
      action: PayloadAction<{
        checks: AuditCheckView[];
        totals: AuditTotalsView;
        variantsInspected: boolean;
        decisions: AuditDecisionsView;
      }>
    ) {
      state.phase = 'ready';
      state.error = undefined;
      state.checks = action.payload.checks;
      state.totals = action.payload.totals;
      state.variantsInspected = action.payload.variantsInspected;
      state.decisions = action.payload.decisions;
      state.persistedDecisions = action.payload.decisions;
    },
    setDecisions(state, action: PayloadAction<AuditDecisionsView>) {
      state.decisions = action.payload;
    },
    decisionsPersisted(state, action: PayloadAction<AuditDecisionsView>) {
      state.decisions = action.payload;
      state.persistedDecisions = action.payload;
      state.saving = false;
    },
    /** A recoverable failure shown beside the footer, distinct from the error PHASE. */
    setError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    setSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setTableOpen(state, action: PayloadAction<boolean>) {
      state.tableOpen = action.payload;
    },
    setFilter(state, action: PayloadAction<AuditFilter>) {
      state.filter = action.payload;
      state.page = 1;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
      state.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    setItemsLoading(state, action: PayloadAction<boolean>) {
      state.itemsLoading = action.payload;
    },
    itemsLoaded(
      state,
      action: PayloadAction<{
        items: AuditItemView[];
        page: number;
        pageCount: number;
        total: number;
        counts: Record<AuditFilter, number>;
      }>
    ) {
      state.items = action.payload.items;
      state.page = action.payload.page;
      state.pageCount = action.payload.pageCount;
      state.total = action.payload.total;
      state.counts = action.payload.counts;
      state.itemsLoading = false;
    },
    reset() {
      return initialState;
    },
  },
});

export const auditActions = auditSlice.actions;
export default auditSlice.reducer;

/** How many checks have resolved — drives the "{n} of 4 checks" counter. */
export const resolvedCheckCount = (checks: AuditCheckView[]): number =>
  checks.filter((c) => c.state !== 'queued' && c.state !== 'checking').length;
