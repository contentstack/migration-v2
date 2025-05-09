import expressWinston from "express-winston";
import logger from "../utils/logger.js";

//Logger Middleware to log every request
/**
 * Express middleware for logging HTTP requests.
 *
 * @remarks
 * This middleware uses `express-winston` to log HTTP requests with the specified options.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
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
