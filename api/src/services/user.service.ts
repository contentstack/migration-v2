import { Request } from "express";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import { AppTokenPayload, LoginServiceType } from "../models/types.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import AuthenticationModel from "../models/authentication.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import logger from "../utils/logger.js";
import { getAppOrganization } from "../utils/auth.utils.js";
import { mapOrganizationsForMigration } from "../utils/contentstack-user-orgs.utils.js";
import { requestWithSsoTokenRefresh } from "../utils/sso-request.utils.js";

/**
 * Retrieves the user profile based on the provided request.
 * @param req - The request object containing the token payload.
 * @returns A promise that resolves to the user profile.
 * @throws {BadRequestError} If the user is not found.
 * @throws {ExceptionFunction} If an error occurs while retrieving the user profile.
 */
const getUserProfile = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getUserProfile";
  const appTokenPayload: AppTokenPayload = req?.body?.token_payload;

  try {
    await AuthenticationModel.read();
    const userIndex = AuthenticationModel.chain
      .get("users")
      .findIndex({
        user_id: appTokenPayload?.user_id,
        region: appTokenPayload?.region,
        is_sso: appTokenPayload?.is_sso,
      })
      .value();

    if (userIndex < 0) throw new BadRequestError(HTTP_TEXTS.NO_CS_USER);
    const userRecord = AuthenticationModel.data?.users?.[userIndex];
    if (appTokenPayload?.is_sso === true) {
      const { uid: org_uid, name: org_name } = getAppOrganization();
      if (!userRecord?.access_token) {
        throw new BadRequestError("SSO authentication not completed");
      }

      const [err, res] = await requestWithSsoTokenRefresh(appTokenPayload, {
        method: "GET",
        url: `${config.CS_API[
          appTokenPayload?.region as keyof typeof config.CS_API
        ]!}/user?include_orgs_roles=true`,
        headers: {
          authorization: `Bearer ${userRecord?.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (err) {
        logger.error(
          getLogMessage(
            srcFun,
            HTTP_TEXTS?.CS_ERROR,
            appTokenPayload,
            err?.response?.data
          )
        );
        return { data: err?.response?.data, status: err?.response?.status };
      }

      if (
        !res?.data?.user?.organizations?.some(
          (org: any) => org.uid === org_uid
        )
      ) {
        throw new BadRequestError("Organization access revoked");
      }

      return {
        data: {
          user: {
            email: res?.data?.user?.email,
            first_name: res?.data?.user?.first_name,
            last_name: res?.data?.user?.last_name,
            region: appTokenPayload?.region,
            orgs: [
              {
                org_id: org_uid,
                org_name: org_name,
              },
            ],
          },
        },
        status: res?.status,
      };
    }

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          appTokenPayload?.region as keyof typeof config.CS_API
        ]!}/user?include_orgs_roles=true`,
        headers: {
          authtoken: userRecord?.authtoken,
          "Content-Type": "application/json",
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS?.CS_ERROR,
          appTokenPayload,
          err?.response?.data
        )
      );

      return {
        data: err?.response?.data,
        status: err?.response?.status,
      };
    }

    const orgs = mapOrganizationsForMigration(res?.data?.user?.organizations);

    return {
      data: {
        user: {
          email: res?.data?.user?.email,
          first_name: res?.data?.user?.first_name,
          last_name: res?.data?.user?.last_name,
          region: appTokenPayload?.region,
          orgs,
        },
      },
      status: res?.status,
    };
  } catch (error: any) {
    logger.error(getLogMessage(srcFun, "Error while getting user profile", appTokenPayload, error));
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS?.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

/**
 * Locate the authentication record for the currently-authenticated user.
 * Returns the index in AuthenticationModel.data.users or -1.
 */
const findUserIndex = (appTokenPayload: AppTokenPayload): number => {
  return AuthenticationModel.chain
    .get("users")
    .findIndex({
      user_id: appTokenPayload?.user_id,
      region: appTokenPayload?.region,
      is_sso: appTokenPayload?.is_sso,
    })
    .value();
};

/**
 * Returns the persisted regional source-login session for the current user,
 * or null when none is stored. Used in place of the prior sessionStorage
 * lookup so the source app token never lives in the browser.
 */
const getSourceSession = async (req: Request): Promise<LoginServiceType> => {
  const appTokenPayload: AppTokenPayload = req?.body?.token_payload;
  await AuthenticationModel.read();
  const idx = findUserIndex(appTokenPayload);
  if (idx < 0) {
    return { data: { source_session: null }, status: HTTP_CODES.OK };
  }
  const rec = AuthenticationModel.data?.users?.[idx]?.source_session ?? null;
  return { data: { source_session: rec }, status: HTTP_CODES.OK };
};

/**
 * Upserts the regional source-login session on the current user's record.
 * Body: { region: string, appToken: string }.
 */
const setSourceSession = async (req: Request): Promise<LoginServiceType> => {
  const appTokenPayload: AppTokenPayload = req?.body?.token_payload;
  const region = typeof req?.body?.region === "string" ? req.body.region.trim() : "";
  const appToken = typeof req?.body?.appToken === "string" ? req.body.appToken : "";
  if (!region || !appToken) {
    throw new BadRequestError("region and appToken are required");
  }
  await AuthenticationModel.read();
  const idx = findUserIndex(appTokenPayload);
  if (idx < 0) throw new BadRequestError(HTTP_TEXTS.NO_CS_USER);
  AuthenticationModel.data.users[idx].source_session = { region, appToken };
  AuthenticationModel.data.users[idx].updated_at = new Date().toISOString();
  await AuthenticationModel.write();
  return { data: { source_session: { region, appToken } }, status: HTTP_CODES.OK };
};

/**
 * Clears any persisted regional source-login session for the current user.
 */
const clearSourceSession = async (req: Request): Promise<LoginServiceType> => {
  const appTokenPayload: AppTokenPayload = req?.body?.token_payload;
  await AuthenticationModel.read();
  const idx = findUserIndex(appTokenPayload);
  if (idx >= 0 && AuthenticationModel.data?.users?.[idx]?.source_session) {
    delete AuthenticationModel.data.users[idx].source_session;
    AuthenticationModel.data.users[idx].updated_at = new Date().toISOString();
    await AuthenticationModel.write();
  }
  return { data: { source_session: null }, status: HTTP_CODES.OK };
};

export const userService = {
  getUserProfile,
  getSourceSession,
  setSourceSession,
  clearSourceSession,
};