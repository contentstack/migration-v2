/// src/utils/jwt.utils.ts
import jwt from "jsonwebtoken";
import { MigrationPayload } from "../models/types";

const secretKey = process.env.JWT_SECRET_KEY ?? "default_secret_key";

// @typescript-eslint/no-explicit-any
export const generateToken = (payload: MigrationPayload): string => {
  return jwt.sign(payload, secretKey, { expiresIn: "1h" });
};
