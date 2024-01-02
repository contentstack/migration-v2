import axios from "axios";
import { constants } from "../constants";

type httpType = {
  url: string;
  method: string;
  headers?: any;
  data?: any;
  timeout?: number;
};
export default async (obj: httpType) => {
  const { url, method, headers, data, timeout } = obj;
  const res = await axios(url, {
    method,
    headers: headers,
    ...(headers && { headers }),
    timeout: timeout ?? constants.AXIOS_TIMEOUT,
    ...(constants.METHODS_TO_INCLUDE_DATA_IN_AXIOS.includes(method) && {
      data,
    }),
  });

  return {
    headers: res?.headers,
    status: res?.status,
    data: res?.data,
  };
};
