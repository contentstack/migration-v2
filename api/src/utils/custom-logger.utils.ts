import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';
import logger from './logger.js';
import { getSafePath } from './sanitize-path.utils.js';

// Utility function to safely join and resolve paths
/**
 * Safely joins and resolves paths to prevent directory traversal attacks
 * @param basePath - Base directory that should contain the result
 * @param paths - Path segments to join with the base path
 * @returns A safe absolute path guaranteed to be within basePath
 */
const safeJoin = (basePath: string, ...paths: string[]): string => {
  // Get normalized absolute base path
  const absoluteBasePath = path.resolve(basePath);

  // Get sanitized absolute resolved path
  const resolvedPath = getSafePath(path.resolve(basePath, ...paths));

  // Use path.relative to check containment - this is more secure
  const relativePath = path.relative(absoluteBasePath, resolvedPath);

  // Check if path attempts to traverse up/outside the base directory
  if (
    relativePath === '' ||
    relativePath === '.' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  ) {
    return resolvedPath; // Path is safely within base directory
  }

  // Path is trying to escape - reject it
  throw new Error('Invalid file path: Directory traversal attempt detected');
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await fs.promises.access(path);
    return true; // Path exists
  } catch (error) {
    return false; // Path does not exist
  }
};

//Logger for custom logs
/**
 * The logger instance used for logging messages.
 */
/**
 * Winston loggers cached by log file path.
 *
 * Each `transports.File` opens a write stream and keeps it open for the life of
 * the logger. Building a logger per call — in a loop over thousands of assets —
 * leaks one file descriptor per log line until the process hits EMFILE, which
 * then breaks every unrelated fs operation too. One logger per file, reused.
 */
const loggerCache = new Map<string, ReturnType<typeof createLogger>>();

const getFileLogger = (logFilePath: string) => {
  const cached = loggerCache.get(logFilePath);
  if (cached) return cached;

  const log = createLogger({
    level: process.env.LOG_LEVEL || 'silly', // Use 'silly' to capture ALL log levels
    format: format.combine(format.timestamp(), format.json()),
    transports: [
      // Write logs to a file named after the apiKey
      new transports.File({ filename: logFilePath }),
    ],
  });
  loggerCache.set(logFilePath, log);
  return log;
};

/**
 * Closes and forgets cached loggers, releasing their file handles.
 * Pass a path to release one log file, or omit to release all.
 */
export const closeCustomLoggers = (logFilePath?: string) => {
  const entries = logFilePath
    ? ([[logFilePath, loggerCache.get(logFilePath)]] as const)
    : [...loggerCache.entries()];
  for (const [filePath, log] of entries) {
    if (!log) continue;
    try {
      log.close();
    } catch (error: any) {
      console.error(`Failed to close logger: ${error?.message}`);
    }
    loggerCache.delete(filePath as string);
  }
};

const customLogger = async (
  projectId: string,
  apiKey: string,
  level: string,
  message: string
) => {
  try {
    // Sanitize inputs to prevent path traversal
    const sanitizedProjectId = path.basename(projectId); // Strip any path traversal attempts
    const sanitizedApiKey = path.basename(apiKey); // Strip any path traversal attempts
    const logDir = getSafePath(
      path.join(process.cwd(), 'logs', sanitizedProjectId)
    );
    const logFilePath = safeJoin(logDir, `${sanitizedApiKey}.log`);
    // Ensure log directory exists, using async/await with fs.promises
    if (!fs.existsSync(logDir)) {
      await fs.promises.mkdir(logDir, { recursive: true });
    }

    if (!fs.existsSync(logFilePath)) {
      // If the file does not exist, create it and write an initial log entry
      console.info(`Creating new log file at: ${logFilePath}`);
      // Conditionally log stack trace based on environment
      if (process.env.NODE_ENV !== 'production') {
        console.info(new Error().stack);
      }
      await fs.promises.writeFile(logFilePath, 'Log file created\n', {
        flag: 'a',
      });
      console.info(
        `Log file created and initial entry written: ${logFilePath}`
      );
    }
    // Reuse the logger for this file; see loggerCache above.
    const log = getFileLogger(logFilePath);

    // Handle the logging levels dynamically
    switch (level) {
      case 'error': {
        log.error(message); // Log to file
        logger.error(message); // Log to console/logger
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
        log.info(message); // Default to info level
        logger.info(message);
      }
    }

    if (await fileExists(logFilePath)) {
      return; // Exit function if log file exists after logging
    } else {
      console.error(`Log file was not created.`);
    }
  } catch (error: any) {
    console.error(`Failed to log message: ${error.message}`);
  }
};

export default customLogger;
