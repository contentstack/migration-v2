import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall } from './service';

/**
 * Options for the API request.
 * @property {Object} headers - The headers for the request.
 * @property {string} headers.app_token - The app token retrieved from local storage.
 */
const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

/**
 * Retrieves all stacks in an organization based on the provided organization ID and search text.
 * @param orgId - The ID of the organization.
 * @param searchText - The search text used to filter the stacks.
 * @returns A promise that resolves to the result of the API call.
 */
export const getAllStacksInOrg = async (orgId: string,searchText: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/stacks/${searchText}?`, options);
  } catch (error) {
    return error;
  }
};

/**
 * Creates stacks in an organization.
 * 
 * @param orgId - The ID of the organization.
 * @param data - The data for creating the stacks.
 * @returns A promise that resolves to the result of the API call.
 */
export const createStacksInOrg = async (orgId: string, data: any) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/stacks`, data, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Retrieves the status of a stack.
 * @param orgId - The ID of the organization.
 * @param data - The stack API key.
 * @returns A Promise that resolves to the stack status.
 */
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
