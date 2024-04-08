/// src/utils/jwt.utils.ts
import jwt from "jsonwebtoken";
import { AppTokenPayload } from "../models/types.js";
import { config } from "../config/index.js";

// @typescript-eslint/no-explicit-any
export const generateToken = (payload: AppTokenPayload): string => {
  return jwt.sign(payload, config.APP_TOKEN_KEY, {
    expiresIn: config.APP_TOKEN_EXP,
  });
};
