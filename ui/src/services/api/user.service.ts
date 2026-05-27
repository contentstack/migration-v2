import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall } from './service';

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

