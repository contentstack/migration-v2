import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { deleteCall, getCall, putCall } from './service';

export const getUser = async () => {
  const options = {
    headers: {
      app_token: getDataFromLocalStorage('app_token')
    }
  };

  try {
    return await getCall(`${API_VERSION}/user/profile`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

/** Profile for a specific JWT (e.g. regional source login) without replacing main `app_token`. */
export const getUserProfileWithToken = async (appToken: string) => {
  const options = {
    headers: {
      app_token: appToken
    }
  };
  try {
    return await getCall(`${API_VERSION}/user/profile`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in getUserProfileWithToken: ${error.message}`);
    }
    throw new Error('Unknown error in getUserProfileWithToken');
  }
};

/**
 * Stack-to-stack migration: regional source-login session is persisted on
 * the backend user record (not browser storage), so the source app token
 * never lives in sessionStorage/localStorage and survives across sessions.
 */
const sourceSessionHeaders = () => ({
  headers: { app_token: getDataFromLocalStorage('app_token') }
});

export const fetchSourceSession = async (): Promise<{
  region: string;
  appToken: string;
} | null> => {
  try {
    const resp = await getCall(`${API_VERSION}/user/source-session`, sourceSessionHeaders());
    return resp?.data?.source_session ?? null;
  } catch {
    return null;
  }
};

export const saveSourceSession = async (
  region: string,
  appToken: string
): Promise<void> => {
  try {
    await putCall(
      `${API_VERSION}/user/source-session`,
      { region, appToken },
      sourceSessionHeaders()
    );
  } catch {
    /* ignore — utility callers are best-effort */
  }
};

export const removeSourceSession = async (): Promise<void> => {
  try {
    await deleteCall(`${API_VERSION}/user/source-session`, sourceSessionHeaders());
  } catch {
    /* ignore */
  }
};

export const getAllLocales = async (orgId: string) => {
  const options = {
    headers: {
      app_token: getDataFromLocalStorage('app_token')
    }
  };

  try {
    return await getCall(`${API_VERSION}/org/${orgId}/locales`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

