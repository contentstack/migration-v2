import { Request } from "express";
import { config } from "../config";
import { safePromise } from "../utils/index";
import https from "../utils/https.utils";
import { LoginServiceType } from "../models/types";
import getAuthtoken from "../utils/auth.utils";

const getAllStacks = async (req: Request): Promise<LoginServiceType> => {
  const orgId = req?.params?.orgId;
  const { token_payload } = req.body;

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

  if (err)
    return {
      data: err.response.data,
      status: err.response.status,
    };

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
};

export const orgService = {
  getAllStacks,
};
