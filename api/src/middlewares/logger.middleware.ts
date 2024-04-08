import expressWinston from "express-winston";
import logger from "../utils/logger.js";

//Logger Middleware to log every request
const loggerMiddleware = expressWinston.logger({
  level: "info",
  colorize: true,
  winstonInstance: logger,
  headerBlacklist: [
    "app_token",
    "access_token",
    "authorization",
    "secret_key",
    "secret",
  ],
  metaField: null,
});

export default loggerMiddleware;
