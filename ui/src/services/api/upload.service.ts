import axios from 'axios';
import { UPLOAD_FILE_RELATIVE_URL } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';
import { API_VERSION } from '../../utilities/constants';
import { getDataFromLocalStorage } from '../../utilities/functions';

//Axios Calls for Upload server
/**
 * Makes a GET request to the specified URL with optional request options.
 * @param url - The URL to make the GET request to.
 * @param options - Optional request options.
 * @returns A Promise that resolves to the response data if the request is successful, or the error response if the request fails.
 */
export const getCall = async (url: string, options?: any) => {
  try {
    const response = await axios.get(url, { ...options });
    return response;
  } catch (err: any) {
    return err.response;
  }
};

/**
 * Makes a POST request to the specified URL with the provided data.
 * @param url - The URL to make the POST request to.
 * @param data - The data to send in the request body.
 * @param options - Additional options for the request.
 * @returns A Promise that resolves to the response from the server.
 */
export const postCall = async (url: string, data: User, options?: any) => {
  try {
    const response = await axios.post(url, data, options);
    return response;
  } catch (err: any) {
    return err.response;
  }
};

/**
 * Makes a PUT request to the specified URL with the provided data and options.
 * @param url - The URL to send the PUT request to.
 * @param data - The data to be sent in the request body.
 * @param options - Optional additional options for the request.
 * @returns A Promise that resolves to the response from the server, or rejects with an error response.
 */
export const putCall = async (url: string, data: User, options?: any) => {
  try {
    const response = await axios.put(url, data, options);
    return response;
  } catch (err: any) {
    return err.response;
  }
};

//upload file to s3
/**
 * Returns the upload file path.
 * @returns The upload file path.
 */
export const uploadFilePath = () => {
  return `${UPLOAD_FILE_RELATIVE_URL}upload`;
};

/**
 * Validates a file for a specific project.
 * @param projectId - The ID of the project.
 * @returns A Promise that resolves to the result of the file validation.
 */
export const fileValidation = (projectId: string) => {
  try {
    const options = {
      headers: {
        'app_token': getDataFromLocalStorage('app_token'),
        'projectId': projectId 
      },
      
    };
    return getCall(`${UPLOAD_FILE_RELATIVE_URL}validator`, options);
  } catch (error) {
    return error;
  }
};

/**
 * Retrieves the configuration for uploading files.
 * @returns {Promise<any>} A promise that resolves to the configuration object.
 * @throws {Error} If an error occurs while retrieving the configuration.
 */
export const getConfig = () => {
  try {
    return getCall(`${UPLOAD_FILE_RELATIVE_URL}config`);
  } catch (error) {
    return error;
  }
};
