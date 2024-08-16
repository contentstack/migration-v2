import axios from 'axios';
import { UPLOAD_FILE_RELATIVE_URL } from '../../utilities/constants';
import { User } from '../../pages/Login/login.interface';
import { getDataFromLocalStorage } from '../../utilities/functions';

//Axios Calls for Upload server
export const getCall = async (url: string, options?: any) => {
  try {
    const response = await axios.get(url, { ...options });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error in userSession');
    }
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
    if (error instanceof Error) {
      throw new Error(`${error.message}`);
    } else {
      throw new Error('Unknown error');
    }
  }
};

export const getConfig = async() => {
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
