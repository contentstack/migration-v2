import type { V3Dispatch, V3RootState } from '../index';
import { sourceApi, StartExportBody, RegionCredential } from '../../services/api/source.service';
import { sourceActions } from '../slice/source.slice';

const errMsg = (e: any): string =>
  e?.response?.data?.message ??
  e?.response?.data?.error?.message ??
  e?.message ??
  'Something went wrong.';

/** Client-side fallback so the Region dropdown is never limited to one entry
 * or blank, even if the /regions call fails or returns something unexpected. */
const DEFAULT_REGIONS = [
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
  { value: 'AZURE_NA', label: 'Azure North America' },
  { value: 'AZURE_EU', label: 'Azure Europe' },
  { value: 'GCP_NA', label: 'GCP North America' },
];
const DEFAULT_HOME_REGION = 'NA';

/** Credential for the currently-selected stack region: home region needs
 * none (the session covers it); a region unlocked via region-login carries
 * its resolved userId. */
const currentCredential = (state: V3RootState): RegionCredential => {
  const { region, regionAuth } = state.source.stack;
  return { region, regionUserId: regionAuth[region] };
};

const loadOrgsFor = async (dispatch: V3Dispatch, rc: RegionCredential) => {
  dispatch(sourceActions.setStacks([]));
  dispatch(sourceActions.setBranches([]));
  try {
    const { data } = await sourceApi.getOrgs(rc);
    dispatch(
      sourceActions.setOrgs((data.orgs ?? []).map((o: any) => ({ value: o.uid, label: o.name })))
    );
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  }
};

/**
 * Load the session's home region + all selectable regions, then its orgs.
 * Defaults to NA / the full region list on any gap in the response, so the
 * dropdown is never blank or limited to a single entry.
 */
export const loadRegions = () => async (dispatch: V3Dispatch) => {
  const applyDefaults = async () => {
    dispatch(sourceActions.setRegions(DEFAULT_REGIONS));
    dispatch(sourceActions.setStackField({ field: 'homeRegion', value: DEFAULT_HOME_REGION }));
    dispatch(sourceActions.setStackField({ field: 'region', value: DEFAULT_HOME_REGION }));
    await loadOrgsFor(dispatch, { region: DEFAULT_HOME_REGION });
  };

  try {
    const { data } = await sourceApi.getRegions();
    const regions = data.regions?.length ? data.regions : DEFAULT_REGIONS;
    const homeRegion: string = data.homeRegion || DEFAULT_HOME_REGION;

    dispatch(sourceActions.setRegions(regions));
    dispatch(sourceActions.setStackField({ field: 'homeRegion', value: homeRegion }));
    dispatch(sourceActions.setStackField({ field: 'region', value: homeRegion }));
    dispatch(sourceActions.setStackField({ field: 'org', value: '' }));
    dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
    await loadOrgsFor(dispatch, { region: homeRegion });
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
    await applyDefaults();
  }
};

/**
 * Region select changed. The home region (or one already unlocked this
 * session via region-login) loads immediately. Any other region requires a
 * fresh Contentstack login for that region first — the login modal opens and
 * org/stack loading is deferred until it succeeds (see submitRegionLogin).
 */
export const selectRegion =
  (region: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const st = getState().source.stack;
    const alreadyUnlocked = region === st.homeRegion || !!st.regionAuth[region];

    if (!alreadyUnlocked) {
      dispatch(sourceActions.openRegionLogin({ region, prevRegion: st.region }));
      return;
    }

    dispatch(sourceActions.setStackField({ field: 'region', value: region }));
    dispatch(sourceActions.setStackField({ field: 'org', value: '' }));
    dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
    await loadOrgsFor(dispatch, { region, regionUserId: st.regionAuth[region] });
  };

/** Submit the region-login modal: real Contentstack login, then unlock the region. */
export const submitRegionLogin =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const rl = getState().source.regionLogin;
    if (!rl.region || !rl.email.trim() || !rl.password.trim()) return;

    dispatch(sourceActions.setRegionLoginLoading(true));
    try {
      const { data } = await sourceApi.regionLogin(rl.region, rl.email.trim(), rl.password);
      dispatch(sourceActions.regionAuthed({ region: rl.region, userId: data.userId }));
      dispatch(sourceActions.setStackField({ field: 'org', value: '' }));
      dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
      await loadOrgsFor(dispatch, { region: rl.region, regionUserId: data.userId });
    } catch (e) {
      dispatch(sourceActions.setRegionLoginError(errMsg(e)));
    }
  };

export const cancelRegionLogin = () => (dispatch: V3Dispatch) => {
  dispatch(sourceActions.cancelRegionLogin());
};

export const selectOrg =
  (org: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(sourceActions.setStackField({ field: 'org', value: org }));
    dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
    dispatch(sourceActions.setBranches([]));
    try {
      const rc = currentCredential(getState());
      const { data } = await sourceApi.getStacks(org, rc);
      dispatch(
        sourceActions.setStacks(
          (data.stacks ?? []).map((s: any) => ({ value: s.apiKey, label: s.name }))
        )
      );
    } catch (e) {
      dispatch(sourceActions.setError(errMsg(e)));
    }
  };

