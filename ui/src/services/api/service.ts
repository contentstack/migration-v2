import axios from 'axios';
import { BASE_API_URL } from '../../utilities/constants';

// ALL Axios Call
/**
 * Makes a GET request to the specified URL.
 * @param url - The URL to make the GET request to.
 * @param options - Optional configuration for the request.
 * @returns A Promise that resolves to the response data, or rejects with the error response.
 */
export const getCall = async (url: string, options?: any) => {
  try {
    return await axios.get(`${BASE_API_URL}${url}`, { ...options });
  } catch (err: any) {
    return err?.response;
  }
};

/**
 * Makes a POST request to the specified URL with the provided data and options.
 * @param url - The URL to make the POST request to.
 * @param data - The data to send in the request body.
 * @param options - Optional additional options for the request.
 * @returns A Promise that resolves to the response data, or rejects with the error response.
 */
export const postCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.post(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};

/**
 * Makes a PUT request to the specified URL with the provided data and options.
 * @param url - The URL to send the PUT request to.
 * @param data - The data to send in the request body.
 * @param options - Additional options for the request.
 * @returns A Promise that resolves to the response data, or rejects with the error response.
 */
export const putCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.put(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};

/**
 * Sends a DELETE request to the specified URL with optional request options.
 * @param url - The URL to send the DELETE request to.
 * @param options - Optional request options.
 * @returns A Promise that resolves to the response data if the request is successful, or the error response if the request fails.
 */
export const deleteCall = async (url: string, options?: any) => {
  try {
    return await axios.delete(`${BASE_API_URL}${url}`, options);
  } catch (err: any) {
    return err?.response;
  }
};

/**
 * Makes a PATCH request to the specified URL with the provided data and options.
 * @param url - The URL to send the PATCH request to.
 * @param data - The data to be sent in the request body.
 * @param options - Additional options for the request (optional).
 * @returns A Promise that resolves to the response data if the request is successful, or the error response if the request fails.
 */
export const patchCall = async (url: string, data: any, options?: any) => {
  try {
    return await axios.patch(`${BASE_API_URL}${url}`, data, options);
  } catch (err: any) {
    return err?.response;
  }
};
