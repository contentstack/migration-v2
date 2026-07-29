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
  jobId?: string;
  jobStatus?: 'queued' | 'running' | 'succeeded' | 'failed';
  jobLogs: JobLogLine[];
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
  },
  file: {
    validated: false,
    manifest: [],
    scope: 'all',
    modules: [],
    selectedModules: [],
  },
  running: false,
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
    setGraph: (state, action: PayloadAction<SourceState['graph']>) => {
      state.graph = action.payload;
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

export const sourceActions = sourceSlice.actions;
export default sourceSlice.reducer;
