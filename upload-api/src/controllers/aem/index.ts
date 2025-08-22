
import axios, { AxiosResponse, AxiosError } from "axios";
import http from 'http';
import logger from "../../utils/logger";
import { HTTP_CODES, HTTP_TEXTS } from "../../constants";
import { contentTypes, locales } from 'migration-aem';

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


const createLocaleSource = async ({
  app_token,
  localeData,
  projectId,
}: {
  app_token: string | string[];
  localeData: any;
  projectId: string | string[];
}) => {
  try {
    const payload = {
      locale: Array?.from?.(localeData) ?? [],
    };

    const { status } = await sendRequestWithRetry({
      payload,
      projectId,
      app_token,
      endpoint: 'migration/localeMapper',
    });

    if (status === 200) {
      logger.info('Legacy CMS', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.LOCALE_SAVED,
      });
    } else {
      logger.warn('Legacy CMS error:', {
        status: HTTP_CODES?.UNAUTHORIZED,
        message: HTTP_TEXTS?.LOCALE_FAILED,
      });
    }
  } catch (error) {
    logger.error('Legacy CMS error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.LOCALE_FAILED,
      error,
    });
    throw error;
  }
};


const createAemMapper = async (filePath: string, projectId: string | string[], app_token: string | string[], affix?: string | string[]) => {
  console.log("🚀 ~ createAemMapper ~ filePath:", filePath)
  try {
    const ct = contentTypes();
    const localeData = await locales().processAndSave(filePath);
    await createLocaleSource({ app_token, projectId, localeData });
    const ctData = await ct.convertAndCreate(filePath);
    const fieldMapping: any = { contentTypes: ctData, extractPath: filePath };
    const { data } = await sendRequestWithRetry({
      payload: fieldMapping,
      projectId,
      app_token
    });
    if (data?.data?.content_mapper?.length) {
      logger.info('Validation success:', {
        status: HTTP_CODES?.OK,
        message: HTTP_TEXTS?.MAPPER_SAVED,
      });
    }
  } catch (error: any) {
    console.error("🚀 ~ createSitecoreMapper ~ err:", error?.response?.data ?? error);
    logger.warn('Validation error:', {
      status: HTTP_CODES?.UNAUTHORIZED,
      message: HTTP_TEXTS?.VALIDATION_ERROR,
    });
  }
}

export { createAemMapper }