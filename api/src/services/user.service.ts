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
    const { uid: org_uid, name: org_name } = getAppOrganization();
    const userRecord = AuthenticationModel.data.users[userIndex];
    if (appTokenPayload.is_sso === true) {
      if (!userRecord?.access_token) {
        throw new BadRequestError("SSO authentication not completed");
      }

      const [err, res] = await safePromise(
        https({
          method: "GET",
          url: `${config.CS_API[
            appTokenPayload?.region as keyof typeof config.CS_API
          ]!}/user?include_orgs_roles=true`,
          headers: {
            authorization: `Bearer ${userRecord?.access_token}`,
            "Content-Type": "application/json",
          },
        })
      );

      if (err) {
        logger.error(
          getLogMessage(
            srcFun,
            HTTP_TEXTS.CS_ERROR,
            appTokenPayload,
            err.response.data
          )
        );
        return { data: err.response.data, status: err.response.status };
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
          HTTP_TEXTS.CS_ERROR,
          appTokenPayload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    const adminOrgs = res?.data?.user?.organizations
        ?.filter((org: any) =>
          org?.org_roles?.some((r: any) => r?.admin)
        )
        ?.map(({ uid, name }: any) => ({
          org_id: uid,
          org_name: name,
        })) || [];

    const ownerOrgs = res?.data?.user?.organizations
        ?.filter((org: any) => org?.is_owner)
        ?.map(({ uid, name }: any) => ({
          org_id: uid,
          org_name: name,
        })) || [];

    return {
      data: {
        user: {
          email: res?.data?.user?.email,
          first_name: res?.data?.user?.first_name,
          last_name: res?.data?.user?.last_name,
          orgs: [...adminOrgs, ...ownerOrgs],
        },
      },
      status: res?.status,
    };
  } catch (error: any) {
    logger.error(getLogMessage(srcFun, "Error while getting user profile", appTokenPayload, error));
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const userService = {
  getUserProfile,
};