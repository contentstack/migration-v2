/* eslint-disable */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 } from 'uuid';
import { copyDirectory, createDirectoryAndFile } from '../utils/index.js';
import { CS_REGIONS, MIGRATION_DATA_CONFIG, DATABASE_FILES, getStepperSteps } from '../constants/index.js';
import ProjectModelLowdb from '../models/project-lowdb.js';
import AuthenticationModel from '../models/authentication.js';
// import watchLogs from '../utils/watch.utils.js';
import { setLogFilePath } from '../server.js';

/**
 * Represents a test stack with migration status
 */
interface TestStack {
  stackUid: string;
  isMigrated: boolean;
}
import { setBasicAuthConfig, setOAuthConfig } from '../utils/config-handler.util.js';
import writeUidMapping, { writePerLocaleEntryUidMapping } from '../utils/uid-mapper.utils.js';
import { recordMigratedLocales } from '../utils/locale-migration.utils.js';

/**
 * Determines log level based on message content without removing ANSI codes
 */
const determineLogLevel = (text: string): string => {
  const lowerText = text.toLowerCase();

  // Check for errors first - be more aggressive in detection
  if (
    lowerText.includes('error') ||
    lowerText.includes('failed') ||
    lowerText.includes('exception') ||
    lowerText.includes('not found')
  ) {
    return 'error';
  }
  // Then check for warnings
  else if (lowerText.includes('warn') || lowerText.includes('warning')) {
    return 'warn';
  }
  // Default to info
  else {
    return 'info';
  }
};

/**
 * Strips ANSI color codes from text to create clean logs
 */
