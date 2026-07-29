import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 Source panel state. Holds both mode sub-states (stack / file) so switching
 * the segmented control never loses the other mode's data within a session
 * (FR-1.2 / EC-8).
 */
export type SourceMode = 'stack' | 'file';
export type StackScope = 'whole' | 'specific';
export type FileScope = 'all' | 'specific';

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

interface StackState {
  regions: Option[];
  orgs: Option[];
  stacks: Option[];
  branches: Option[];
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

interface SourceState {
  mode: SourceMode;
  stack: StackState;
  file: FileState;
  running: boolean;
  jobId?: string;
  jobStatus?: 'queued' | 'running' | 'succeeded' | 'failed';
  graph?: { counts: Record<string, number>; nodes: unknown[]; edges: unknown[] };
  error?: string;
}

const initialState: SourceState = {
  mode: 'stack',
  stack: {
    regions: [],
    orgs: [],
    stacks: [],
    branches: [],
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
    setGraph: (state, action: PayloadAction<SourceState['graph']>) => {
      state.graph = action.payload;
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
    reset: () => initialState,
  },
});

export const sourceActions = sourceSlice.actions;
export default sourceSlice.reducer;
