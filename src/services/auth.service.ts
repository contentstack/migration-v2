import { Request } from "express";
import { config } from "../config";
import { generateToken } from "../utils/jwt.utils";
import https from "../utils/https.utils";
import * as fs from "fs/promises";
import { MigrationPayload, ResponseType, UserProfile } from "../models/types";

const login = async (req: Request): Promise<ResponseType | null> => {
  const userData = req.body;

  try {
    const apiResponse = await https({
      method: "POST",
      url: config.CS_API.US,
      headers: {
        "Content-Type": "application/json",
      },
      data: userData,
    });

    if (apiResponse) {
      const migration_payload: MigrationPayload = {
        region: userData.region,
        user_id: apiResponse.data.user.uid,
      };
      const migration_token = generateToken(migration_payload);
      const response = {
        message: apiResponse.data.notice,
        status: 200,
        migration_token,
      };

      // Create an object with migration_token as the key
      const dataToWrite = {
        [migration_token]: apiResponse.data.user.authtoken,
      };

      // Write the data to a JSON file (e.g., tokens.json)
      await fs.writeFile("tokens.json", JSON.stringify(dataToWrite, null, 2));

      return response;
    }

    // Explicit return statement in case apiResponse is falsy
    return null;
  } catch (error) {
    // Handle errors (e.g., log, return an error response)
    console.error(error);
    return {
      message: "Error during login",
      status: 500,
      migration_token: null,
    };
  }
};

const getUserProfile = async (
  req: Request
): Promise<UserProfile | ResponseType> => {
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
      message: "Invalid User",
      status: 401,
      migration_token: null,
    };
  } catch (error) {
    // Handle errors (e.g., log, return an error response)
    console.error(error);
    return {
      message: "Error while getting user profile",
      status: 500,
      migration_token: null,
    };
  }
};

export const userService = {
  login,
  getUserProfile,
};
