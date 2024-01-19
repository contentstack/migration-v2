import { Request } from "express";
import { config } from "../config";
import https from "../utils/https.utils";
import * as fs from "fs/promises";
import { LoginServiceType, UserProfile } from "../models/types";
import { constants } from "../constants";
import {
  BadRequestError,
  InternalServerError,
} from "../utils/custom-errors.utils";

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

export const userService = {
  getUserProfile,
};
