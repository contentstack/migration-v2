import fs from 'fs';
import path from "path";
import { createLogger, format, transports } from "winston";
import logger from './logger.js';


const fileExists = async (path: string): Promise<boolean> => {
  try {
    await fs.promises.access(path);
    return true;  // Path exists
  } catch (error) {
    return false;  // Path does not exist
  }
}

//Logger for custom logs
/**
 * The logger instance used for logging messages.
 */
const customLogger = async (projectId: string, apiKey: string, level: string, message: string) => {
  try {
    const logDir = path.join(process.cwd(), 'logs', projectId);
    const logFilePath = path.join(logDir, `${apiKey}.log`);
    // Ensure log directory exists, using async/await with fs.promises
    if (!fs.existsSync(logDir)) {
      await fs.promises.mkdir(logDir, { recursive: true });
    }

    if (!fs.existsSync(logFilePath)) {
      // If the file does not exist, create it and write an initial log entry
      fs.promises.writeFile(logFilePath, 'Log file created\n', { flag: 'a' }); // 'a' flag for appending
      console.info(`Log file created and initial entry written: ${logFilePath}`);
    }
    // Create a logger instance with a file transport
    const log = createLogger({
      level: 'info',
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        // Write logs to a file named after the apiKey
        new transports.File({ filename: logFilePath }),
      ],
    });

    // Handle the logging levels dynamically
    switch (level) {
      case 'error': {
        log.error(message);  // Log to file
        logger.error(message);  // Log to console/logger
        break;
      }
      case 'warn': {
        log.warn(message);
        logger.warn(message);
        break;
      }
      case 'info': {
        log.info(message);
        logger.info(message);
        break;
      }
      case 'debug': {
        log.debug(message);
        logger.debug(message);
        break;
      }
      default: {
        log.info(message);  // Default to info level
        logger.info(message);
      }
    }

    if (await fileExists(logFilePath)) {
      return;  // Exit function if log file exists after logging
    } else {
      console.error(`Log file was not created.`);
    }
  } catch (error: any) {
    console.error(`Failed to log message: ${error.message}`);
  }
};

export default customLogger;