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
      })
      .value();

    if (userIndex < 0) throw new BadRequestError(HTTP_TEXTS.NO_CS_USER);

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          appTokenPayload?.region as keyof typeof config.CS_API
        ]!}/user?include_orgs_roles=true`,
        headers: {
          "Content-Type": "application/json",
          authtoken: AuthenticationModel.data.users[userIndex]?.authtoken,
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

    if (!res?.data?.user) throw new BadRequestError(HTTP_TEXTS.NO_CS_USER);

    const orgs = (res?.data?.user?.organizations || [])
      ?.filter((org: any) => org?.org_roles?.some((item: any) => item.admin))
      ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

    const ownerOrgs = (res?.data?.user?.organizations || [])?.filter((org:any)=> org?.is_owner)
    ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

    const allOrgs = [...orgs, ...ownerOrgs]
    return {
      data: {
        user: {
          email: res?.data?.user?.email,
          first_name: res?.data?.user?.first_name,
          last_name: res?.data?.user?.last_name,
          orgs: allOrgs,
        },
      },
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while getting user profile",
        appTokenPayload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const userService = {
  getUserProfile,
};
