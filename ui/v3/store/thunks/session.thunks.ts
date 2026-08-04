import type { V3Dispatch } from '../index';
import { userApi } from '../../services/api/user.service';
import { sessionActions } from '../slice/session.slice';

const errMsg = (e: any): string =>
  e?.response?.data?.message ??
  e?.response?.data?.error?.message ??
  e?.message ??
  'Something went wrong.';

/**
 * Loads the authenticated user's display identity (cs-project-dashboard TR-6).
 *
 * Independent of the project list on purpose: a slow or failed user read must not
 * delay or break the list, and vice versa (feature.md EC-19). Callers fire the two
 * in parallel rather than sequencing them.
 */
export const loadUser = () => async (dispatch: V3Dispatch) => {
  dispatch(sessionActions.userLoading());
  try {
    const { data } = await userApi.getUser();
    dispatch(sessionActions.userLoaded(data?.user));
  } catch (e) {
    dispatch(sessionActions.userFailed(errMsg(e)));
  }
};
