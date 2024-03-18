import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";

export default async (region: string, userId: string) => {
  await AuthenticationModel.read();
  const userIndex = AuthenticationModel.chain
    .get("users")
    .findIndex({
      region: region,
      user_id: userId,
    })
    .value();

  const authToken = AuthenticationModel.data.users[userIndex]?.authtoken;

  if (userIndex < 0 || !authToken) throw new UnauthorizedError();

  return authToken;
};
