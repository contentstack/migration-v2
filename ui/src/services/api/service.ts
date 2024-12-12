import axios from 'axios';
import { BASE_API_URL } from '../../utilities/constants';

// ALL Axios Call
export const getCall = async (url: string, options?: any) => {
  try {
    return await axios.get(`${BASE_API_URL}${url}`, { ...options });
  } catch (err: any) {
    return err?.response;
  }
};

export const postCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.post(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};

export const putCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.put(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};

export const deleteCall = async (url: string, options?: any) => {
  try {
    return await axios.delete(`${BASE_API_URL}${url}`, options);
  } catch (err: any) {
    return err?.response;
  }
};

export const patchCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.patch(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};
