import { createLogger, format, transports } from "winston";

//Logger for custom logs
/**
 * The logger instance used for logging messages.
 */
const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    // - Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ filename: "combine.log" }),
    new transports.Console({}),
  ],
});

export default logger;
