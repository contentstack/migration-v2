import { AppTokenPayload } from "../models/types.js";
import { refreshOAuthToken } from "../services/auth.service.js";
import { safePromise } from "./index.js";
import https from "./https.utils.js";
import logger from "./logger.js";

type HttpConfig = {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: any;
  timeout?: number;
};

const shouldRefreshAccessToken = (err: any): boolean => {
  const status = err?.response?.status;
  const errorCode = err?.response?.data?.error_code ?? err?.response?.data?.code;

  return status === 401 || errorCode === 105;
};

export const requestWithSsoTokenRefresh = async (
  tokenPayload: AppTokenPayload,
  requestConfig: HttpConfig
): Promise<[any, any]> => {
  const [err, res] = await safePromise(https(requestConfig));

  if (!err || !tokenPayload?.is_sso || !shouldRefreshAccessToken(err)) {
    return [err, res];
  }

  try {
    const newAccessToken = await refreshOAuthToken(tokenPayload?.user_id);
    const refreshedHeaders = {
      ...(requestConfig.headers || {}),
      authorization: `Bearer ${newAccessToken}`,
    };

    return await safePromise(
      https({
        ...requestConfig,
        headers: refreshedHeaders,
      })
    );
  } catch (refreshError: any) {
    logger.error(
      "Failed to refresh access token for SSO request",
      refreshError?.response?.data || refreshError?.message
    );
    return [err, res];
  }
};
