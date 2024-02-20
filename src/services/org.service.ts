import { Request } from "express";
import { config } from "../config";
import { safePromise, getLogMessage } from "../utils/index";
import https from "../utils/https.utils";
import { LoginServiceType } from "../models/types";
import getAuthtoken from "../utils/auth.utils";
import logger from "../utils/logger";
import { HTTP_TEXTS, HTTP_CODES } from "../constants";
import { ExceptionFunction } from "../utils/custom-errors.utils";

const getAllStacks = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getAllStacks";
  const orgId = req?.params?.orgId;
  const { token_payload } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    return {
      data: {
        stacks:
          res.data.stacks?.map((stack: any) => ({
            name: stack.name,
            api_key: stack.api_key,
          })) || [],
      },
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while getting all stacks",
        token_payload,
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const createStack = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "createStack";
  const orgId = req?.params?.orgId;
  const { token_payload, name, description, master_locale } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "POST",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
        data: {
          stack: {
            name,
            description,
            master_locale,
          },
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while creating a stack",
        token_payload,
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const getLocales = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getLocales";
  const { token_payload } = req.body;

  try {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/locales?include_all=true`,
        headers: {
          authtoken,
        },
      })
    );

    if (err) {
      logger.error(
        getLogMessage(
          srcFun,
          HTTP_TEXTS.CS_ERROR,
          token_payload,
          err.response.data
        )
      );

      return {
        data: err.response.data,
        status: err.response.status,
      };
    }

    return {
      data: res.data,
      status: res.status,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(srcFun, "Error while getting locales", token_payload, error)
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const orgService = {
  getAllStacks,
  getLocales,
  createStack,
};