export const selectStack =
  (stackApiKey: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: stackApiKey }));
    dispatch(sourceActions.setStackField({ field: 'branch', value: 'main' }));
    try {
      const rc = currentCredential(getState());
      const { data } = await sourceApi.getBranches(stackApiKey, rc);
      dispatch(
        sourceActions.setBranches(
          (data.branches ?? []).map((b: any) => ({ value: b.uid, label: b.uid }))
        )
      );
    } catch (e) {
      dispatch(sourceActions.setError(errMsg(e)));
    }
  };

/**
 * Loads a stack's modules for the "Specific module" picker. Tracks its own
 * `modulesLoading`/`modulesError` — distinct from `modules.length === 0`,
 * which is ambiguous between still-loading, load-failed, and genuinely empty.
 * Without this, a failed fetch left the panel stuck on "Loading modules…"
 * forever with no way to tell it had actually failed, or to retry.
 */
export const loadStackModules =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const state = getState();
    const st = state.source.stack;
    if (!st.stackApiKey) return;

    dispatch(sourceActions.setStackField({ field: 'modulesLoading', value: true }));
    dispatch(sourceActions.setStackField({ field: 'modulesError', value: undefined }));
    try {
      const rc = currentCredential(state);
      const { data } = await sourceApi.getStackModules(st.stackApiKey, st.branch, rc);
      dispatch(sourceActions.setStackField({ field: 'modules', value: data.modules ?? [] }));
    } catch (e) {
      dispatch(sourceActions.setStackField({ field: 'modulesError', value: errMsg(e) }));
    } finally {
      dispatch(sourceActions.setStackField({ field: 'modulesLoading', value: false }));
    }
  };

/** Upload + validate a bundle, then load its modules (file mode). */
export const uploadFile = (file: File) => async (dispatch: V3Dispatch) => {
  dispatch(sourceActions.setError(undefined));
  dispatch(sourceActions.setValidating(true));
  try {
    const { data } = await sourceApi.uploadBundle(file);
    dispatch(
      sourceActions.setFileValidated({ sourceId: data.sourceId, manifest: data.manifest ?? [] })
    );
    const mods = await sourceApi.getFileModules(data.sourceId);
    dispatch(sourceActions.setFileField({ field: 'modules', value: mods.data.modules ?? [] }));
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  } finally {
    dispatch(sourceActions.setValidating(false));
  }
};

/**
 * Restore a previously-persisted content graph when returning to the step
 * (UC-4 / TC_SRC_037). A 404 (no graph yet) is not an error — it's the normal
 * pre-export state.
 */
export const loadPersistedGraph =
  (projectId: string) => async (dispatch: V3Dispatch) => {
    try {
      const { data } = await sourceApi.getGraph(projectId);
      if (data && data.counts) dispatch(sourceActions.setGraph(data));
    } catch {
      /* no persisted graph yet — leave state as-is */
    }
  };

/** Poll interval (ms) for export status. Small in tests via V3_POLL_MS. */
const POLL_MS = Number(import.meta.env?.VITE_V3_POLL_MS) || 800;

/** Start the export for the current selection and poll until the graph is ready. */
export const startExportAndPoll =
  (projectId: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const st = getState().source;
    const orgId = st.stack.org || '';
    const rc = currentCredential(getState());

    const body: StartExportBody =
      st.mode === 'stack'
        ? {
            orgId,
            projectId,
            mode: 'stack',
            stack: {
              region: st.stack.region,
              regionUserId: rc.regionUserId,
              orgId: st.stack.org,
              stackApiKey: st.stack.stackApiKey,
              branch: st.stack.branch,
              scope: st.stack.scope,
              selectedModules: st.stack.selectedModules,
            },
          }
        : {
            orgId,
            projectId,
            mode: 'file',
            file: {
              sourceId: st.file.sourceId,
              scope: st.file.scope,
              selectedModules: st.file.selectedModules,
            },
          };

    dispatch(sourceActions.setError(undefined));
    dispatch(sourceActions.setJobLogs([]));
    dispatch(sourceActions.setJobLiveCounts(undefined));
    dispatch(sourceActions.setJobProgress(0));
    dispatch(sourceActions.setRunning(true));
    try {
      const { data } = await sourceApi.startExport(body);
      const jobId: string = data.jobId;
      dispatch(sourceActions.setJob({ jobId, jobStatus: 'queued' }));

      let status = 'queued';
      for (let i = 0; i < 75 && status !== 'succeeded' && status !== 'failed'; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const s = await sourceApi.getExportStatus(jobId);
        status = s.data.status;
        dispatch(sourceActions.setJob({ jobId, jobStatus: status as any }));
        if (s.data.logs) dispatch(sourceActions.setJobLogs(s.data.logs));
        if (s.data.liveCounts) dispatch(sourceActions.setJobLiveCounts(s.data.liveCounts));
        if (typeof s.data.progress === 'number') dispatch(sourceActions.setJobProgress(s.data.progress));
      }

      if (status === 'succeeded') {
        const g = await sourceApi.getGraph(projectId);
        dispatch(sourceActions.setGraph(g.data));
      } else if (status === 'failed') {
        dispatch(sourceActions.setError('Export failed. Please try again.'));
      } else {
        dispatch(sourceActions.setError('Export timed out. Please try again.'));
      }
    } catch (e) {
      dispatch(sourceActions.setError(errMsg(e)));
    } finally {
      dispatch(sourceActions.setRunning(false));
    }
  };
