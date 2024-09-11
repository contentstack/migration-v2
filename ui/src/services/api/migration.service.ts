import { ObjectType } from '../../utilities/constants.interface';
import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { getCall, postCall, putCall, patchCall } from './service';

const options = {
  headers: {
    app_token: getDataFromLocalStorage('app_token')
  }
};

export const getMigrationData = (orgId: string, projectId: string) => {
  try {
    return getCall(`${API_VERSION}/org/${orgId}/project/${projectId}/`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error in getting migrationData: ${error.message}`);
    } else {
      throw new Error('Unknown error in getting migrationData');
    }
  }
};

export const updateLegacyCMSData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/legacy-cms`, data, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateAffixData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/affix`, data, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateFileFormatData = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/file-format`, data, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateDestinationStack = (orgId: string, projectId: string, data: ObjectType) => {
  try {
    return putCall(
      `${API_VERSION}/org/${orgId}/project/${projectId}/destination-stack`,
      data,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateCurrentStepData = (orgId: string, projectId: string, data: ObjectType = {}) => {
  try {
    return putCall(`${API_VERSION}/org/${orgId}/project/${projectId}/current-step`, data, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const affixConfirmation = (orgId: string, projectId: string, data: ObjectType = {}) => {
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

export const fileformatConfirmation = (orgId: string, projectId: string, data: ObjectType = {}) => {
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
    const encodedSearchText = encodeURIComponent(searchText) ; 
    return getCall(
      `${API_VERSION}/mapper/contentTypes/${projectId}/${skip}/${limit}/${encodedSearchText}?`,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getFieldMapping = async (
  contentTypeId: string,
  skip: number,
  limit: number,
  searchText: string,
  projectId:string
) => {
  try {
    const encodedSearchText = encodeURIComponent(searchText) ;
    return await getCall(
      `${API_VERSION}/mapper/fieldMapping/${projectId}/${contentTypeId}/${skip}/${limit}/${encodedSearchText}?`,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getExistingContentTypes = async (projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${projectId}`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateContentType = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/contentTypes/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const resetToInitialMapping = async (
  orgId: string,
  projectId: string,
  contentTypeId: string,
  data: ObjectType
) => {
  try {
    return await putCall(
      `${API_VERSION}/mapper/resetFields/${orgId}/${projectId}/${contentTypeId}`,
      data,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const createTestStack = async (orgId: string, projectId: string, data: ObjectType) => {
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
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
}

export const removeContentMapper = async(orgId: string, projectId: string) => {
  try {
    return await getCall(`${API_VERSION}/mapper/${orgId}/${projectId}/content-mapper`, options);   
  } catch (error) {
    return error;
    
  }
}

export const updateContentMapper = async (
  orgId: string,
  projectId: string,
  data: ObjectType
) => {
  const mapperKeys = {content_mapper: data}

  try {
    return await patchCall(
      `${API_VERSION}/mapper/${orgId}/${projectId}/mapper_keys`,
      mapperKeys,
      options
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const updateStackDetails = async(orgId: string, projectId: string, data: ObjectType)=>{
  try {
    const Data  = { stack_details: data };
    return await patchCall(`${API_VERSION}/org/${orgId}/project/${projectId}/stack-details`, Data,options);
  } catch (error) {
    return error;
    
  }
}