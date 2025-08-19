
import axios, { AxiosResponse, AxiosError } from "axios";
import http from 'http';
// import { readFileSync } from "fs";
// import path from 'path';
// import { deleteFolderSync } from "../../helper";
import logger from "../../utils/logger";
// import { HTTP_CODES, HTTP_TEXTS, MIGRATION_DATA_CONFIG } from "../../constants";

import { contentTypes } from 'migration-aem'

interface RequestParams {
  payload: any;
  projectId: string | string[];
  app_token: string | string[];
  endpoint?: string;
}


const sendRequestWithRetry = async <T = any>(params: RequestParams): Promise<AxiosResponse<T>> => {
  const { payload, projectId, app_token, endpoint = 'mapper/createDummyData' } = params;
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.NODE_BACKEND_API}/v2/${endpoint}/${projectId}`,
        headers: {
          app_token,
          'Content-Type': 'application/json'
        },
        data: payload,
        timeout: 240000, // 4-minute timeout
        httpAgent: new http.Agent({
          keepAlive: true,
          maxSockets: 1
        })
      };

      return await axios.request<T>(config);
    } catch (error) {
      const axiosError = error as AxiosError;
      retries++;
      const delay = 2000 * retries; // Progressive backoff: 2s, 4s, 6s

      logger.warn(`API request failed (attempt ${retries}/${maxRetries}): ${axiosError.code || axiosError.message}`, {
        status: axiosError.response?.status || 'NETWORK_ERROR'
      });

      if (retries >= maxRetries) {
        throw axiosError;
      }

      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This line is technically unreachable, but TypeScript requires a return
  throw new Error("Maximum retries reached");
};


const createAemMapper = async () => {
  try {
    // Initialize the contentTypes function
    const ct = contentTypes();

    // Call convertAndCreate with the path to your AEM data structure
    const ctData = await ct.convertAndCreate('/Users/umesh.more/Documents/aem_data_structure');
    console.log("🚀 ~ createAemMapper ~ ctData:", ctData)
    logger.info('AEM content types converted and created successfully');
  } catch (error) {
    logger.error('Error creating AEM mapper:', error);
    throw error;
  }
}

export { createAemMapper }