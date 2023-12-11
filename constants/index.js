let env = null;
let config = {};
module.exports = {
  NODE_CLI_ENV_KEY: "--env",
  NODE_CLI_INVALID_ENV:
    "Please provide a valid cli argument for --env when starting the node server",
  CONFIG_FILE_PATHS: {
    dev: "../config-dev.json",
    stage: "../config-stage.json",
    prod: "../config.json",
  },
  setEnv: (e) => (env = e),
  getEnv: () => env,
  setConfig: (c) => (config = c),
  getConfig: (key) => (key ? config[key] : config),
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
