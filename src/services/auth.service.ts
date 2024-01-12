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

const login = async (req: Request): Promise<LoginServiceType> => {
  //TODO: 1. request validation, 2. saving the authtoken in DB
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
      return {
        data: constants.HTTP_TEXTS.NO_CS_USER,
        status: constants.HTTP_CODES.BAD_REQUEST,
      };

    const migration_payload: MigrationPayload = {
      region: userData?.region,
      user_id: res?.data?.user.uid,
    };
    // JWT token generation
    const app_token = generateToken(migration_payload);

    const response = {
      data: {
        message: constants.HTTP_TEXTS.SUCCESS_LOGIN,
        app_token,
      },
      status: constants.HTTP_CODES.OK,
    };

    // Write the data to a JSON file (e.g., tokens.json)
    //TODO: remove this temp localStorage file, and use DB instead
    await fs.writeFile(
      "tokens.json",
      JSON.stringify(
        {
          [app_token]: res?.data.user?.authtoken,
        },
        null,
        2
      )
    );

    return response;
  } catch (error) {
    console.error(error);
    return {
      data: constants.HTTP_TEXTS.LOGIN_ERROR,
      status: constants.HTTP_CODES.SOMETHING_WRONG,
    };
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
    console.error(error);
    return {
      data: constants.HTTP_TEXTS.TOKEN_ERROR,
      status: constants.HTTP_CODES.SOMETHING_WRONG,
    };
  }
};

const getUserProfile = async (
  req: Request
): Promise<UserProfile | LoginServiceType> => {
  try {
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

    if (apiResponse?.data?.user) {
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
    }
    return {
      data: "Invalid User",
      status: 401,
    };
  } catch (error) {
    // Handle errors (e.g., log, return an error response)
    console.error(error);
    return {
      data: "Error while getting user profile",
      status: 500,
    };
  }
};

export const userService = {
  login,
  requestSms,
  getUserProfile,
};
