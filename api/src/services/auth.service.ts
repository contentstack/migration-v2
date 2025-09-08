import { Request } from "express";
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType, AppTokenPayload, RefreshTokenResponse } from "../models/types.js";
import { HTTP_CODES, HTTP_TEXTS, CSAUTHHOST, regionalApiHosts } from "../constants/index.js";
import { generateToken } from "../utils/jwt.utils.js";
import {
  BadRequestError,
  InternalServerError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import AuthenticationModel from "../models/authentication.js";
import logger from "../utils/logger.js";
import path from "path";
import fs from "fs";
import axios from "axios";
// import { createHash, randomBytes } from 'crypto';

/**
 * Logs in a user with the provided request data. (No changes needed here)
 */
const login = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "Login";
  try {
    const userData = req?.body;

    const [err, res] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          userData?.region as keyof typeof config.CS_API
        ]!}/user-session?include_orgs_roles=true`,
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          user: {
            email: userData?.email,
            password: userData?.password,
            ...(userData?.tfa_token && { tfa_token: userData?.tfa_token }),
          },
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, err?.response?.data)
      );

      return {
        data: err?.response?.data,
        status: err?.response?.status,
      };
    }
    if (res?.data?.user?.organizations === undefined) {
      return {
        data: res?.data,
        status: res?.status,
      };
    } else {
      const orgs = (res?.data?.user?.organizations || [])
        ?.filter((org: any) => org?.org_roles?.some((item: any) => item?.admin))
        ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

      const ownerOrgs = (res?.data?.user?.organizations || [])?.filter((org:any)=> org?.is_owner)
      ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

      if (!orgs?.length && ! ownerOrgs?.length) {
        throw new BadRequestError(HTTP_TEXTS.ADMIN_LOGIN_ERROR);
      }
    }

    if (res?.status === HTTP_CODES.SUPPORT_DOC)
      return {
        data: res?.data,
        status: res?.status,
      };

    if (!res?.data?.user) throw new BadRequestError(HTTP_TEXTS.NO_CS_USER);

    const appTokenPayload: AppTokenPayload = {
      region: userData?.region,
      user_id: res?.data?.user.uid,
    };

    // Saving auth info in the DB
    await AuthenticationModel.read();
    const userIndex = AuthenticationModel.chain
      .get("users")
      .findIndex(appTokenPayload)
      .value();

    AuthenticationModel.update((data: any) => {
      if (userIndex < 0) {
        data.users.push({
          ...appTokenPayload,
          authtoken: res?.data.user?.authtoken,
          email : res?.data.user?.email,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      } else {
        data.users[userIndex].email = res?.data.user?.email;
        data.users[userIndex].authtoken = res?.data.user?.authtoken;
        data.users[userIndex].updated_at = new Date().toISOString();
      }
    });

    // JWT token generation
    const app_token = generateToken(appTokenPayload);

    return {
      data: {
        message: HTTP_TEXTS.SUCCESS_LOGIN,
        app_token,
      },
      status: HTTP_CODES.OK,
    };
  } catch (error: any) {
    logger.error(getLogMessage(srcFun, "Error while logging in", {}, error));
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Sends a request for SMS login token. (No changes needed here)
 */
const requestSms = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "requestSms";
  try {
    const userData = req?.body;
    const [err, res] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          userData?.region as keyof typeof config.CS_API
        ]!}/user/request_token_sms`,
        data: {
          user: {
            email: userData?.email,
            password: userData?.password,
          },
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(srcFun, HTTP_TEXTS.CS_ERROR, {}, err?.response?.data)
      );

      return {
        data: err?.response?.data,
        status: err?.response?.status,
      };
    }

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error: any) {
    logger.error(getLogMessage(srcFun, "Error while in requestSms", {}, error));

    throw new InternalServerError(HTTP_TEXTS.INTERNAL_ERROR);
  }
};

const getAppConfig = () => {
  const configPath = path.resolve(process.cwd(), '..', 'app.json');
  if (!fs.existsSync(configPath)) {
    throw new InternalServerError("SSO is not configured. Please run the setup script first.");
  }
  const rawData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(rawData);
};

/**
 * Receives the final code to generate token, fetches user details,
 * and saves/updates the user in the database.
 */
