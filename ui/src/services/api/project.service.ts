import { ObjectType } from '../../utilities/constants.interface';
import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall, deleteCall } from './service';

const options = () => ({
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
});

export const getAllProjects = async (orgId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const getProject = async (orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const createProject = async (orgId: string, data: ObjectType) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/project/`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const updateProject = async (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return await putCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, data, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const deleteProject = async (orgId: string, projectId: string) => {
  try {
    return await deleteCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in userSession: ${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};
