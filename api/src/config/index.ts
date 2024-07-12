import dotenv from "dotenv";
import path from "path";
import { prodConfig } from "./prod.config.js";
import { devConfig } from "./dev.config.js";

dotenv.config({
  path: path.resolve(process.cwd(), `${process.env.NODE_ENV}.env`),
});

/**
 * Configuration type for the application.
 */
export type ConfigType = {
  APP_TOKEN_EXP: string;
  APP_TOKEN_KEY: string;
  FILE_UPLOAD_KEY: string;
  PORT: string;
  APP_ENV: string;
  MONGODB_URI: string;
  LOG_FILE_PATH : string;
  CS_API: {
    NA: string;
    EU: string;
    AZURE_NA: string;
    AZURE_EU?: string;
  };
  CS_URL: {
    NA: string;
    EU: string;
    AZURE_NA: string;
    AZURE_EU?: string;
  };
};

/**
 * Loads the configuration from environment variables and returns the configuration object.
 * @returns The configuration object.
 */
export const config: ConfigType = {
  /**
   * Expiration time for the application token.
   */
  APP_TOKEN_EXP: "1d",
  /**
   * Key used to sign the application token.
   */
  APP_TOKEN_KEY: process.env.APP_TOKEN_KEY!,
  /**
   * Key used for file uploads.
   */
  FILE_UPLOAD_KEY: process.env.FILE_UPLOAD_KEY!,
  /**
   * Port on which the server will listen.
   */
  PORT: process.env.PORT!,
  /**
   * Environment in which the application is running.
   */
  APP_ENV: process.env.NODE_ENV!,
  /**
   * MongoDB connection URI.
   */
  MONGODB_URI: process.env.MONGODB_URI!,

  ...(process.env.NODE_ENV === "production" ? prodConfig : devConfig),
};

