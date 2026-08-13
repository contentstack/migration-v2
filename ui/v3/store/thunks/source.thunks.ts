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
    dispatch(sourceActions.clearExportState());
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
      dispatch(sourceActions.clearExportState());
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
    dispatch(sourceActions.clearExportState());
    dispatch(sourceActions.setBranches([]));
    dispatch(sourceActions.setStackField({ field: 'stacksError', value: undefined }));
    dispatch(sourceActions.setStackField({ field: 'stacksLoading', value: true }));
    try {
      const rc = currentCredential(getState());
      const { data } = await sourceApi.getStacks(org, rc);
      dispatch(
        sourceActions.setStacks(
          (data.stacks ?? []).map((s: any) => ({ value: s.apiKey, label: s.name }))
        )
      );
    } catch (e) {
      dispatch(sourceActions.setStackField({ field: 'stacksError', value: errMsg(e) }));
    } finally {
      dispatch(sourceActions.setStackField({ field: 'stacksLoading', value: false }));
    }
  };

export const selectStack =
  (stackApiKey: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: stackApiKey }));
    dispatch(sourceActions.setStackField({ field: 'branch', value: 'main' }));
    dispatch(sourceActions.clearExportState());
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
  dispatch(sourceActions.clearExportState());
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

/**
 * Restores a project's SAVED source selection when the Source page opens.
 *
 * `loadPersistedGraph` above already restores the graph, but nothing restored the
 * selection — and because the graph is only rendered when a stack is selected, that one
 * gap produced two visible faults: the graph appeared to vanish on returning to the page,
 * and the (disabled) selects fell through to their placeholders, reading
 * "Select an organization…" for a project that plainly had one.
 *
 * ⚠️ Deliberately does NOT reuse `selectRegion` / `selectOrg`. Those express user INTENT:
 * they clear downstream fields and call `clearExportState()` — which would delete the very
 * graph this restore exists to reveal — and `selectRegion` opens the region-login modal for
 * any non-home region, which would ambush the operator on every visit to an old project.
 *
 * The saved record holds IDS only, no names, so the org and stack lists are fetched to
 * resolve labels. Those fetches are best-effort: if they fail the ids remain restored and
 * `V3Select` shows the id, which is worse-looking but true. Failing the whole restore
 * because a name could not be looked up would take the graph down with it.
 */
export const loadPersistedSource =
  (projectId: string) => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    let saved: any;
    try {
      const { data } = await sourceApi.getSource(projectId);
      saved = data?.source;
    } catch {
      /* No saved source — a fresh project hits this on every visit. Leave state alone. */
      return;
    }
    if (!saved) return;

    if (saved.mode === 'file' && saved.file) {
      dispatch(sourceActions.setMode('file'));
      if (saved.file.fileName) {
        dispatch(
          sourceActions.setFileSelected({
            fileName: saved.file.fileName,
            sizeBytes: saved.file.sizeBytes ?? 0,
          })
        );
      }
      if (saved.file.sourceId) {
        dispatch(
          sourceActions.setFileValidated({
            sourceId: saved.file.sourceId,
            manifest: saved.file.manifest ?? [],
          })
        );
      }
      if (saved.file.scope) dispatch(sourceActions.setFileField({ field: 'scope', value: saved.file.scope }));
      if (saved.file.selectedModules) {
        dispatch(sourceActions.setFileField({ field: 'selectedModules', value: saved.file.selectedModules }));
      }
      return;
    }

    const st = saved.stack;
    if (!st) return;

    dispatch(sourceActions.setMode('stack'));
    // Field-by-field, so nothing that is absent from an older record is overwritten with
    // undefined — and nothing here clears the graph.
    if (st.region) dispatch(sourceActions.setStackField({ field: 'region', value: st.region }));
    if (st.orgId) dispatch(sourceActions.setStackField({ field: 'org', value: st.orgId }));
    if (st.stackApiKey) dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: st.stackApiKey }));
    if (st.branch) dispatch(sourceActions.setStackField({ field: 'branch', value: st.branch }));
    if (st.scope) dispatch(sourceActions.setStackField({ field: 'scope', value: st.scope }));
    if (st.selectedModules) {
      dispatch(sourceActions.setStackField({ field: 'selectedModules', value: st.selectedModules }));
    }

    /*
      Label lookup, best-effort and read-only — no clearing, no modal. Each list is
      fetched independently so one failure does not cost the other's names.
    */
    const rc = { region: st.region, regionUserId: getState().source.stack.regionAuth?.[st.region] };
    try {
      const { data } = await sourceApi.getOrgs(rc as any);
      dispatch(
        sourceActions.setOrgs((data.orgs ?? []).map((o: any) => ({ value: o.uid, label: o.name })))
      );
    } catch {
      /* keep the id — see the note above */
    }
    if (st.orgId) {
      try {
        const { data } = await sourceApi.getStacks(st.orgId, rc as any);
        dispatch(
          sourceActions.setStacks(
            (data.stacks ?? []).map((x: any) => ({ value: x.apiKey, label: x.name }))
          )
        );
      } catch {
        /* keep the id */
      }
    }
  };

