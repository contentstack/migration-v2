import axios from "axios";
import {
  AXIOS_TIMEOUT,
  METHODS_TO_INCLUDE_DATA_IN_AXIOS,
} from "../constants/index.js";

/**
 * Represents the HTTP request configuration.
 */
type httpType = {
  url: string;
  method: string;
  headers?: any;
  data?: any;
  timeout?: number;
};
/**
 * Sends an HTTP request using Axios.
 *
 * @param obj - The HTTP request object.
 * @returns An object containing the response headers, status, and data.
 */
export default async (obj: httpType) => {
  const { url, method, headers, data, timeout } = obj;
  const res = await axios(url, {
    method,
    headers: headers,
    ...(headers && { headers }),
    timeout: timeout ?? AXIOS_TIMEOUT,
    ...(METHODS_TO_INCLUDE_DATA_IN_AXIOS.includes(method) && {
      data,
    }),
  });

  return {
    headers: res?.headers,
    status: res?.status,
    data: res?.data,
  };
};
