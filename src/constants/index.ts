let env: "dev" | "stage" | "prod";
let config: any = {};

export type ConfigFilePathType = {
  dev: string;
  stage: string;
  prod: string;
}
export type HttpErrorCodes = {
  HTTP_OK: number;
  FORBIDDEN: number;
  BAD_REQUEST: number;
  UNAUTHORIZED: number;
  TOO_MANY_REQS: number;
  SOMETHING_WRONG: number;
  MOVED_PERMANENTLY: number;
};
export type ConstantType = {
  NODE_CLI_ENV_KEY: string;
  NODE_CLI_INVALID_ENV: string;
  CONFIG_FILE_PATHS: ConfigFilePathType;
  setEnv: (e: "dev" | "stage" | "prod") => void;
  getEnv: () => "dev" | "stage" | "prod";
  setConfig: Function;
  getConfig: Function;
  HTTP_ERROR_CODES: HttpErrorCodes;
  HTTP_ERROR_TEXTS: HttpErrorTexts;
  HTTP_RESPONSE_HEADERS: HttpResponseHeaders;
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: Array<string>;
};

export type HttpErrorTexts = {
  INTERNAL_ERROR: string;
  SOMETHING_WENT_WRONG: string;
};

export type HttpResponseHeaders = {
  "Access-Control-Allow-Origin": string;
  "Content-Type": string;
  Connection: string;
};

export const constants: ConstantType = {
  NODE_CLI_ENV_KEY: "--env",
  NODE_CLI_INVALID_ENV:
    "Please provide a valid cli argument for --env when starting the node server",
  CONFIG_FILE_PATHS: {
    dev: "../config-dev.json",
    stage: "../config-stage.json",
    prod: "../config.json",
  },
  setEnv: (e: any) => (env = e),
  getEnv: () => env,
  setConfig: (c: any) => (config = c),
  getConfig: (key: string) => (key ? config[key] : config) as any,
  HTTP_ERROR_CODES: {
    HTTP_OK: 200,
    FORBIDDEN: 403,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    TOO_MANY_REQS: 429,
    SOMETHING_WRONG: 501,
    MOVED_PERMANENTLY: 301,
  },
  HTTP_ERROR_TEXTS: {
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG:
      "Something went wrong while processing your request, please try again.",
  },
  HTTP_RESPONSE_HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    Connection: "close",
  },
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: ["PUT", "POST", "DELETE", "PATCH"],
};