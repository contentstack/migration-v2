import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall } from './service';

/**
 * Retrieves user profile data from the server.
 * @returns {Promise<any>} A promise that resolves to the user profile data.
 */
export const getUser = async () => {
  const options = {
    headers: {
      app_token: getDataFromLocalStorage('app_token')
    }
  };

  try {
    return await getCall(`${API_VERSION}/user/profile`, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Retrieves all locales for a given organization.
 * @param orgId - The ID of the organization.
 * @returns A Promise that resolves to the locales data, or an error if the request fails.
 */
export const getAllLocales = async (orgId: string) => {
  const options = {
    headers: {
      app_token: getDataFromLocalStorage('app_token')
    }
  };

  try {
    return await getCall(`${API_VERSION}/org/${orgId}/locales`, options);
  } catch (error: any) {
    return error;
  }
};
