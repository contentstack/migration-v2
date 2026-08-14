import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * v3 Destination panel state (Content Map & Audit — Destination panel).
 * Mirrors trd.md DM-1: the persisted shape is region / orgId / stack /
 * importAuth / branchMapping (singular) / masterLocaleMapping /
 * additionalLanguageMappings.
 *
 * The locked halves of the two mapping rows (`branchMapping.srcBranch`,
 * `masterLocaleMapping.srcLocale`) are inherited from the persisted SOURCE
 * selection and are never editable here (FR-9.1 / FR-4.1).
 */
export type ImportAuthMethod = 'management' | 'authToken';

export interface Option {
  value: string;
  label: string;
}
export interface LocaleMapping {
  srcLocale: string;
  destLocale: string;
}
export interface StackStat {
  label: string;
  value: string;
}
export interface StackStats {
  isEmpty: boolean;
  stats: StackStat[];
}

/** Read-only view of the persisted source this panel depends on (DEP-1 / FR-8.3). */
interface SourceContext {
  ready: boolean;
  region: string;
  branch: string;
  masterLocale: string;
}

interface CreateStackState {
  open: boolean;
  name: string;
  description: string;
  /** A stack's master locale is fixed at creation, so it is chosen here. */
  masterLocale: string;
  loading: boolean;
  error?: string;
}

/** Cross-region destination authentication modal (real Contentstack login). */
interface RegionLoginState {
  open: boolean;
  region?: string;
  prevRegion?: string;
  email: string;
  password: string;
  loading: boolean;
  error?: string;
}

interface DestinationState {
  regions: Option[];
  orgs: Option[];
  stacks: Option[];
  branches: Option[];
  /** Locales configured on the SELECTED destination stack. */
  locales: Option[];
  /** Every locale Contentstack supports — the create-stack master-locale picker. */
  allLocales: Option[];
  allLocalesLoading: boolean;
  allLocalesError?: string;
  /** The session's already-authenticated region (no login needed to use it). */
  homeRegion: string;
  /** Regions unlocked this session via region-login: region -> resolved userId. */
  regionAuth: Record<string, string>;
  region: string;
  org: string;
  stackApiKey: string;
  stackName: string;
  /** True only for a stack this panel created via UC-7 (drives EC-12 + UC-9a). */
  stackWasCreated: boolean;
  importAuth: { method?: ImportAuthMethod; managementTokenName: string };
  appsWarningDismissed: boolean;
  branchMapping: { srcBranch: string; destBranch: string };
  masterLocaleMapping: LocaleMapping;
  additionalLanguageMappings: LocaleMapping[];
  createStack: CreateStackState;
  stackStats?: StackStats;
  statsLoading: boolean;
  source: SourceContext;
  regionLogin: RegionLoginState;
  saving: boolean;
  error?: string;
  /** Set once the selection is persisted and the wizard may advance (FR-6.3). */
  proceeded: boolean;
}

const initialRegionLogin: RegionLoginState = {
  open: false,
  email: '',
  password: '',
  loading: false,
};

const initialCreateStack: CreateStackState = {
  open: false,
  name: '',
  description: '',
  masterLocale: '',
  loading: false,
};

const initialState: DestinationState = {
  regions: [],
  orgs: [],
  stacks: [],
  branches: [],
  locales: [],
  allLocales: [],
  allLocalesLoading: false,
  homeRegion: '',
  regionAuth: {},
  region: '',
  org: '',
  stackApiKey: '',
  stackName: '',
  stackWasCreated: false,
  importAuth: { method: undefined, managementTokenName: '' },
  appsWarningDismissed: false,
  branchMapping: { srcBranch: '', destBranch: '' },
  masterLocaleMapping: { srcLocale: '', destLocale: '' },
  additionalLanguageMappings: [],
  createStack: { ...initialCreateStack },
  statsLoading: false,
  source: { ready: false, region: '', branch: '', masterLocale: '' },
  regionLogin: initialRegionLogin,
  saving: false,
  proceeded: false,
};

