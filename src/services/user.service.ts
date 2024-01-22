import { Request } from "express";
import { config } from "../config";
import https from "../utils/https.utils";
import { AppTokenPayload, UserProfile } from "../models/types";
import { constants } from "../constants";
import { BadRequestError } from "../utils/custom-errors.utils";
import AuthenticationModel from "../models/authentication";

const getUserProfile = async (req: Request): Promise<UserProfile> => {
  const appTokenPayload: AppTokenPayload = req?.body?.token_payload;

  const user = await AuthenticationModel.findOne({
    user_id: appTokenPayload?.user_id,
    region: appTokenPayload?.region,
  }).lean();

  if (!user?.authtoken)
    throw new BadRequestError(constants.HTTP_TEXTS.NO_CS_USER);

  const res = await https({
    method: "GET",
    url: `${config.CS_API[
      appTokenPayload?.region as keyof typeof config.CS_API
    ]!}/user?include_orgs_roles=true`,
    headers: {
      "Content-Type": "application/json",
      authtoken: user?.authtoken,
    },
  });

  if (!res?.data?.user)
    throw new BadRequestError(constants.HTTP_TEXTS.NO_CS_USER);

  const orgs = (res?.data?.user?.organizations || [])
    ?.filter((org: any) => org?.org_roles?.some((item: any) => item.admin))
    ?.map(({ uid, name }: any) => ({ org_id: uid, org_name: name }));

  return {
    user: {
      email: res?.data?.user?.email,
      first_name: res?.data?.user?.first_name,
      last_name: res?.data?.user?.last_name,
      orgs: orgs,
    },
  };
};

export const userService = {
  getUserProfile,
};
