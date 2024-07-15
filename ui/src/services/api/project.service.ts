import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall, deleteCall } from './service';

/**
 * Returns the options object for API requests.
 * The options object includes the headers with the app token.
 * @returns The options object.
 */
const options = () => ({
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
});

/**
 * Retrieves all projects for a given organization.
 * @param orgId - The ID of the organization.
 * @returns A promise that resolves to the list of projects, or an error if the request fails.
 */
export const getAllProjects = async (orgId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project`, options());
  } catch (error: any) {
    return error;
  }
};

/**
 * Retrieves a project by its organization ID and project ID.
 * @param orgId The ID of the organization.
 * @param projectId The ID of the project.
 * @returns A Promise that resolves to the project data, or an error if the request fails.
 */
export const getProject = async (orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error: any) {
    return error;
  }
};

/**
 * Creates a new project for the specified organization.
 * 
 * @param orgId - The ID of the organization.
 * @param data - The data for the new project.
 * @returns A Promise that resolves to the created project, or an error if the request fails.
 */
export const createProject = async (orgId: string, data: any) => {
  try {
    return await postCall(`${API_VERSION}/org/${orgId}/project/`, data, options());
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates a project.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to update the project with.
 * @returns A promise that resolves to the updated project, or an error if the update fails.
 */
export const updateProject = async (orgId: string, projectId: string, data: any) => {
  try {
    return await putCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, data, options());
  } catch (error: any) {
    return error;
  }
};

/**
 * Deletes a project.
 * @param {string} orgId - The ID of the organization.
 * @param {string} projectId - The ID of the project to delete.
 * @returns {Promise<any>} - A promise that resolves to the result of the delete operation, or an error object if an error occurs.
 */
export const deleteProject = async (orgId: string, projectId: string) => {
  try {
    return await deleteCall(`${API_VERSION}/org/${orgId}/project/${projectId}`, options());
  } catch (error: any) {
    return error;
  }
};