/**
 * Base poll interval (ms) for export status. Small in tests via VITE_V3_POLL_MS.
 *
 * Read at CALL time, not module load. A module-level constant freezes the value before any
 * test or runtime override can apply — the same trap that made the server's log cap
 * unconfigurable and untestable.
 */
const pollMs = (): number => Number(import.meta.env?.VITE_V3_POLL_MS) || 800;

/**
 * How long the client will watch an export before it stops polling.
 *
 * ⚠️ Was 75 polls × 800 ms = 60 SECONDS, which pre-dated the CLI. Measured against real
 * stacks after the switch:
 *
 *     233s   62 MB stack   -> the client called it "timed out"; it had SUCCEEDED
 *     230s                 -> same
 *      51s   small stack   -> finished inside the old budget
 *
 * The CLI exports all 17 modules and downloads every asset binary, so minutes is normal
 * and 60 seconds was calling completed work a failure — then inviting the operator to
 * discard a finished 4-minute export and start over.
 *
 * 30 minutes is deliberately generous rather than tuned just past what was observed: a
 * large customer stack is far bigger than the 62 MB case measured here. It is still
 * bounded, because a server that never resolves the job must eventually release the
 * client rather than leaving a spinner that can never end.
 */
const pollBudgetMs = (): number =>
  Number(import.meta.env?.VITE_V3_POLL_BUDGET_MS) || 30 * 60 * 1000;

/**
 * The wait before poll number `n`, backing off as the export runs long.
 *
 * The first polls stay at the base interval so a short export still feels immediate.
 * After that the cadence relaxes: polling a 4-minute job every 800 ms costs ~290 requests,
 * and each one serialises the job's whole log, so the cost grows with exactly the exports
 * that are already slow.
 */
const pollDelay = (n: number): number => {
  const base = pollMs();
  if (n < 15) return base;        // first ~12s at the base cadence
  if (n < 45) return base * 3;    // then ~2.4s
  return base * 6;                // then ~5s
};

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
    dispatch(sourceActions.setJobStage(undefined));
    dispatch(sourceActions.setJobDroppedLogs(undefined));
    dispatch(sourceActions.setRunning(true));
    try {
      const { data } = await sourceApi.startExport(body);
      const jobId: string = data.jobId;
      dispatch(sourceActions.setJob({ jobId, jobStatus: 'queued' }));

      let status = 'queued';
      const deadline = Date.now() + pollBudgetMs();
      for (let i = 0; status !== 'succeeded' && status !== 'failed'; i++) {
        // Time-based rather than a poll count: with backoff, a fixed number of polls no
        // longer corresponds to a predictable wall-clock budget.
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, pollDelay(i)));
        const s = await sourceApi.getExportStatus(jobId);
        status = s.data.status;
        dispatch(sourceActions.setJob({ jobId, jobStatus: status as any }));
        if (s.data.logs) dispatch(sourceActions.setJobLogs(s.data.logs));
        if (s.data.liveCounts) dispatch(sourceActions.setJobLiveCounts(s.data.liveCounts));
        if (typeof s.data.progress === 'number') dispatch(sourceActions.setJobProgress(s.data.progress));
        // Assigned unconditionally: the server OMITS `stage` for file mode, and a
        // guarded assignment would leave the last stack export's caption on screen.
        dispatch(sourceActions.setJobStage(s.data.stage));
        dispatch(sourceActions.setJobDroppedLogs(s.data.droppedLogs));
      }

      if (status === 'succeeded') {
        const g = await sourceApi.getGraph(projectId);
        dispatch(sourceActions.setGraph(g.data));
      } else if (status === 'failed') {
        dispatch(sourceActions.setError('Export failed. Please try again.'));
      } else {
        /*
          The client stopped watching, but the job is still running on the server — this is
          NOT a failure and must not be reported as one. The old copy ("Export timed out.
          Please try again.") described work that had in fact completed and invited the
          operator to throw it away.

          `jobStatus` is deliberately left as whatever the server last reported, never
          forced to 'failed': `isExportComplete` keys on that value, so writing 'failed'
          here would also unfreeze a form whose export is still in progress.
        */
        dispatch(
          sourceActions.setError(
            'This export is still running on the server. It will finish in the background — reload this page to pick up the result.'
          )
        );
      }
    } catch (e) {
      dispatch(sourceActions.setError(errMsg(e)));
    } finally {
      dispatch(sourceActions.setRunning(false));
    }
  };
