import dotenv from "dotenv";
import path from "path";
import { prodConfig } from "./prod.config";
import { devConfig } from "./dev.config";

dotenv.config({
  path: path.resolve(process.cwd(), `${process.env.NODE_ENV}.env`),
});

export type ConfigType = {
  APP_TOKEN_EXP: string;
  APP_TOKEN_KEY: string;
  PORT: string;
  APP_ENV: string;
  MONGODB_URI: string;
  CS_API: {
    US: string;
    EU: string;
    AZURE_NA: string;
    AZURE_EU?: string;
  };
};

export const config: ConfigType = {
  APP_TOKEN_EXP: "1d",
  PORT: process.env.PORT!,
  APP_ENV: process.env.NODE_ENV!,
  APP_TOKEN_KEY: process.env.APP_TOKEN_KEY!,
  MONGODB_URI: process.env.MONGODB_URI!,
  ...(process.env.NODE_ENV === "production" ? prodConfig : devConfig),
};
