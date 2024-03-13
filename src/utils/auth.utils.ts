import AuthenticationModel from "../models/authentication.js";
import { UnauthorizedError } from "../utils/custom-errors.utils.js";

export default async (region: string, userId: string) => {
  const res = await AuthenticationModel.findOne({
    region: region,
    user_id: userId,
  }).lean();

  if (!res?.authtoken) throw new UnauthorizedError();

  return res?.authtoken;
};
