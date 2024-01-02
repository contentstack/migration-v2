import dotenv from "dotenv";
import path from "path";
import { prodConfig } from "./prod.config";
import { devConfig } from "./dev.config";

dotenv.config({
  path: path.resolve(process.cwd(), `${process.env.NODE_ENV}.env`),
});

export type ConfigType = {
  PORT: string;
  CS_API: {
    US: string;
    EU: string;
    AZURE_NA: string;
    AZURE_EU?: string;
  };
};

export const config: ConfigType = {
  PORT: process.env.PORT!,
  ...(process.env.NODE_ENV === "prod" ? prodConfig : devConfig),
};
