import { createLogger, format, transports } from 'winston';

//Logger for custom logs
const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    // - Write all logs with importance level of `info` or less to `combined.log`
    new transports.File({ filename: 'combine.log' }),
    // new transports.Console({})
    new transports.Console({ level: 'info' })
  ]
});

export default logger;
