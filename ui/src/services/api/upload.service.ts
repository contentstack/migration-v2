import axios from 'axios';
import { UPLOAD_FILE_RELATIVE_URL } from '../../utilities/constants';
import { User } from '../../pages/Login/login.interface';
import { getDataFromLocalStorage } from '../../utilities/functions';
import { FileValidationParams } from './service.interface';

//Axios Calls for Upload server
export const getCall = async (url: string, options?: any) => {
  try {
    const response = await axios.get(url, { ...options });
    return response;
  } catch (err: any) {
    return err.response;
  }
};

export const postCall = async (url: string, data: User, options?: any) => {
  try {
    const response = await axios.post(url, data, options);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
  }
};

export const putCall = async (url: string, data: User, options?: any) => {
  try {
    const response = await axios.put(url, data, options);
    return response;
  } catch (err: any) {
    return err.response;
  }
};

//upload file to s3
export const uploadFilePath = () => {
  return `${UPLOAD_FILE_RELATIVE_URL}upload`;
};

/**
 * Copies a local file or directory into the container's shared volume via the upload-api.
 * The upload-api reads from the host filesystem mounted at /host.
 * Skip if: path is already a container path or SQL connection.
 * Returns the container-side path to pass to fileValidation.
 */
export const uploadLocalFileToContainer = async (
  localPath: string
): Promise<{ containerPath: string } | null> => {
  try {
    if (!localPath || localPath.toLowerCase() === 'sql' || localPath.startsWith('/app/extracted_files')) {
      return null;
    }

    const response = await axios.post(`${UPLOAD_FILE_RELATIVE_URL}upload-to-container`, { localPath });

    if (response?.data?.containerPath) {
      return { containerPath: response.data.containerPath };
    }
    return null;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`uploadLocalFileToContainer failed: ${error.message}`);
    }
    throw new Error('Unknown error in uploadLocalFileToContainer');
  }
};

export const fileValidation = async ({
  projectId,
  affix = 'cs',
  localPath = ''
}: FileValidationParams) => {
  try {
    const options = {
      headers: {
        app_token: getDataFromLocalStorage('app_token'),
        projectId: projectId,
        affix: affix,
        file_path: localPath
      }
    };
    return await getCall(`${UPLOAD_FILE_RELATIVE_URL}validator`, options);
  } catch (error) {
    return error;
  }
};

export const getConfig = async () => {
  try {
    return await getCall(`${UPLOAD_FILE_RELATIVE_URL}config`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getRestrictedKeywords = async () => {
  try {
    return await getCall(`https://api.contentstack.io/v3/restricted_uids`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getLocales = async (api_key: string) => {
  try {
    const options = {
      headers: {
        authtoken: getDataFromLocalStorage('app_token'),
        api_key: api_key
        //'affix': affix,
      }
    };

    return await getCall(`https://api.contentstack.io/v3/locales`, options);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};
