/// src/utils/jwt.utils.ts
import jwt from "jsonwebtoken";
import { AppTokenPayload } from "../models/types.js";
import { config } from "../config/index.js";

// @typescript-eslint/no-explicit-any
/**
 * Generates a JWT token with the provided payload.
 *
 * @param payload - The payload to be included in the token.
 * @returns The generated JWT token.
 */
export const generateToken = (payload: AppTokenPayload): string => {
  return jwt.sign(payload, config.APP_TOKEN_KEY, {
    expiresIn: config.APP_TOKEN_EXP,
  });
};
