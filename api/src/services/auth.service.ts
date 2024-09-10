import { Request } from "express";
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType, AppTokenPayload } from "../models/types.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";
import { generateToken } from "../utils/jwt.utils.js";
import {
  BadRequestError,
  InternalServerError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import AuthenticationModel from "../models/authentication.js";
import logger from "../utils/logger.js";

/**
 * Logs in a user with the provided request data.
 *
 * @param req - The request object containing user data.
 * @returns A promise that resolves to a LoginServiceType object.
 * @throws ExceptionFunction if an error occurs during the login process.
 */
const login = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "Login";

  /*
  handles user authentication by making a request to an API, 
  performing various checks and validations, 
  updating a model, and generating a JWT token. 
  It also handles potential errors and logs appropriate messages.
  */
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
        ?.filter((org: any) => org?.org_roles?.some((item: any) => item.admin))
        ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));
      if (!orgs.length) {
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
 * Sends a request for SMS login token.
 * @param req - The request object.
 * @returns A promise that resolves to a LoginServiceType object.
 * @throws {InternalServerError} If an error occurs while sending the request.
 */
const requestSms = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "requestSms";

  /*
  handles the authentication process by making an HTTP POST request to an API endpoint, 
  handling any errors that occur, and returning the appropriate response or error data. 
  It also includes logging functionality to track the execution and potential errors.
  */
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

export const authService = {
  login,
  requestSms,
};
