import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall } from './service';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

export const getAllStacksInOrg = async (orgId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/stacks`, options);
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
  console.log('.................', orgId, data);

  try {
    return await postCall(`${API_VERSION}/org/${orgId}/stack_status`, data, options);
  } catch (error: any) {
    return error;
  }
};