const saveOAuthToken = async (req: Request): Promise<void> => {
  const { code, region } = req.query;

  if (!code || !region) {
    logger.error("Callback failed: Missing 'code' or 'region' in query parameters.");
    throw new BadRequestError("Missing 'code' or 'region' in query parameters.");
  }

  try {
    // Exchange the code for access token
    const appConfig = getAppConfig();
    const { client_id, client_secret, redirect_uri } = appConfig.oauthData;
    const { code_verifier } = appConfig.pkce;

    const regionStr = Array.isArray(region) ? region[0] : region;
    const tokenUrl = CSAUTHHOST[regionStr as keyof typeof CSAUTHHOST];
    if (!tokenUrl || !client_id || !client_secret) {
      throw new InternalServerError(`Configuration missing for region: ${region}`);
    }

    const formData = new URLSearchParams();
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', client_id);
    formData.append('client_secret', client_secret);
    formData.append('redirect_uri', redirect_uri);
    formData.append('code', code as string);
    formData.append('code_verifier', code_verifier);
    const tokenResponse = await https({
        method: "POST",
        url: tokenUrl,
        data: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token, organization_uid } = tokenResponse.data;

    const apiHost = regionalApiHosts[region as keyof typeof regionalApiHosts];
    const [userErr, userRes] = await safePromise(
      https({
        method: "GET",
        url: `https://${apiHost}/v3/user`,
        headers: { 
          'authorization': `Bearer ${access_token}`,
        },
      })
    );
      
    if (userErr) {
      logger.error("Error fetching user details with new token", userErr?.response?.data);
      throw new InternalServerError(userErr);
    }

    const csUser = userRes.data.user;

    const appTokenPayload = {
      region: region as string,
      user_id: csUser.uid, 
    };
      
    await AuthenticationModel.read();
    const userIndex = AuthenticationModel.chain.get("users").findIndex({ user_id: csUser.uid }).value();

    AuthenticationModel.update((data: any) => {
      const userRecord = {
        ...appTokenPayload,
        email: csUser.email,
        access_token: access_token, 
        refresh_token: refresh_token,
        organization_uid: organization_uid,
        updated_at: new Date().toISOString(),
      };
      if (userIndex < 0) {
        data.users.push({ ...userRecord, created_at: new Date().toISOString() });
      } else {
        data.users[userIndex] = { ...data.users[userIndex], ...userRecord };
      }
    });

    logger.info(`Token and user data for ${csUser.email} (Region: ${region}) saved successfully.`);

  } catch (error) {
    logger.error("An error occurred during token exchange and save:", error);
    throw new InternalServerError("Failed to process OAuth callback.");
  }
};

/**
 * Generates a new access token using the refresh token.
 * If the refresh token is not found, it throws an error.
 * It updates the user record in the database with the new access token and refresh token.
 * It returns the new access token.
 */
export const refreshOAuthToken = async (userId: string): Promise<string> => {
  try {
    await AuthenticationModel.read();
    const userRecord = AuthenticationModel.chain.get("users").find({ user_id: userId }).value();

    if (!userRecord) {
      throw new Error(`User record not found for user_id: ${userId}`);
    }

    if (!userRecord.refresh_token) {
      throw new Error(`No refresh token available for user: ${userId}`);
    }

    const appConfigPath = path.join(process.cwd(), "..", 'app.json');
    if (!fs.existsSync(appConfigPath)) {
      throw new Error('app.json file not found - OAuth configuration required');
    }

    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    const { client_id, client_secret, redirect_uri } = appConfig.oauthData;

    if (!client_id || !client_secret) {
      throw new Error('OAuth client_id or client_secret not found in app.json');
    }

    logger.info(`Refreshing token for user: ${userRecord.email} in region: ${userRecord.region}`);

    const appUrl = CSAUTHHOST[userRecord.region] || CSAUTHHOST['NA'];
    const tokenEndpoint = `${appUrl}`;

    const formData = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: client_id,
      client_secret: client_secret,
      redirect_uri: redirect_uri,
      refresh_token: userRecord.refresh_token
    });

    const response = await axios.post<RefreshTokenResponse>(tokenEndpoint, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    const { access_token, refresh_token } = response.data;

    AuthenticationModel.update((data: any) => {
      const userIndex = data.users.findIndex((user: any) => user.user_id === userId);
      if (userIndex >= 0) {
        data.users[userIndex] = {
          ...data.users[userIndex],
          access_token: access_token,
          refresh_token: refresh_token || userRecord.refresh_token, 
          updated_at: new Date().toISOString()
        };
      }
    });

    logger.info(`Token refreshed successfully for user: ${userRecord.email}`);
    return access_token;

  } catch (error: any) {
    logger.error(`Token refresh failed for user ${userId}:`, error.response?.data || error.message);
    throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
  }
};

export const authService = {
  login,
  requestSms,
  saveOAuthToken,
  refreshOAuthToken,
};