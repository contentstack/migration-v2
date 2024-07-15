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
  } catch (error: any) {
    return error;
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
  } catch (error: any) {
    return error;
  }
};
