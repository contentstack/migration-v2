import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall } from './service';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

export const getAllStacksInOrg = async (orgId: string,searchText: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/stacks/${searchText}?`, options);
  } catch (error) {
    return error;
  }
};

export const createStacksInOrg = async (orgId: string, data: any) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/stacks`, data, options);
  } catch (error: any) {
    return error;
  }
};

export const getStackStatus = async (orgId: string, data: string) => {
  try {
    const stack_api = {
      stack_api_key: data
    };
    return await postCall(`${API_VERSION}/org/${orgId}/stack_status`, stack_api, options);
  } catch (error: any) {
    return error;
  }
};
