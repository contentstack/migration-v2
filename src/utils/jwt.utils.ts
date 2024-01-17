/// src/utils/jwt.utils.ts
import jwt from "jsonwebtoken";
import { MigrationPayload } from "../models/types";
import { config } from "../config";

// @typescript-eslint/no-explicit-any
export const generateToken = (payload: MigrationPayload): string => {
  return jwt.sign(payload, config.APP_TOKEN_KEY, {
    expiresIn: config.APP_TOKEN_EXP,
  });
};
