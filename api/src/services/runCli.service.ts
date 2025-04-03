import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 } from 'uuid';
import { copyDirectory, createDirectoryAndFile } from '../utils/index.js';
import { CS_REGIONS, MIGRATION_DATA_CONFIG } from '../constants/index.js';
import ProjectModelLowdb from '../models/project-lowdb.js';
import AuthenticationModel from '../models/authentication.js';
import watchLogs from '../utils/watch.utils.js';
import { setLogFilePath } from '../server.js';

/**
 * Represents a test stack with migration status
 */
interface TestStack {
  stackUid: string;
  isMigrated: boolean;
}
import utilitiesHandler from '@contentstack/cli-utilities';

/**
 * Adds a custom message to the CLI logs file
 * @param loggerPath - Path to the log file
 * @param level - Log level (default: 'info')
 * @param message - Message to be logged
 */
const addCustomMessageInCliLogs = async (
  loggerPath: string,
  level: string = 'info',
  message: string
) => {
  try {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    // Create directory if it doesn't exist
    const logDir = path.dirname(loggerPath);
    await fs.promises.mkdir(logDir, { recursive: true });

    // Append log with proper formatting
    await fs.promises.appendFile(
      loggerPath,
      JSON.stringify(logEntry, null, 2) + '\n'
    );

    // Also log to console based on level
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      default:
        console.info(message);
    }
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
};

/**
 * Determines log level based on message content without removing ANSI codes
 */
const determineLogLevel = (text: string): string => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('error') || lowerText.includes('failed')) {
    return 'error';
  } else if (lowerText.includes('warn')) {
    return 'warn';
  } else {
    return 'info';
  }
};

/**
 * Executes CLI commands and provides real-time output
 * Uses Node's spawn to run commands asynchronously
 */
const runCommand = (
  command: string,
  args: string[] = [],
  logFilePath?: string
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const cmdProcess = spawn(command, args, { shell: true });

    // Capture stdout and write to log file
    cmdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output); // Display in console

      // Log to the provided log file path if available
      if (logFilePath) {
        try {
          // Determine log level based on content but keep ANSI codes
          const logLevel = determineLogLevel(output);

          const logEntry = {
            level: logLevel,
            message: output.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Error writing stdout to log file:', err);
        }
      }
    });

    // Capture stderr and write to log file
    cmdProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output); // Display in console

      // Log to the provided log file path if available
      if (logFilePath) {
        try {
          const logEntry = {
            level: 'error',
            message: output.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Error writing stderr to log file:', err);
        }
      }
    });

    cmdProcess.on('close', (code) => {
      if (code === 0) resolve();
      else {
        // Log the error to the log file
        if (logFilePath) {
          try {
            const logEntry = {
              level: 'error',
              message: `Command failed with exit code ${code}`,
              timestamp: new Date().toISOString(),
            };
            fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
          } catch (err) {
            console.error('Error writing close event to log file:', err);
          }
        }
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
};

/**
 * Main CLI execution function for content migration
 * @param rg - Region identifier
 * @param user_id - User ID
 * @param stack_uid - Stack UID
 * @param projectId - Project ID
 * @param isTest - Flag to indicate if this is a test migration
 * @param transformePath - Path to transform configuration
 */
export const runCli = async (
  rg: string,
  user_id: string,
  stack_uid: string,
  projectId: string,
  isTest = false,
  transformePath: string
) => {
  try {
    // Set appropriate completion message based on migration type
    const message = isTest
      ? 'Test Migration Process Completed'
      : 'Migration Process Completed';

    // Format region string for CLI compatibility
    const regionPresent =
      CS_REGIONS.find((item) => item === rg) ?? 'NA'.replace(/_/g, '-');
    const regionCli = regionPresent.replace(/_/g, '-');

    // Fetch user authentication data
    await AuthenticationModel.read();
    const userData = AuthenticationModel.chain
      .get('users')
      .find({ region: regionPresent, user_id })
      .value();

    // Configure CLI with region settings
    await runCommand(
      'npx',
      ['@contentstack/cli', 'config:set:region', `${regionCli}`],
      transformePath
    ); // Pass the log file path here

    // Set up authentication configuration for CLI
    utilitiesHandler.configHandler.set('authtoken', userData.authtoken);
    utilitiesHandler.configHandler.set('email', userData.email);
    utilitiesHandler.configHandler.set('authorisationType', 'BASIC');

    if (userData?.authtoken && stack_uid) {
      // Set up paths for backup and source data
      const {
        BACKUP_DATA,
        BACKUP_LOG_DIR,
        BACKUP_FOLDER_NAME,
        BACKUP_FILE_NAME,
      } = MIGRATION_DATA_CONFIG;

      // Create source and backup paths
      const sourcePath = path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA,
        stack_uid
      );
      const backupPath = path.join(
        process.cwd(),
        BACKUP_DATA,
        `${stack_uid}_${v4().slice(0, 4)}`
      );

      // Create backup of source data
      await copyDirectory(sourcePath, backupPath);

      // Set up logging
      const loggerPath = path.join(
        backupPath,
        BACKUP_LOG_DIR,
        BACKUP_FOLDER_NAME,
        BACKUP_FILE_NAME
      );
      await createDirectoryAndFile(loggerPath, transformePath);

      // Make sure to set the global.currentLogFile to the project log file
      // This is the key part - setting the log file path to the migration service log file
      await setLogFilePath(transformePath);
      await watchLogs(loggerPath, transformePath);

      // Execute the stack import command
      await runCommand(
        'npx',
        [
          '@contentstack/cli',
          'cm:stacks:import',
          '-k',
          stack_uid,
          '-d',
          sourcePath.includes(' ') ? `"${sourcePath}"` : sourcePath,
          '--backup-dir',
          backupPath.includes(' ') ? `"${backupPath}"` : backupPath,
          '--yes',
        ],
        transformePath
      ); // Pass the log file path here

      // Update project status after migration
      const projectIndex = ProjectModelLowdb.chain
        .get('projects')
        .findIndex({ id: projectId })
        .value();

      // Handle test migration updates
      if (projectIndex > -1 && isTest) {
        const project = ProjectModelLowdb.data.projects[projectIndex];

        // Initialize test_stacks if needed
        if (!project.test_stacks) {
          project.test_stacks = [];
        }

        // Update migration status for the specific stack
        project.test_stacks.forEach((item: TestStack) => {
          if (item.stackUid === stack_uid) {
            item.isMigrated = true;
          }
        });

        ProjectModelLowdb.write();
      }

      // Log completion message
      await addCustomMessageInCliLogs(loggerPath, 'info', message);

      // Update project status for non-test migrations
      if (!isTest) {
        ProjectModelLowdb.update((data) => {
          data.projects[projectIndex].isMigrationCompleted = true;
          data.projects[projectIndex].isMigrationStarted = false;
        });
      }
    } else {
      console.info('User not found.');
    }

    console.info('✅ Region setup and import command executed successfully');
  } catch (error) {
    console.error('🚀 ~ runCli ~ error:', error);
  }
};

export const utilsCli = { runCli };