const destinationSlice = createSlice({
  name: 'v3Destination',
  initialState,
  reducers: {
    setRegions: (state, action: PayloadAction<Option[]>) => {
      state.regions = action.payload;
    },
    setOrgs: (state, action: PayloadAction<Option[]>) => {
      state.orgs = action.payload;
    },
    setStacks: (state, action: PayloadAction<Option[]>) => {
      state.stacks = action.payload;
    },
    setBranches: (state, action: PayloadAction<Option[]>) => {
      state.branches = action.payload;
    },
    setLocales: (state, action: PayloadAction<Option[]>) => {
      state.locales = action.payload;
    },
    setAllLocales: (state, action: PayloadAction<Option[]>) => {
      state.allLocales = action.payload;
      state.allLocalesLoading = false;
      state.allLocalesError = undefined;
    },
    setAllLocalesLoading: (state, action: PayloadAction<boolean>) => {
      state.allLocalesLoading = action.payload;
    },
    /** Surfaced in the modal — a silently empty picker is indistinguishable from
     * "Contentstack returned nothing", and blocks stack creation with no reason. */
    setAllLocalesError: (state, action: PayloadAction<string | undefined>) => {
      state.allLocalesError = action.payload;
      state.allLocalesLoading = false;
    },
    setField: (
      state,
      action: PayloadAction<{ field: keyof DestinationState; value: any }>
    ) => {
      (state as any)[action.payload.field] = action.payload.value;
    },

    // ---- import authentication (FR-3.1–3.6) ----
    /** Switching method discards the method being left's entered token name
     * (EC-9). Re-selecting the ALREADY-active method is not a switch, so the
     * value the user typed survives. */
    setImportMethod: (state, action: PayloadAction<ImportAuthMethod>) => {
      if (state.importAuth.method === action.payload) return;
      state.importAuth = { method: action.payload, managementTokenName: '' };
      state.appsWarningDismissed = false;
    },
    setManagementTokenName: (state, action: PayloadAction<string>) => {
      state.importAuth.managementTokenName = action.payload;
    },
    dismissAppsWarning: (state) => {
      state.appsWarningDismissed = true;
    },

    // ---- branch + language mapping (FR-9.x, FR-4.x) ----
    setDestBranch: (state, action: PayloadAction<string>) => {
      state.branchMapping.destBranch = action.payload;
    },
    setDestMasterLocale: (state, action: PayloadAction<string>) => {
      state.masterLocaleMapping.destLocale = action.payload;
    },
    addLanguageRow: (state) => {
      state.additionalLanguageMappings.push({ srcLocale: '', destLocale: '' });
    },
    removeLanguageRow: (state, action: PayloadAction<number>) => {
      state.additionalLanguageMappings.splice(action.payload, 1);
    },
    setLanguageRow: (
      state,
      action: PayloadAction<{ index: number; field: keyof LocaleMapping; value: string }>
    ) => {
      const row = state.additionalLanguageMappings[action.payload.index];
      if (row) row[action.payload.field] = action.payload.value;
    },

    // ---- create a new stack (UC-7 / FR-1.4–1.6) ----
    openCreateStack: (state) => {
      state.createStack = { ...initialCreateStack, open: true };
    },
    /** Cancel creates nothing and discards the typed draft (FR-1.6 / AC-7.3). */
    cancelCreateStack: (state) => {
      state.createStack = { ...initialCreateStack };
    },
    setCreateStackField: (
      state,
      action: PayloadAction<{ field: 'name' | 'description' | 'masterLocale'; value: string }>
    ) => {
      state.createStack[action.payload.field] = action.payload.value;
      state.createStack.error = undefined;
    },
    setCreateStackLoading: (state, action: PayloadAction<boolean>) => {
      state.createStack.loading = action.payload;
    },
    setCreateStackError: (state, action: PayloadAction<string | undefined>) => {
      state.createStack.error = action.payload;
      state.createStack.loading = false;
    },
    /** A newly created stack is always empty (UC-9a), so its stats are known
     * without a fetch — and the previous stack's stats must not linger. */
    stackCreated: (
      state,
      action: PayloadAction<{ apiKey: string; name: string; masterLocale?: string }>
    ) => {
      const { apiKey, name, masterLocale } = action.payload;
      // Append to the option list as well as selecting it. The Stack dropdown
      // renders its options from `stacks`, so selecting an apiKey that isn't in
      // that list leaves the <select> bound to a value with no matching <option>
      // — the field renders blank and the new stack is invisible.
      if (!state.stacks.some((o) => o.value === apiKey)) {
        state.stacks.push({ value: apiKey, label: name });
      }
      state.stackApiKey = apiKey;
      state.stackName = name;
      state.stackWasCreated = true;
      state.createStack = { ...initialCreateStack };
      state.stackStats = { isEmpty: true, stats: [] };
      state.statsLoading = false;
      if (masterLocale) {
        // The locale chosen at creation IS the new stack's master locale, so it
        // is the destination side of the locked master-locale mapping row. A
        // brand-new stack has exactly this one locale — any list left over from
        // a previously selected stack must not linger.
        state.masterLocaleMapping.destLocale = masterLocale;
        state.locales = [{ value: masterLocale, label: masterLocale }];
      }
    },

    // ---- "Stack contents" card (FR-10.x) ----
    setStackStats: (state, action: PayloadAction<StackStats | undefined>) => {
      state.stackStats = action.payload;
      state.statsLoading = false;
    },
    setStatsLoading: (state, action: PayloadAction<boolean>) => {
      state.statsLoading = action.payload;
    },

    /** Persisted-source context (FR-8.3): also seeds the two locked mapping halves. */
    setSourceContext: (state, action: PayloadAction<SourceContext>) => {
      state.source = action.payload;
      state.branchMapping.srcBranch = action.payload.branch;
      state.masterLocaleMapping.srcLocale = action.payload.masterLocale;
    },

    // ---- cross-region destination authentication (FR-2.1–2.4) ----
    openRegionLogin: (
      state,
      action: PayloadAction<{ region: string; prevRegion: string }>
    ) => {
      state.region = action.payload.region;
      state.regionLogin = {
        ...initialRegionLogin,
        open: true,
        region: action.payload.region,
        prevRegion: action.payload.prevRegion,
      };
    },
    cancelRegionLogin: (state) => {
      if (state.regionLogin.prevRegion !== undefined) {
        state.region = state.regionLogin.prevRegion;
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
    regionAuthed: (
      state,
      action: PayloadAction<{ region: string; userId: string }>
    ) => {
      state.regionAuth[action.payload.region] = action.payload.userId;
      state.regionLogin = initialRegionLogin;
    },

    // ---- persist / resume (FR-6.3, UC-5) ----
    setSaving: (state, action: PayloadAction<boolean>) => {
      state.saving = action.payload;
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
    setProceeded: (state, action: PayloadAction<boolean>) => {
      state.proceeded = action.payload;
    },

    /**
     * Restore a previously persisted destination (UC-5 / AC-5.1). Tolerates a
     * partial document: anything absent keeps its current value rather than
     * being wiped, so a narrower persisted shape can never blank the form.
     */
    hydrate: (state, action: PayloadAction<Record<string, any>>) => {
      const d = action.payload ?? {};
      if (d.region !== undefined) state.region = d.region;
      if (d.orgId !== undefined) state.org = d.orgId;
      if (d.stack) {
        state.stackApiKey = d.stack.apiKey ?? state.stackApiKey;
        state.stackName = d.stack.name ?? state.stackName;
        state.stackWasCreated = !!d.stack.wasCreated;
      }
      if (d.importAuth?.method) {
        state.importAuth = {
          method: d.importAuth.method,
          managementTokenName: d.importAuth.managementToken?.name ?? '',
        };
      }
      if (d.branchMapping) state.branchMapping = { ...d.branchMapping };
      if (d.masterLocaleMapping) state.masterLocaleMapping = { ...d.masterLocaleMapping };
      if (d.additionalLanguageMappings) {
        state.additionalLanguageMappings = d.additionalLanguageMappings.map(
          (m: LocaleMapping) => ({ ...m })
        );
      }
      /*
        ⚠️ Deliberately does NOT touch `proceeded`. This reducer is a plain field setter,
        used both by the restore path and by tests/callers that just need to seed a few
        fields — an earlier version marked the destination complete here, which silently
        froze the panel for every such caller (it disabled the language-mapping remove
        button in TC_DEST_037, which seeds rows this way).

        "A document came back from the server, therefore this destination is committed" is
        knowledge that belongs to `loadPersistedDestination`, which is the only caller that
        actually knows it. It dispatches `setProceeded(true)` alongside this.
      */
    },

    reset: () => initialState,
  },
});

/**
 * Whether this project's destination is settled, and the Audit and Destination steps
 * should therefore both be frozen.
 *
 * One definition, consumed by both panels. `proceeded` is true after a successful persist
 * in-session and after `hydrate` restores a persisted document on a later visit.
 *
 * ⚠️ No "failed" override, unlike the Source panel's equivalent — and that asymmetry is
 * deliberate, not an omission. `proceedToContentMapping` mints the management token BEFORE
 * persisting and returns false having written nothing if the mint throws, so a failure
 * leaves no destination document at all. Failure and completion cannot coexist here, where
 * on the Source side a graph from an earlier success could sit alongside a later failure.
 *
 * The Audit step reads this rather than its own completion: an operator must be able to
 * revise include/exclude decisions right up until the destination is committed, so both
 * steps lock at the same moment and that moment is this one.
 */
export const isDestinationComplete = (
  d: Pick<DestinationState, 'proceeded'> | undefined
): boolean => !!d?.proceeded;

/**
 * FR-6.1 gate: every required field set AND the persisted source ready.
 * A pure derivation of state, so both the panel and the Proceed thunk can share
 * one definition of "ready" (and the panel can use it without pulling in thunks).
 */
export const canProceed = (d: DestinationState): boolean => {
  const authComplete =
    d.importAuth.method === 'authToken' ||
    (d.importAuth.method === 'management' && !!d.importAuth.managementTokenName.trim());
  return !!d.region && !!d.org && !!d.stackApiKey && authComplete && d.source.ready;
};

/** Display name for the selected destination stack: a created stack carries its
 * own name; an existing one is labelled by the stack list it came from. */
export const destStackLabel = (s: {
  stackApiKey: string;
  stackName: string;
  stacks: Option[];
}): string =>
  s.stacks.find((o) => o.value === s.stackApiKey)?.label || s.stackName || '';

export const destinationActions = destinationSlice.actions;
export default destinationSlice.reducer;
