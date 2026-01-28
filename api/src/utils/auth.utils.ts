import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";
// CommonJS-safe JSON loading
// eslint-disable-next-line @typescript-eslint/no-var-requires
import appConfig from "../../../app.json"

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
  const uid = appConfig?.organization?.uid;

  if (!uid) {
    throw new Error("Organization UID not found in app.json");
  }

  return uid;
};

export const getAppOrganization = () => {
  const org = appConfig?.organization;

  if (!org?.uid || !org?.name) {
    throw new Error("Organization details not found in app.json");
  }

  return {
    uid: org?.uid,
    name: org?.name,
  };
};

export const getAppConfig = () => {
  if (!appConfig?.oauthData) {
    throw new Error("SSO is not configured. Missing oauthData in app.json");
  }

  return appConfig;
};