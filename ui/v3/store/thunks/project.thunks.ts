import type { V3Dispatch, V3RootState } from '../index';
import { projectApi } from '../../services/api/project.service';
import { projectActions, ProjectRecord } from '../slice/project.slice';
import { destinationActions } from '../slice/destination.slice';
import { sourceActions } from '../slice/source.slice';

const errMsg = (e: any): string =>
  e?.response?.data?.message ??
  e?.response?.data?.error?.message ??
  e?.message ??
  'Something went wrong.';

/** A 401 is handled by the shared apiClient (clear + redirect), not by this page. */
const isUnauthorized = (e: any): boolean => e?.response?.status === 401;

/**
 * Loads the caller's projects (cs-project-dashboard trd.md TR-15).
 *
 * No organization parameter of any kind — the scope is the caller's region and
 * user id, both derived server-side from the verified token (FR-3.1, FR-9.6).
 *
 * The previous revision needed a guard here that discarded a response for an
 * organization the user had switched away from. With no organization to switch
 * there is no such race, and the guard is deleted rather than kept as dead code.
 */
export const loadProjects =
  () => async (dispatch: V3Dispatch, getState: () => V3RootState) => {
    dispatch(projectActions.listPending());
    try {
      const { data } = await projectApi.getProjects();
      dispatch(projectActions.listLoaded((data?.projects ?? []) as ProjectRecord[]));
    } catch (e) {
      if (isUnauthorized(e)) {
        // Neither an error nor an empty list: the shared client has already
        // cleared the session and redirected. Rendering "No projects yet" on the
        // way out would tell the user something untrue (AC-7.3).
        dispatch(projectActions.listUnauthorized());
        return;
      }
      dispatch(projectActions.listFailed(errMsg(e)));
    }
  };

/**
 * Creates a project and returns it, or null on failure (trd.md TR-15).
 *
 * Single-flight: `createPending` is dispatched BEFORE the await, and Redux
 * dispatch is synchronous, so a second call in the same tick observes
 * `creating === true` and returns immediately. Guarding on the submit control's
 * disabled state alone would not hold — two activations in one tick both read the
 * pre-update value. v3 cannot delete a project, so a duplicate is permanent
 * (FR-7.12, EC-16, TRR-2).
 */
export const createProject =
  (input: { name: string; description?: string }) =>
  async (
    dispatch: V3Dispatch,
    getState: () => V3RootState
  ): Promise<ProjectRecord | null> => {
    if (getState().project.creating) return null;
    dispatch(projectActions.createPending());

    try {
      // Only the name and the description leave the client. Anything else a caller
      // passed — an id, an owner, a region, an organization — is dropped here rather
      // than forwarded, because the server owns those and organization is not a
      // property of a project at all (FR-7.8, FR-9.7).
      const { data } = await projectApi.createProject({
        name: input.name,
        description: input.description ?? '',
      });
      const created = data?.project as ProjectRecord | undefined;
      if (!created?.id) {
        dispatch(projectActions.createFailed('The project was not created.'));
        return null;
      }

      // Discard wizard state left over from a previously open project BEFORE the
      // caller navigates, so the new project never inherits it (FR-7.9). Only on
      // success — resetting on failure would destroy the state of whatever the
      // user still has open.
      dispatch(destinationActions.reset());
      dispatch(sourceActions.reset());
      dispatch(projectActions.createSettled());
      return created;
    } catch (e) {
      dispatch(projectActions.createFailed(errMsg(e)));
      return null;
    }
  };
