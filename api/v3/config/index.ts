import dotenv from "dotenv";
import path from "path";

/**
 * v3 config — standalone. Reads env directly (same `${NODE_ENV}.env` convention
 * as v2) and does NOT import from `api/src`. Only the values v3 needs.
 */
dotenv.config({
  path: path.resolve(process.cwd(), `${process.env.NODE_ENV}.env`),
});

export const v3Config = {
  /** Shared JWT secret — the SAME `app_token` secret v2 signs/verifies with. */
  APP_TOKEN_KEY: process.env.APP_TOKEN_KEY as string,
  APP_TOKEN_EXP: process.env.APP_TOKEN_EXP ?? "2d",
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI as string,
  NODE_ENV: process.env.NODE_ENV,
};
