import type { V3Dispatch, V3RootState } from '../index';
import { auditApi } from '../../services/api/audit.service';
import { auditActions } from '../slice/audit.slice';

/**
 * v3 Audit step thunks (cs-audit-report trd.md TR-19, TR-20).
 *
 * The flow the panel drives, per trd.md §4: ask for cached findings first; a 404 means
 * nothing is cached, so start a scan and poll it. Decisions are written on Continue
 * only (TC-6), so nothing here persists on a toggle.
 */
const POLL_INTERVAL_MS = 400;
const POLL_LIMIT = 300;

const errMsg = (e: any): string =>
  e?.response?.data?.error?.message ?? e?.message ?? 'Something went wrong.';

const isNotFound = (e: any): boolean => e?.response?.status === 404;

export interface LoadItemsRequest {
  projectId: string;
  filter: string;
  q: string;
  page: number;
}

/**
 * Loads one page of items.
 *
 * Takes the request EXPLICITLY rather than reading it back out of the slice. The caller
 * has just decided what to ask for — a new filter resets the page, a new search resets
 * the page — and passing that decision in makes it observable, where reading state would
 * hide it behind whatever the reducer happened to have applied first.
 */
export const loadAuditItems =
  (request: LoadItemsRequest) => async (dispatch: V3Dispatch) => {
    const { projectId, filter, q, page } = request;
    dispatch(auditActions.setItemsLoading(true));
    try {
      const { data } = await auditApi.getItems(projectId, { filter, q, page });
      dispatch(
        auditActions.itemsLoaded({
          items: data.items ?? [],
          page: data.page ?? 1,
          pageCount: data.pageCount ?? 1,
          total: data.total ?? 0,
          counts: data.counts ?? {
            all: 0, entries: 0, assets: 0, contentTypes: 0, globalFields: 0,
          },
        })
      );
    } catch {
      // A failed page leaves the previous rows in place rather than blanking the table;
      // the loading flag is cleared so the user can retry by changing a control.
      dispatch(auditActions.setItemsLoading(false));
    }
  };

/** Polls a running scan until it settles, then loads the findings it produced. */
export const pollAuditJob =
  (projectId: string, jobId: string) =>
  async (dispatch: V3Dispatch): Promise<void> => {
    for (let i = 0; i < POLL_LIMIT; i++) {
      try {
        const { data } = await auditApi.getJob(projectId, jobId);
        dispatch(auditActions.scanProgress(data.checks ?? []));

        if (data.status === 'succeeded') {
          await dispatch(loadAuditFindings(projectId) as never);
          return;
        }
        if (data.status === 'failed') {
          dispatch(auditActions.scanFailed(data.error ?? 'internal'));
          return;
        }
      } catch (e) {
        /*
          An unknown job id — every id is unknown after an api restart, because the
          registry is in-memory (TRR-1). Treated as "start again" rather than as fatal,
          so a restart mid-scan costs the user a click, not the step.
        */
        if (isNotFound(e)) {
          dispatch(auditActions.reset());
          return;
        }
        dispatch(auditActions.scanFailed('internal'));
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    dispatch(auditActions.scanFailed('internal'));
  };

/** Starts a scan and follows it to completion. */
export const startAuditScan =
  (projectId: string, opts: { force?: boolean } = {}) =>
  async (dispatch: V3Dispatch) => {
    try {
      const { data } = await auditApi.startScan(projectId, opts);
      dispatch(
        auditActions.scanStarted({
          jobId: data.jobId,
          checks: [
            { id: 'unusedAssets', label: 'Unused assets — referenced by any entry?', state: 'queued' },
            { id: 'unpublishedEntries', label: 'Unpublished entries — has publish details?', state: 'queued' },
            { id: 'emptyContentTypes', label: 'Empty content types — any entries at all?', state: 'queued' },
            { id: 'unusedGlobalFields', label: 'Unused global fields — referenced by a schema?', state: 'queued' },
          ],
        })
      );
      await dispatch(pollAuditJob(projectId, data.jobId) as never);
    } catch (e: any) {
      // 409 means there is no export to audit at all (EC-17).
      dispatch(
        auditActions.scanFailed(
          e?.response?.status === 409 ? 'export_missing' : 'internal'
        )
      );
    }
  };

/**
 * The step's entry point. Cached findings render immediately; a 404 starts a scan —
 * which is what makes AC-1.4's "no re-scan" true without the client having to know
 * whether one is needed.
 */
export const loadAuditFindings =
  (projectId: string) => async (dispatch: V3Dispatch) => {
    try {
      const { data } = await auditApi.getFindings(projectId);
      dispatch(
        auditActions.findingsLoaded({
          checks: data.findings?.checks ?? [],
          totals: data.findings?.totals,
          variantsInspected: !!data.findings?.variantsInspected,
          decisions: data.decisions ?? { categories: {}, itemOverrides: {} },
        })
      );
      await dispatch(
        loadAuditItems({ projectId, filter: 'all', q: '', page: 1 }) as never
      );
    } catch (e) {
      if (isNotFound(e)) {
        await dispatch(startAuditScan(projectId) as never);
        return;
      }
      dispatch(auditActions.scanFailed('internal'));
    }
  };

/**
 * Re-run: ignores the cache. The toast is raised by the PANEL at the moment the user
 * clicks, not here — announcing it from the thunk would tie the acknowledgement to work
 * starting rather than to the interaction, and would be invisible to a caller that has
 * mocked the thunks.
 */
export const rerunAudit = (projectId: string) => async (dispatch: V3Dispatch) => {
  await dispatch(startAuditScan(projectId, { force: true }) as never);
};

/** Persists the working decision set. Resolves false so the caller can stay put. */
export const persistAuditDecisions =
  (projectId: string) =>
  async (dispatch: V3Dispatch, getState: () => V3RootState): Promise<boolean> => {
    const { decisions } = getState().audit;
    dispatch(auditActions.setSaving(true));
    try {
      const { data } = await auditApi.putDecisions(projectId, decisions);
      dispatch(
        auditActions.decisionsPersisted(
          data.decisions ?? decisions
        )
      );
      return true;
    } catch (e) {
      dispatch(auditActions.setSaving(false));
      dispatch(auditActions.setError(errMsg(e)));
      return false;
    }
  };

/**
 * The chrome's step gate. Persists first and resolves true only on success, so the
 * wizard cannot advance past decisions that were never written (FR-8.4, AC-6.5).
 */
export const proceedFromAudit =
  (projectId: string) =>
  async (dispatch: V3Dispatch, getState: () => V3RootState): Promise<boolean> => {
    if (getState().audit.phase !== 'ready') return false;
    return dispatch(persistAuditDecisions(projectId) as never) as unknown as Promise<boolean>;
  };
