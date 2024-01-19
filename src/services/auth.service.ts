import { Request } from "express";
import { config } from "../config";
import { safePromise } from "../utils/index";
import https from "../utils/https.utils";
import * as fs from "fs/promises";
import {
  LoginServiceType,
  MigrationPayload,
  UserProfile,
} from "../models/types";
import { constants } from "../constants";
import { generateToken } from "../utils/jwt.utils";
import {
  BadRequestError,
  InternalServerError,
} from "../utils/custom-errors.utils";
import AuthenticationModel from "../models/authentication";

const login = async (req: Request): Promise<LoginServiceType> => {
  //TODO: 1. request validation
  const userData = req?.body;

  try {
    const [err, res] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          userData?.region as keyof typeof config.CS_API
        ]!}/user-session`,
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

    if (err)
      return {
        data: err?.response?.data,
        status: err?.response?.status,
      };

    if (res?.status === constants.HTTP_CODES.SUPPORT_DOC)
      return {
        data: res?.data,
        status: res?.status,
      };

    if (!res?.data?.user)
      throw new BadRequestError(constants.HTTP_TEXTS.NO_CS_USER);

    const migration_payload: MigrationPayload = {
      region: userData?.region,
      user_id: res?.data?.user.uid,
    };

    // Saving auth info in the DB
    await AuthenticationModel.create({
      ...migration_payload,
      authtoken: res?.data.user?.authtoken,
    });

    // JWT token generation
    const app_token = generateToken(migration_payload);

    return {
      data: {
        message: constants.HTTP_TEXTS.SUCCESS_LOGIN,
        app_token,
      },
      status: constants.HTTP_CODES.OK,
    };
  } catch (err) {
    throw new InternalServerError();
  }
};

const requestSms = async (req: Request): Promise<LoginServiceType> => {
  //TODO: 1. request validation
  const userData = req?.body;

  try {
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

    if (err)
      return {
        data: err.response.data,
        status: err.response.status,
      };

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error) {
    throw new InternalServerError();
  }
};

const getUserProfile = async (
  req: Request
): Promise<UserProfile | LoginServiceType> => {
  try {
    //TODO: replace the current logic with the actual db-fetch logic
    const tokens = JSON.parse(await fs.readFile(`tokens.json`, "utf8"));
    const authtoken = tokens?.[req?.headers?.app_token as string];

    const apiResponse =
      authtoken &&
      (await https({
        method: "GET",
        url: `${config.CS_API.US}/user?include_orgs_roles=true`,
        headers: {
          "Content-Type": "application/json",
          authtoken: authtoken,
        },
      }));

    if (!apiResponse?.data?.user)
      throw new BadRequestError(constants.HTTP_TEXTS.NO_CS_USER);

    const orgs = apiResponse?.data?.user?.organizations
      ?.filter((org: any) => org?.org_roles?.some((item: any) => item.admin))
      ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

    const userProfile: UserProfile = {
      user: {
        email: apiResponse?.data?.user?.email,
        first_name: apiResponse?.data?.user?.first_name,
        last_name: apiResponse?.data?.user?.last_name,
        orgs: orgs,
      },
    };
    return userProfile;
  } catch (error) {
    throw new InternalServerError("Error while getting user profile");
  }
};

export const authService = {
  login,
  requestSms,
  getUserProfile,
};
