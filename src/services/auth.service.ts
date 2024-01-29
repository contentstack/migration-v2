import { Request } from "express";
import { config } from "../config";
import { safePromise } from "../utils/index";
import https from "../utils/https.utils";
import { LoginServiceType, AppTokenPayload } from "../models/types";
import { constants } from "../constants";
import { generateToken } from "../utils/jwt.utils";
import {
  BadRequestError,
  InternalServerError,
} from "../utils/custom-errors.utils";
import AuthenticationModel from "../models/authentication";

const login = async (req: Request): Promise<LoginServiceType> => {
  const userData = req?.body;

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
    throw new BadRequestError(constants.HTTP_TEXTS.NO_CS_USER, "login");

  const appTokenPayload: AppTokenPayload = {
    region: userData?.region,
    user_id: res?.data?.user.uid,
  };

  // Saving auth info in the DB
  await AuthenticationModel.findOneAndUpdate(
    appTokenPayload,
    {
      authtoken: res?.data.user?.authtoken,
    },
    {
      upsert: true,
    }
  );

  // JWT token generation
  const app_token = generateToken(appTokenPayload);

  return {
    data: {
      message: constants.HTTP_TEXTS.SUCCESS_LOGIN,
      app_token,
    },
    status: constants.HTTP_CODES.OK,
  };
};

const requestSms = async (req: Request): Promise<LoginServiceType> => {
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
    throw new InternalServerError(
      constants.HTTP_TEXTS.INTERNAL_ERROR,
      "requestSms"
    );
  }
};

export const authService = {
  login,
  requestSms,
};
