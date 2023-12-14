import { ConfigFilePathType, constants } from "../constants";

export const throwError = (message: string, statusCode: number) => {
  throw Object.assign(new Error(message), { statusCode });
};

export const isEmpty = (val: any) =>
  val === undefined ||
  val === null ||
  (typeof val === "object" && !Object.keys(val).length) ||
  (typeof val === "string" && !val.trim().length);

export const parseCLIArgsFromProcess = (argv: string[] = []) => {
  if (argv?.length < 2) return {};
  const parsedArgs: any = {};
  (argv?.slice(2) || []).forEach((oneArg: any = "") => {
    const keyAndValue = oneArg?.split("=");
    parsedArgs[keyAndValue[0]] = keyAndValue[1];
  });
  return parsedArgs;
};

export const loadConfigFile = (cliArgs: any = {}) => {
  constants.setEnv(cliArgs[constants.NODE_CLI_ENV_KEY]);
  const configFilePath = constants.CONFIG_FILE_PATHS[constants.getEnv()];
  if (!configFilePath) throw new Error(constants.NODE_CLI_INVALID_ENV);
  constants.setConfig(configFilePath);
};
