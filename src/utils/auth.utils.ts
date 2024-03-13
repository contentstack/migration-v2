import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";
import _ from "lodash";

export default async (region: string, userId: string) => {
  AuthenticationModel.read();
  const userIndex = _.findIndex(AuthenticationModel.data.users, {
    region: region,
    user_id: userId,
  });

  const authToken = AuthenticationModel.data.users[userIndex]?.authtoken;

  if (userIndex < 0 || !authToken) throw new UnauthorizedError();

  return authToken;
};
