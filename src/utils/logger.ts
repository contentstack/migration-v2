import { createLogger, format, transports } from "winston";

//Logger for custom logs
const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    // - Write all logs with importance level of `error` or less to `error.log`
    new transports.File({ filename: "error.log", level: "error" }),
    // - Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ filename: "combine.log" }),
    new transports.Console({
      format: format.combine(format.timestamp(), format.prettyPrint()),
    }),
  ],
});

export default logger;
