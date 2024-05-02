import axios from 'axios';
import { UPLOAD_FILE_RELATIVE_URL } from '../../utilities/constants';
import { User, SmsToken } from '../../pages/Login/login.interface';
import { API_VERSION } from '../../utilities/constants';

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
  } catch (err: any) {
    return err.response;
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

export const fileValidation = () => {
  try {
    return getCall(`${UPLOAD_FILE_RELATIVE_URL}validator`);
  } catch (error) {
    return error;
  }
};
