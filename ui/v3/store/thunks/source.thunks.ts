import type { V3Dispatch, V3RootState } from '../index';
import { sourceApi, StartExportBody } from '../../services/api/source.service';
import { sourceActions } from '../slice/source.slice';

const errMsg = (e: any): string =>
  e?.response?.data?.message ??
  e?.response?.data?.error?.message ??
  e?.message ??
  'Something went wrong.';

/** Load the (session) region, auto-select it, and load its orgs. */
export const loadRegions = () => async (dispatch: V3Dispatch) => {
  try {
    const { data } = await sourceApi.getRegions();
    const regions = data.regions ?? [];
    dispatch(sourceActions.setRegions(regions));
    if (regions.length === 1) {
      await dispatch(selectRegion(regions[0].value) as any);
    }
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  }
};

export const selectRegion = (region: string) => async (dispatch: V3Dispatch) => {
  dispatch(sourceActions.setStackField({ field: 'region', value: region }));
  dispatch(sourceActions.setStackField({ field: 'org', value: '' }));
  dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
  dispatch(sourceActions.setStacks([]));
  dispatch(sourceActions.setBranches([]));
  try {
    const { data } = await sourceApi.getOrgs();
    dispatch(
      sourceActions.setOrgs((data.orgs ?? []).map((o: any) => ({ value: o.uid, label: o.name })))
    );
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  }
};

export const selectOrg = (org: string) => async (dispatch: V3Dispatch) => {
  dispatch(sourceActions.setStackField({ field: 'org', value: org }));
  dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: '' }));
  dispatch(sourceActions.setBranches([]));
  try {
    const { data } = await sourceApi.getStacks(org);
    dispatch(
      sourceActions.setStacks(
        (data.stacks ?? []).map((s: any) => ({ value: s.apiKey, label: s.name }))
      )
    );
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  }
};

export const selectStack = (stackApiKey: string) => async (dispatch: V3Dispatch) => {
  dispatch(sourceActions.setStackField({ field: 'stackApiKey', value: stackApiKey }));
  dispatch(sourceActions.setStackField({ field: 'branch', value: 'main' }));
  try {
    const { data } = await sourceApi.getBranches(stackApiKey);
    dispatch(
      sourceActions.setBranches(
        (data.branches ?? []).map((b: any) => ({ value: b.uid, label: b.uid }))
      )
    );
  } catch (e) {
    dispatch(sourceActions.setError(errMsg(e)));
  }
};

export const loadStackModules =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    const st = getState().source.stack;
    if (!st.stackApiKey) return;
    try {
      const { data } = await sourceApi.getStackModules(st.stackApiKey, st.branch);
      dispatch(sourceActions.setStackField({ field: 'modules', value: data.modules ?? [] }));
    } catch (e) {
      dispatch(sourceActions.setError(errMsg(e)));
    }
  };

/** Upload + validate a bundle, then load its modules (file mode). */
export const uploadFile = (file: File) => async (dispatch: V3Dispatch) => {
  dispatch(sourceActions.setError(undefined));
  dispatch(sourceActions.setRunning(true));
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
    dispatch(sourceActions.setRunning(false));
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

    const body: StartExportBody =
      st.mode === 'stack'
        ? {
            orgId,
            projectId,
            mode: 'stack',
            stack: {
              region: st.stack.region,
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
