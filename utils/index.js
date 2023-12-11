const constants = require("../constants");

const throwError = (message, statusCode) => {
  throw Object.assign(new Error(message), { statusCode });
};

const isEmpty = (val) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);

const parseCLIArgsFromProcess = (argv = []) => {
  if (argv?.length < 2) return {};
  const parsedArgs = {};
  (argv?.slice(2) || []).forEach((oneArg = "") => {
    const keyAndValue = oneArg?.split("=");
    parsedArgs[keyAndValue[0]] = keyAndValue[1];
  });
  return parsedArgs;
};

const loadConfigFile = (cliArgs = {}) => {
  constants.setEnv(cliArgs[constants.NODE_CLI_ENV_KEY]);
  const configFilePath = constants.CONFIG_FILE_PATHS[constants.getEnv()];
  if (!configFilePath) throw new Error(constants.NODE_CLI_INVALID_ENV);
  constants.setConfig(require(configFilePath));
};

module.exports = {
  isEmpty,
  throwError,
  parseCLIArgsFromProcess,
  loadConfigFile,
};
