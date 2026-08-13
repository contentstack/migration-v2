import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 Source panel state. Holds both mode sub-states (stack / file) so switching
 * the segmented control never loses the other mode's data within a session
 * (FR-1.2 / EC-8).
 */
export type SourceMode = 'stack' | 'file';
export type StackScope = 'whole' | 'specific';
export type FileScope = 'all' | 'specific';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface Option {
  value: string;
  label: string;
}
export interface ModuleRow {
  key: string;
  label: string;
  count: number;
  dependsOn: string[];
}
export interface ManifestRow {
  name: string;
  count: number;
}
export interface JobLogLine {
  ts: string;
  level: LogLevel;
  msg: string;
}
export interface LiveCounts {
  contentTypes: number;
  assets: number;
  entries: number;
  globalFields: number;
  references: number;
}

interface StackState {
  regions: Option[];
  orgs: Option[];
  stacks: Option[];
  branches: Option[];
  /** The session's already-authenticated region (no login needed to use it). */
  homeRegion: string;
  /** Regions unlocked this session via region-login: region -> resolved userId. */
  regionAuth: Record<string, string>;
  region: string;
  org: string;
  stackApiKey: string;
  branch: string;
  scope: StackScope;
  modules: ModuleRow[];
  selectedModules: string[];
  /** Distinct from `modules.length === 0`, which is ambiguous between
   * "still loading", "load failed", and "genuinely no modules". */
  modulesLoading: boolean;
  modulesError?: string;
  /** Same ambiguity as modulesLoading, but for the stacks list — lets the UI
   * tell "still fetching" apart from "this org genuinely has no stacks". */
  stacksLoading: boolean;
  stacksError?: string;
}

interface FileState {
  fileName?: string;
  sizeBytes?: number;
  sourceId?: string;
  validated: boolean;
  manifest: ManifestRow[];
  scope: FileScope;
  modules: ModuleRow[];
  selectedModules: string[];
}

/** Cross-region source authentication modal (real Contentstack login). */
interface RegionLoginState {
  open: boolean;
  region?: string;
  prevRegion?: string;
  email: string;
  password: string;
  loading: boolean;
  error?: string;
}

interface SourceState {
  mode: SourceMode;
  stack: StackState;
  file: FileState;
  running: boolean;
  /** File-mode upload+validate is a distinct operation from running an
   * export — kept separate so validating a file never triggers the
   * export-only "scroll to the activity log" behavior. */
  validating: boolean;
  jobId?: string;
  jobStatus?: 'queued' | 'running' | 'succeeded' | 'failed';
  /** 0–100, relayed from the backend job as it advances through its batches
   * (see api/v3/services/export.service.ts `setProgress` calls). Undefined
   * before any export has started this session. */
  jobProgress?: number;
  /** Server-provided caption for the current export step. Absent for file mode,
   *  which has fixed phases the log view can derive a caption from itself. */
  jobStage?: string;
  /** Log lines the server's cap discarded, surfaced so truncation is visible. */
  jobDroppedLogs?: number;
  jobLogs: JobLogLine[];
  /** Running tallies of real discovered items, updated as the export
   * progresses — distinct from the final persisted `graph.counts`, which only
   * exists once the job succeeds. */
  jobLiveCounts?: LiveCounts;
  graph?: { counts: Record<string, number>; nodes: unknown[]; edges: unknown[] };
  error?: string;
  regionLogin: RegionLoginState;
}

const initialRegionLogin: RegionLoginState = {
  open: false,
  email: '',
  password: '',
  loading: false,
};

const initialState: SourceState = {
  mode: 'stack',
  stack: {
    regions: [],
    orgs: [],
    stacks: [],
    branches: [],
    homeRegion: '',
    regionAuth: {},
    region: '',
    org: '',
    stackApiKey: '',
    branch: 'main',
    scope: 'whole',
    modules: [],
    selectedModules: [],
    modulesLoading: false,
    modulesError: undefined,
    stacksLoading: false,
    stacksError: undefined,
  },
  file: {
    validated: false,
    manifest: [],
    scope: 'all',
    modules: [],
    selectedModules: [],
  },
  running: false,
  validating: false,
  jobLogs: [],
  regionLogin: initialRegionLogin,
};

