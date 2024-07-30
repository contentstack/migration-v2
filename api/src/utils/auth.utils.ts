import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";

/**
 * Retrieves the authentication token for a given user in a specific region.
 * @param region - The region of the user.
 * @param userId - The ID of the user.
 * @returns The authentication token for the user.
 * @throws UnauthorizedError if the user is not found or the authentication token is missing.
 */
export default async (region: string, userId: string) => {
  await AuthenticationModel.read();
  const user = AuthenticationModel.data.users.find(
    user => user.region === region && user.user_id === userId
  );

  //if (userIndex < 0 || !authToken) throw new UnauthorizedError();

  if (!user || !user.authtoken) throw new UnauthorizedError();
  return user.authtoken;
};
