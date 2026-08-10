import type { V3Dispatch, V3RootState } from '../index';
import { contentMappingApi } from '../../services/api/contentMapping.service';
import { contentMappingActions } from '../slice/contentMapping.slice';

/**
 * v3 Content mapping thunks (cs-content-type-selection trd.md TR-19, TR-22, TR-23).
 *
 * Nothing here writes on a tick. The selection is persisted by the explicit save
 * control and by the step gate's advance, and by nothing else (TC-5).
 */
const errMsg = (e: any): string =>
  e?.response?.data?.error?.message ?? e?.message ?? 'Something went wrong.';

/** API-1 — load the inventory and hydrate the working selection from the record. */
export const loadContentTypeInventory =
  (projectId: string) =>
  async (dispatch: V3Dispatch): Promise<boolean> => {
    dispatch(contentMappingActions.loadStarted());
    try {
      const { data } = await contentMappingApi.getInventory(projectId);
      dispatch(
        contentMappingActions.inventoryLoaded({
          contentTypes: data?.contentTypes ?? [],
          destinationRead: !!data?.destinationRead,
          destinationReadFailure: data?.destinationReadFailure,
          persistedSelection: data?.selection,
        })
      );
      return true;
    } catch (e) {
      dispatch(contentMappingActions.loadFailed(errMsg(e)));
      return false;
    }
  };

/** API-2 — persist the working selection. Resolves false on any failure. */
export const persistContentTypeSelection =
  (projectId: string) =>
  async (dispatch: V3Dispatch, getState: () => V3RootState): Promise<boolean> => {
    const { selection } = getState().contentMapping;
    dispatch(contentMappingActions.setSaving(true));
    try {
      const { data } = await contentMappingApi.putSelection(
        projectId,
        selection.contentTypes
      );
      dispatch(contentMappingActions.saveSucceeded(data?.selection ?? selection));
      return true;
    } catch (e) {
      dispatch(contentMappingActions.saveFailed(errMsg(e)));
      return false;
    }
  };

/**
 * The chrome's step gate. Persists first and resolves true only on success, so
 * the wizard cannot advance past a selection that was never written (FR-8.6).
 */
export const proceedFromContentMapping =
  (projectId: string) =>
  async (dispatch: V3Dispatch, getState: () => V3RootState): Promise<boolean> => {
    if (getState().contentMapping.phase !== 'ready') return false;
    return dispatch(persistContentTypeSelection(projectId) as never) as unknown as Promise<boolean>;
  };