const sourceSlice = createSlice({
  name: 'v3Source',
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<SourceMode>) => {
      state.mode = action.payload;
    },
    setRegions: (state, action: PayloadAction<Option[]>) => {
      state.stack.regions = action.payload;
    },
    setOrgs: (state, action: PayloadAction<Option[]>) => {
      state.stack.orgs = action.payload;
    },
    setStacks: (state, action: PayloadAction<Option[]>) => {
      state.stack.stacks = action.payload;
    },
    setBranches: (state, action: PayloadAction<Option[]>) => {
      state.stack.branches = action.payload;
    },
    setStackField: (
      state,
      action: PayloadAction<{ field: keyof StackState; value: any }>
    ) => {
      (state.stack as any)[action.payload.field] = action.payload.value;
    },
    setFileSelected: (
      state,
      action: PayloadAction<{ fileName: string; sizeBytes: number }>
    ) => {
      state.file.fileName = action.payload.fileName;
      state.file.sizeBytes = action.payload.sizeBytes;
      state.file.validated = false;
    },
    setFileValidated: (
      state,
      action: PayloadAction<{ sourceId: string; manifest: ManifestRow[] }>
    ) => {
      state.file.sourceId = action.payload.sourceId;
      state.file.manifest = action.payload.manifest;
      state.file.validated = true;
    },
    clearFile: (state) => {
      state.file = { ...initialState.file };
    },
    setFileField: (
      state,
      action: PayloadAction<{ field: keyof FileState; value: any }>
    ) => {
      (state.file as any)[action.payload.field] = action.payload.value;
    },
    setRunning: (state, action: PayloadAction<boolean>) => {
      state.running = action.payload;
    },
    setValidating: (state, action: PayloadAction<boolean>) => {
      state.validating = action.payload;
    },
    setJob: (
      state,
      action: PayloadAction<{ jobId?: string; jobStatus?: SourceState['jobStatus'] }>
    ) => {
      state.jobId = action.payload.jobId;
      state.jobStatus = action.payload.jobStatus;
    },
    setJobLogs: (state, action: PayloadAction<JobLogLine[]>) => {
      state.jobLogs = action.payload;
    },
    setJobProgress: (state, action: PayloadAction<number | undefined>) => {
      state.jobProgress = action.payload;
    },
    setJobStage: (state, action: PayloadAction<string | undefined>) => {
      state.jobStage = action.payload;
    },
    setJobDroppedLogs: (state, action: PayloadAction<number | undefined>) => {
      state.jobDroppedLogs = action.payload;
    },
    setJobLiveCounts: (state, action: PayloadAction<LiveCounts | undefined>) => {
      state.jobLiveCounts = action.payload;
    },
    setGraph: (state, action: PayloadAction<SourceState['graph']>) => {
      state.graph = action.payload;
    },
    /** A different stack (or file) was selected — any previously-loaded graph
     * and job status belong to the OLD selection, so they must be dropped
     * here. Without this, `stackApiKey` becomes non-empty again the instant
     * a new stack is picked, and the stale graph/badge from the prior stack
     * keeps rendering as if it were the new stack's data. */
    clearExportState: (state) => {
      state.graph = undefined;
      state.jobId = undefined;
      state.jobStatus = undefined;
      state.jobProgress = undefined;
      state.jobStage = undefined;
      state.jobDroppedLogs = undefined;
      state.jobLogs = [];
      state.jobLiveCounts = undefined;
      state.error = undefined;
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },

    // ---- cross-region source authentication (real CS login) ----
    /** A region other than the session's home region was picked: commit the
     * selection and open the login modal (revert happens on cancel). */
    openRegionLogin: (
      state,
      action: PayloadAction<{ region: string; prevRegion: string }>
    ) => {
      state.stack.region = action.payload.region;
      state.regionLogin = {
        ...initialRegionLogin,
        open: true,
        region: action.payload.region,
        prevRegion: action.payload.prevRegion,
      };
    },
    /** Cancel: revert the region selection to what it was before opening. */
    cancelRegionLogin: (state) => {
      if (state.regionLogin.prevRegion !== undefined) {
        state.stack.region = state.regionLogin.prevRegion;
      }
      state.regionLogin = initialRegionLogin;
    },
    setRegionLoginField: (
      state,
      action: PayloadAction<{ field: 'email' | 'password'; value: string }>
    ) => {
      state.regionLogin[action.payload.field] = action.payload.value;
      state.regionLogin.error = undefined;
    },
    setRegionLoginLoading: (state, action: PayloadAction<boolean>) => {
      state.regionLogin.loading = action.payload;
    },
    setRegionLoginError: (state, action: PayloadAction<string | undefined>) => {
      state.regionLogin.error = action.payload;
      state.regionLogin.loading = false;
    },
    /** Region-login succeeded: remember the resolved userId for this region and close the modal. */
    regionAuthed: (
      state,
      action: PayloadAction<{ region: string; userId: string }>
    ) => {
      state.stack.regionAuth[action.payload.region] = action.payload.userId;
      state.regionLogin = initialRegionLogin;
    },

    reset: () => initialState,
  },
});

/**
 * Whether this project's export is finished, and the source form should therefore be
 * frozen.
 *
 * One definition, consumed by StackPanel, FilePanel and SourcePanel — the rule has three
 * parts and each is load-bearing:
 *
 *   - `!!graph` and not only `jobStatus === 'succeeded'`, because the job registry is
 *     in-memory and lost on restart. Returning to a finished project shows a PERSISTED
 *     graph with no job status at all, and the form must still be frozen.
 *   - `jobStatus === 'succeeded'` as well, for the moment the export finishes and before
 *     the graph has been re-read.
 *   - `jobStatus !== 'failed'` WINS over both. A failure must always leave the operator
 *     able to change something and retry — including when an earlier export succeeded and
 *     left a graph behind, which is the case a rule of `hasGraph || succeeded` alone would
 *     get wrong by stranding them on the attempt that just failed.
 *
 * Freezing matters because these inputs DEFINE the export: changing the stack, branch or
 * module selection after the fact would leave the graph on screen and the export folder on
 * disk describing different things.
 */
export const isExportComplete = (
  s: Pick<SourceState, 'graph' | 'jobStatus'>
): boolean => s.jobStatus !== 'failed' && (!!s.graph || s.jobStatus === 'succeeded');

export const sourceActions = sourceSlice.actions;
export default sourceSlice.reducer;
