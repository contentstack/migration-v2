import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall } from './service';

const options = () => ({
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
});

export const getAllProjects = async (orgId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project`, options());
  } catch (error: any) {
    return error;
  }
};

export const getProject = async (orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error: any) {
    return error;
  }
};

export const createProject = async (orgId: string, data: any) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/project/`, data, options());
  } catch (error: any) {
    return error;
  }
};

export const updateProject = async (orgId: string, projectId: string, data: any) => {
  try {
    return await putCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, data, options());
  } catch (error: any) {
    return error;
  }
};
