import { Request } from "express";
import { config } from "../config/index.js";
import { safePromise, getLogMessage } from "../utils/index.js";
import https from "../utils/https.utils.js";
import { LoginServiceType } from "../models/types.js";
import getAuthtoken from "../utils/auth.utils.js";
import logger from "../utils/logger.js";
import { HTTP_TEXTS, HTTP_CODES } from "../constants/index.js";
import { ExceptionFunction } from "../utils/custom-errors.utils.js";
import { BadRequestError } from "../utils/custom-errors.utils.js";

const getAllStacks = async (req: Request): Promise<LoginServiceType> => {
  const srcFun = "getAllStacks";
  const orgId = req?.params?.orgId;
  const { token_payload } = req.body;
  const search: string = req?.params?.searchText?.toLowerCase();

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
    let stacks = res?.data?.stacks;
    if(search){    
      stacks = stacks.filter((stack:{name: string, description:string})=>{
        const stackName = stack?.name?.toLowerCase();
        const stackDescription = stack?.description?.toLowerCase();
        return stackName?.includes(search) || stackDescription?.includes(search);

      })
    }
    const locale = await getStackLocal(token_payload, stacks);
    return {
      data: {
        stacks: locale,
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

const getStackStatus = async (req: Request) => {
  const { orgId } = req.params;
  const { token_payload, stack_api_key } = req.body;
  const srcFunc = "getStackStatus";

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  try {
    const [stackErr, stackRes] = await safePromise(
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

    if (stackErr)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: stackErr.response.status,
      };

    if (
      !stackRes.data.stacks.find(
        (stack: any) => stack.api_key === stack_api_key
      )
    )
      throw new BadRequestError(HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND);

    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/content_types?skip=0&limit=1&include_count=true`,
        headers: {
          api_key: stack_api_key,
          authtoken,
        },
      })
    );

    if (err)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: err.response.status,
      };

    return {
      status: HTTP_CODES.OK,
      data: {
        contenttype_count: res.data?.count || 0,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while checking the status of a stack [OrgId : ${orgId}].`,
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
//get all locals of particular stack
const getStackLocal = async (token_payload: any, data: any) => {
  const srcFun = "getStackLocal";
  return new Promise(async (resolve, reject) => {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );
    let stacks = [];
    for (let stack of data) {
      const [err, res] = await safePromise(
        https({
          method: "GET",
          url: `${config.CS_API[
            token_payload?.region as keyof typeof config.CS_API
          ]!}/locales`,
          headers: {
           api_key: stack.api_key,
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
      let localesArr: any = [];
      res?.data?.locales.map((lang: any) => {
        return localesArr.push({
          code: lang.code,
          name: lang.name,
        });
      });

      let obj = {
        name: stack.name,
        api_key: stack.api_key,
        master_locale: stack.master_locale,
        created_at: stack.created_at,
        locales: localesArr,
      };
      stacks.push(obj);
    }
    resolve(stacks);
  });
};

export const orgService = {
  getAllStacks,
  getLocales,
  createStack,
  getStackStatus,
};
