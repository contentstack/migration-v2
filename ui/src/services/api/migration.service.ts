import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall } from './service';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

export const getMigrationData = (orgId: string, projectId: string) => {
  try {
    return getCall(`${API_VERSION}/org/${orgId}/project/${projectId}/`, options);
  } catch (error: any) {
    return error;
  }
};

export const updateLegacyCMSData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/legacy-cms`, data, options);
  } catch (error: any) {
    return error;
  }
};

export const updateAffixData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/affix`, data, options);
  } catch (error: any) {
    return error;
  }
};

export const updateFileFormatData = (orgId: string, projectId: string, data: any) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/file-format`, data, options);
  } catch (error: any) {
    return error;
  }
};

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

export const updateCurrentStepData = (orgId: string, projectId: string, data: any = {}) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/current-step`, data, options);
  } catch (error: any) {
    return error;
  }
};

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

export const getExistingContentTypes = async (projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}`, options);
  } catch (error: any) {
    return error;
  }
};

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

export const fetchExistingContentType = async (projectId: string, contentTypeUid: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}/${contentTypeUid}`, options);
  } catch (error: any) {
    return error;
  }
}