const stripAnsiCodes = (text: string): string => {
  // This regex removes all ANSI escape sequences (color codes)
  return text.replace(/\u001b\[\d+m/g, '');
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

    // For stdout handler
    cmdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output); // Keep colors in console

      if (logFilePath) {
        try {
          // Clean the output by removing ANSI color codes
          const cleanedOutput = stripAnsiCodes(output);
          const logLevel = determineLogLevel(cleanedOutput);
          const logEntry = {
            level: logLevel,
            message: cleanedOutput.trim(),
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
        } catch (err) {
          console.error('Error writing to log file:', err);
        }
      }
    });

    // For stderr handler — a per-entry/per-task failure (e.g. an "Entry localization
    // failed" 422 from the management API) surfaces here even when the CLI's overall
    // import still exits 0 and continues with the rest of the batch. Log it as an error
    // line so it's visible in the execution log, but don't treat it as fatal — the CLI is
    // deliberately best-effort per entry, and the exit code is still the source of truth
    // for whether the run as a whole succeeded or needs a retry.
    cmdProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output); // Keep colors in console

      if (logFilePath) {
        try {
          // Clean the output by removing ANSI color codes
          const cleanedOutput = stripAnsiCodes(output);
          const logEntry = {
            level: 'error',
            message: cleanedOutput.trim(),
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
 * Writes a distinct failure marker to the migration log(s) and clears the stuck
 * "in progress" flag, so MigrationLogViewer.tsx — which only ever stops waiting on an
 * exact terminal string — doesn't spin forever, and the run can be retried.
 */
const writeFailureMarker = async (
  isTest: boolean,
  projectId: string,
  transformePath: string,
  loggerPath?: string
): Promise<void> => {
  try {
    const failureLogEntry = {
      level: 'error',
      message: isTest ? 'Test Migration Process Failed' : 'Migration Process Failed',
      timestamp: new Date().toISOString(),
    };
    fs.appendFileSync(transformePath, JSON.stringify(failureLogEntry) + '\n');
    if (loggerPath && loggerPath !== transformePath) {
      fs.appendFileSync(loggerPath, JSON.stringify(failureLogEntry) + '\n');
    }
  } catch (logErr) {
    console.error('Error writing failure marker to log file:', logErr);
  }
  if (!isTest) {
    try {
      await ProjectModelLowdb.read();
      const projectIndex = ProjectModelLowdb.chain
        .get('projects')
        .findIndex({ id: projectId })
        .value();
      if (projectIndex > -1) {
        ProjectModelLowdb.data.projects[projectIndex].isMigrationStarted = false;
        await ProjectModelLowdb.write();
      }
    } catch (statusErr) {
      console.error('Error resetting migration status after failure:', statusErr);
    }
  }
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
    await runCommand(
      'npx',
      ['@contentstack/cli', 'config:set:region', `${regionCli}`],
      transformePath
    ); // Pass the log file path here

    if(userData?.access_token){
      setOAuthConfig(userData);

    }else if(userData?.authtoken){
      setBasicAuthConfig(userData);
    }else {
      throw new Error("No authentication token found");
    }


    if (userData?.authtoken && stack_uid || userData?.access_token && stack_uid) {
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

      // Debug which log path is being used

      // Make sure to set the global.currentLogFile to the project log file
      // This is the key part - setting the log file path to the migration service log file
      await setLogFilePath(transformePath);
      // Comment out the watchLogs call to see if that's causing the issue
      // await watchLogs(loggerPath, transformePath);

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

      // After the import command completes.
      //
      // Note: the CLI's import plugin runs best-effort per entry — a single entry failing
      // (e.g. an "Entry localization failed" 422, logged as an 'error' line above by the
      // stderr handler) does not stop it from continuing with and completing the rest of the
      // batch, and it still exits 0. That's by design, so a run is treated as complete here
      // whenever the process exits 0, even if some individual entries logged errors along the
      // way — those errors remain visible in the execution log for follow-up, but don't block
      // the rest of the migration. Only a non-zero exit (handled below, in the catch block)
      // means nothing happened and the run needs a full retry.

      // Write the completion message ONCE in the format the UI expects
      if (isTest) {
        const directLogEntry = {
          level: 'info',
          message: 'Test Migration Process Completed',
          timestamp: new Date().toISOString(),
        };

        // Write to the transform path (main log file) - ONLY ONCE
        fs.appendFileSync(
          transformePath,
          JSON.stringify(directLogEntry) + '\n'
        );

        // Also write to backup log path if different
        if (loggerPath && loggerPath !== transformePath) {
          fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + '\n');
        }
      } else {
        const directLogEntry = {
          level: 'info',
          message: 'Migration Process Completed',
          timestamp: new Date().toISOString(),
        };

        // Write to the transform path (main log file) - ONLY ONCE
        fs.appendFileSync(
          transformePath,
          JSON.stringify(directLogEntry) + '\n'
        );

        // Also write to backup log path if different
        if (loggerPath && loggerPath !== transformePath) {
          fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + '\n');
        }
        await ProjectModelLowdb.read();
        const projectData = ProjectModelLowdb.chain
          .get("projects")
          .find({ id: projectId })
          .value();
        const iteration = projectData?.iteration || 1;
        await writeUidMapping(backupPath, projectId, iteration);
        await writePerLocaleEntryUidMapping(backupPath, projectId, iteration);
      }

      // Make sure we have the latest data
      await ProjectModelLowdb.read();
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

        await ProjectModelLowdb.write();
      }

      // Update project status for non-test migrations
      if (projectIndex > -1 && !isTest) {
        // Direct modification might be more reliable
        ProjectModelLowdb.data.projects[projectIndex].isMigrationCompleted =
          true;
        ProjectModelLowdb.data.projects[projectIndex].isMigrationStarted =
          false;
        // Migration completed → land on the final Execute step (6 on delta iterations, 5 otherwise).
        ProjectModelLowdb.data.projects[projectIndex].current_step =
          getStepperSteps(ProjectModelLowdb.data.projects[projectIndex]?.iteration).MIGRATION;
        ProjectModelLowdb.data.projects[projectIndex].status = 5;
        await ProjectModelLowdb.write();

        // On iteration 1 the full configured locale set genuinely gets migrated in a single
        // bulk import — this CLI IS the terminal step, so recording here is safe.
        // For iteration 2+, recording is deliberately deferred to migration.service.ts, AFTER
        // the update/localize CLI (`utilsUpdateCli.updateEntryCli`) actually completes. If we
        // recorded here, a locale queued in updated-entries.json would be marked migrated
        // even when the subsequent update CLI never wrote it (it swallows failures — see
        // updateEntryCli.service.ts:240-249), and would then be silently skipped on the next
        // restart — the very bug this PR fixes, just via a different trigger.
        const proj: any = ProjectModelLowdb.data.projects[projectIndex];
        const currentIteration = proj?.iteration || 1;
        if (currentIteration <= 1) {
          const ranLocales = Array.from(
            new Set([
              ...Object.keys(proj?.master_locale ?? {}),
              ...Object.keys(proj?.locales ?? {}),
            ]),
          );
          await recordMigratedLocales(projectId, ranLocales);
        }
      }
    } else {
      console.info('User not found.');
    }
  } catch (error) {
    console.error('🚀 ~ runCli ~ error:', error);
    // The CLI import can hard-fail (e.g. a stack import validation error) after
    // `runCommand` already logged the raw error, but nothing below this point ever ran —
    // in particular the 'Migration Process Completed' terminal marker never got written.
    // MigrationLogViewer.tsx only ever stops waiting when it sees that exact string, so
    // without an explicit failure marker the UI spins forever with no way to retry.
    await writeFailureMarker(isTest, projectId, transformePath);
  }
};

export const utilsCli = { runCli };