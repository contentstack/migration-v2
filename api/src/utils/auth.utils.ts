import fs from "fs";
import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";
import { decryptAppConfig } from "./crypto.utils.js";
import { getAppJsonPath } from "./app-config-path.utils.js";

function loadAppConfig() {
  const configPath = getAppJsonPath();
  if (!fs.existsSync(configPath)) {
    throw new Error("app.json file not found");
  }
  return decryptAppConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
}

/**
 * Retrieves the authentication token for a given user in a specific region.
 * @param region - The region of the user.
 * @param userId - The ID of the user.
 * @returns The authentication token for the user.
 * @throws UnauthorizedError if the user is not found or the authentication token is missing.
 */
export default async (region: string, userId: string) => {
  await AuthenticationModel.read();
  const userIndex = AuthenticationModel.chain
    .get("users")
    .findIndex({ region, user_id: userId })
    .value();

  const authToken = AuthenticationModel.data.users[userIndex]?.authtoken;

  if (userIndex < 0 || !authToken) throw new UnauthorizedError();

  return authToken;
};


export const getAccessToken = async (region: string, userId: string) => {
  await AuthenticationModel.read();
  const userIndex = AuthenticationModel.chain
    .get("users")
    ?.findIndex({ region, user_id: userId })
    ?.value();

  const accessToken = AuthenticationModel.data.users[userIndex]?.access_token;

  if (userIndex < 0 || !accessToken) throw new UnauthorizedError();

  return accessToken;
};

export const getAppOrganizationUID = (): string => {
  const config = loadAppConfig();
  const uid = config?.organization?.uid;

  if (!uid) {
    throw new Error("Organization UID not found in app.json");
  }

  return uid;
};

export const getAppOrganization = () => {
  const config = loadAppConfig();
  const org = config?.organization;

  if (!org?.uid || !org?.name) {
    throw new Error("Organization details not found in app.json");
  }

  return {
    uid: org?.uid,
    name: org?.name,
  };
};

export const getAppConfig = () => {
  const config = loadAppConfig();
  if (!config?.oauthData) {
    throw new Error("SSO is not configured. Missing oauthData in app.json");
  }

  return config;
};