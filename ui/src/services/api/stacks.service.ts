import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall } from './service';
import { Stack } from '../../components/Common/AddStack/addStack.interface';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

export const getAllStacksInOrg = async (orgId: string, searchText: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/stacks/${searchText}?`, options);
  } catch (error) {
    return error;
  }
};

export const createStacksInOrg = async (orgId: string, data: Stack) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/stacks`, data, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const getStackStatus = async (orgId: string, data: string) => {
  try {
    const stack_api = {
      stack_api_key: data
    };
    return await postCall(`${API_VERSION}/org/${orgId}/stack_status`, stack_api, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const getStackLocales = async (orgId: string) => {
  try {
    const updatedOptions = {
      headers: {
        app_token: getDataFromLocalStorage('app_token')
        //stack_api_key: api_key
      }
    };

    const res = await getCall(`${API_VERSION}/org/${orgId}/locales`, updatedOptions);
    return res;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};
