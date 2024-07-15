import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall } from './service';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

/**
 * Retrieves migration data for a specific organization and project.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @returns A Promise that resolves to the migration data.
 */
export const getMigrationData = (orgId: string, projectId: string) => {
  try {
    return getCall(`${API_VERSION}/org/${orgId}/project/${projectId}/`, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the legacy CMS data for a specific organization and project.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to be updated.
 * @returns The result of the update operation.
 */
export const updateLegacyCMSData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/legacy-cms`, data, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the affix data for a specific organization and project.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to be updated.
 * @returns A promise that resolves to the updated data or an error object.
 */
export const updateAffixData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/affix`, data, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the file format data for a specific organization and project.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to be updated.
 * @returns The result of the update operation.
 */
export const updateFileFormatData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/file-format`, data, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the destination stack for a given organization and project.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to be sent in the request body.
 * @returns A Promise that resolves to the result of the API call or an error object.
 */
export const updateDestinationStack = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/destination-stack`,
      data,
      options
    );
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the current step data for a specific organization and project.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data to be updated. Defaults to an empty object.
 * @returns A promise that resolves to the updated data or an error object.
 */
export const updateCurrentStepData = (orgId: string, projectId: string, data: any = {}) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/current-step`, data, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Affixes confirmation to a project in an organization.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - Additional data to be sent with the request.
 * @returns A promise that resolves to the result of the API call or an error object.
 */
export const affixConfirmation = (orgId: string, projectId: string, data: any = {}) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/affix_confirmation`,
      data,
      options
    );
  } catch (error) {
    return error;
  }
};

/**
 * Sends a file format confirmation request to the server.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - Additional data to be sent with the request.
 * @returns A promise that resolves to the response from the server, or an error object if an error occurs.
 */
export const fileformatConfirmation = (orgId: string, projectId: string, data: any = {}) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/fileformat_confirmation`,
      data,
      options
    );
  } catch (error) {
    return error;
  }
};

/**
 * Retrieves content types from the server.
 *
 * @param projectId - The ID of the project.
 * @param skip - The number of items to skip.
 * @param limit - The maximum number of items to retrieve.
 * @param searchText - The text to search for.
 * @returns A Promise that resolves to the retrieved content types or an error.
 */
export const getContentTypes = (
  projectId: string,
  skip: number,
  limit: number,
  searchText: string
) => {
  try {
    return getCall(
      `${API_VERSION}/mapper/contentTypes/${projectId}/${skip}/${limit}/${searchText}?`,
      options
    );
  } catch (error: any) {
    return error;
  }
};

/**
 * Retrieves the field mapping for a given content type.
 *
 * @param contentTypeId - The ID of the content type.
 * @param skip - The number of records to skip.
 * @param limit - The maximum number of records to retrieve.
 * @param searchText - The text to search for in the field mapping.
 * @returns A Promise that resolves to the field mapping data.
 */
export const getFieldMapping = async (
  contentTypeId: string,
  skip: number,
  limit: number,
  searchText: string
) => {
  try {
    return await getCall(
      `${API_VERSION}/mapper/fieldMapping/${contentTypeId}/${skip}/${limit}/${searchText}?`,
      options
    );
  } catch (error: any) {
    return error;
  }
};

/**
 * Retrieves the existing content types for a given project.
 * @param projectId - The ID of the project.
 * @returns A Promise that resolves to the existing content types, or an error if the request fails.
 */
export const getExistingContentTypes = async (projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}`, options);
  } catch (error: any) {
    return error;
  }
};

/**
 * Updates the content type with the specified ID.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param contentTypeId - The ID of the content type.
 * @param data - The data to update the content type with.
 * @returns A Promise that resolves to the updated content type, or an error if the update fails.
 */
export const updateContentType = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: any
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/contentTypes/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options
    );
  } catch (error: any) {
    return error;
  }
};

/**
 * Resets the fields of a content type to their initial mapping.
 * 
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param contentTypeId - The ID of the content type.
 * @param data - The data to be sent in the request body.
 * @returns A promise that resolves to the response from the server, or an error object if the request fails.
 */
export const resetToInitialMapping = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: any
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/resetFields/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options
    );
  } catch (error: any) {
    return error;
  }
};

/**
 * Creates a test stack for migration.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @param data - The data for the test stack.
 * @returns A promise that resolves to the result of the API call.
 */
export const createTestStack = async (orgId: string, projectId: string, data: any) => {
  try {
    return await postCall(
      `${API_VERSION}/migration/test-stack/${orgId}/${projectId}`,
      data,
      options
    );
  } catch (error) {
    return error;
  }
};

/**
 * Fetches an existing content type from the server.
 * 
 * @param projectId - The ID of the project.
 * @param contentTypeUid - The UID of the content type.
 * @returns A promise that resolves to the fetched content type, or an error if the request fails.
 */
export const fetchExistingContentType = async (projectId: string, contentTypeUid: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}/${contentTypeUid}`, options);
  } catch (error: any) {
    return error;
  }
}

/**
 * Retrieves the content mapper for a specific organization and project.
 * @param orgId - The ID of the organization.
 * @param projectId - The ID of the project.
 * @returns A Promise that resolves to the content mapper.
 */
export const removeContentMapper = async(orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${orgId}/${projectId}/content-mapper`, options);   
  } catch (error) {
    return error;
    
  }
}
