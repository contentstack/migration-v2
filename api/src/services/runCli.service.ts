/* eslint-disable */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 } from 'uuid';
import { copyDirectory, createDirectoryAndFile } from '../utils/index.js';
import { CMS, CS_REGIONS, MIGRATION_DATA_CONFIG, DATABASE_FILES, STEPPER_STEPS } from '../constants/index.js';
import { resolveContentstackExportRoot } from './validation.service.js';
import ProjectModelLowdb from '../models/project-lowdb.js';
import AuthenticationModel from '../models/authentication.js';
// import watchLogs from '../utils/watch.utils.js';
import { setLogFilePath } from '../server.js';
import { normalizeLinkFieldsInExport } from '../utils/normalize-entry-links.utils.js';
import { assertExportPathInAllowedRoot } from '../utils/sanitize-path.utils.js';

/**
 * Represents a test stack with migration status
 */
interface TestStack {
  stackUid: string;
  isMigrated: boolean;
}
import { setBasicAuthConfig, setOAuthConfig } from '../utils/config-handler.util.js';
import writeUidMapping from '../utils/uid-mapper.utils.js';

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

const IMPORTABLE_MODULES = new Set([
  'assets',
  'content-types',
  'entries',
  'environments',
  'extensions',
  'marketplace-apps',
  'global-fields',
  'labels',
  'locales',
  'webhooks',
  'workflows',
  'custom-roles',
  'taxonomies',
  'stack',
  'personalize-projects',
  'personalize'
]);

const readImportModulesFromExport = (sourcePath: string): string[] => {
  try {
    const dirs = fs
      .readdirSync(sourcePath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry?.name);

    // `composable-studio` causes MODULE_NOT_FOUND on some CLI versions; skip it.
    return dirs.filter(
      (moduleName) =>
        moduleName !== 'composable-studio' && IMPORTABLE_MODULES.has(moduleName)
    );
  } catch {
    return [];
  }
};

const resolveSourcePathForImport = (project: any, stackUid: string): string => {
  const defaultPath = path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, stackUid);
  if (!project?.legacy_cms) {
    return defaultPath;
  }

  // For Contentstack-to-Contentstack, prefer the actual export path regardless of source_mode.
  // These fields are user-controlled via source-config updates, so the resolved path is
  // constrained to the allowlisted migration roots before being handed to the CLI.
  if (project?.legacy_cms?.cms === CMS.CONTENTSTACK) {
    const sourcePath =
      project?.legacy_cms?.source_details?.export_path ||
      project?.legacy_cms?.source_details?.imported_data_path ||
      project?.extract_path;
    if (!sourcePath) return defaultPath;
    try {
      return assertExportPathInAllowedRoot(sourcePath);
    } catch {
      return defaultPath;
    }
  }

  return defaultPath;
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
    let commandOutput = '';

    // For stdout handler
    cmdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output); // Keep colors in console
      commandOutput += stripAnsiCodes(output);

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

    // For stderr handler
    cmdProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(output); // Keep colors in console
      commandOutput += stripAnsiCodes(output);

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
      const normalizedOutput = commandOutput.toLowerCase();
      // Do not treat generic `error:` as fatal: Contentstack cm:stacks:import logs
      // `[timestamp] ERROR: ...` for per-asset / per-taxonomy failures while still exiting 0.
      const hasFatalCliMessage =
        normalizedOutput.includes("we can't find that stack") ||
        normalizedOutput.includes('stack api key: is not valid') ||
        normalizedOutput.includes('module_not_found') ||
        normalizedOutput.includes('command failed');

      if (code === 0 && !hasFatalCliMessage) {
        resolve();
      } else {
        // Log the error to the log file
        if (logFilePath) {
          try {
            const logEntry = {
              level: 'error',
              message:
                code === 0 && hasFatalCliMessage
                  ? 'CLI reported a fatal error despite exit code 0'
                  : `Command failed with exit code ${code}`,
              timestamp: new Date().toISOString(),
            };
            fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + '\n');
          } catch (err) {
            console.error('Error writing close event to log file:', err);
          }
        }
        const summarizedOutput = commandOutput.trim().slice(-3000);
        reject(
          new Error(
            `Command failed with exit code ${code}${
              summarizedOutput ? `\n${summarizedOutput}` : ''
            }`
          )
        );
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


    if ((userData?.authtoken && stack_uid) || (userData?.access_token && stack_uid)) {
      // Set up paths for backup and source data
      const {
        BACKUP_DATA,
        BACKUP_LOG_DIR,
        BACKUP_FOLDER_NAME,
        BACKUP_FILE_NAME,
      } = MIGRATION_DATA_CONFIG;

      await ProjectModelLowdb.read();
      const project = ProjectModelLowdb.chain
        .get('projects')
        .find({ id: projectId })
        .value();

      // Create source and backup paths. runCli owns the backup lifecycle —
      // it creates the folder here and deletes it after a successful import.
      const sourcePath = resolveSourcePathForImport(project, stack_uid);
      const backupPath = path.join(
        process.cwd(),
        BACKUP_DATA,
        `${stack_uid}_${v4().slice(0, 4)}`
      );

      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error(`Source import path does not exist: ${sourcePath}`);
      }

      let importDataPath = sourcePath;

      if (isTest && project?.legacy_cms?.cms === CMS.CONTENTSTACK) {
        const resolvedExportRoot = resolveContentstackExportRoot(sourcePath);
        if (!resolvedExportRoot) {
          throw new Error(
            'Could not resolve Contentstack export root for test migration. Re-validate the export in Step 1.'
          );
        }
        // For stack-to-stack, the data is already in Contentstack format — import the full export.
        importDataPath = resolvedExportRoot;
      }

      try {
        // Create backup of the data actually imported (full export for final; pruned tree for CS test)
        await copyDirectory(importDataPath, backupPath);

        const loggerPath = path.join(
          backupPath,
          BACKUP_LOG_DIR,
          BACKUP_FOLDER_NAME,
          BACKUP_FILE_NAME
        );
        await createDirectoryAndFile(loggerPath, transformePath);
        await setLogFilePath(transformePath);

        normalizeLinkFieldsInExport(importDataPath);

        const sourceDirArg =
          importDataPath.includes(' ') ? `"${importDataPath}"` : importDataPath;
        const backupDirArg = backupPath.includes(' ') ? `"${backupPath}"` : backupPath;
        const baseImportArgs = [
          '@contentstack/cli',
          'cm:stacks:import',
          '-k',
          stack_uid,
          '-d',
          sourceDirArg,
          '--backup-dir',
          backupDirArg,
          '--yes',
        ];

        try {
          await runCommand('npx', baseImportArgs, transformePath);
        } catch (importError: any) {
          const errorText = `${importError?.message || importError}`.toLowerCase();
          const shouldRetryWithoutComposableStudio =
            errorText.includes('module_not_found') ||
            errorText.includes('composable-studio');

          if (!shouldRetryWithoutComposableStudio) {
            throw importError;
          }

          const fallbackModules = readImportModulesFromExport(importDataPath);
          if (!fallbackModules?.length) {
            throw importError;
          }

          if (transformePath) {
            fs.appendFileSync(
              transformePath,
              JSON.stringify({
                level: 'warn',
                message:
                  'Import failed on a CLI module (likely composable-studio). Retrying with supported modules only.',
                timestamp: new Date().toISOString(),
              }) + '\n'
            );
          }

          for (const moduleName of fallbackModules) {
            await runCommand(
              'npx',
              [...baseImportArgs, '-m', moduleName, '--skip-existing'],
              transformePath
            );
          }
        }

        if (isTest) {
          const directLogEntry = {
            level: 'info',
            message: 'Test Migration Process Completed',
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(
            transformePath,
            JSON.stringify(directLogEntry) + '\n'
          );
          if (loggerPath && loggerPath !== transformePath) {
            fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + '\n');
          }
        } else {
          const directLogEntry = {
            level: 'info',
            message: 'Migration Process Completed',
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(
            transformePath,
            JSON.stringify(directLogEntry) + '\n'
          );
          if (loggerPath && loggerPath !== transformePath) {
            fs.appendFileSync(loggerPath, JSON.stringify(directLogEntry) + '\n');
          }
          // Delta migration: persist UID mapping for the current iteration so
          // a subsequent delta run can skip already-migrated entities.
          await ProjectModelLowdb.read();
          const projectData = ProjectModelLowdb.chain
            .get('projects')
            .find({ id: projectId })
            .value();
          const iteration = projectData?.iteration || 1;
          await writeUidMapping(backupPath, projectId, iteration);
        }

        await ProjectModelLowdb.read();
        const projectIndex = ProjectModelLowdb.chain
          .get('projects')
          .findIndex({ id: projectId })
          .value();

        if (projectIndex > -1 && isTest) {
          const proj = ProjectModelLowdb.data.projects[projectIndex];
          if (!proj.test_stacks) {
            proj.test_stacks = [];
          }
          proj.test_stacks.forEach((item: TestStack) => {
            if (item.stackUid === stack_uid) {
              item.isMigrated = true;
            }
          });
          await ProjectModelLowdb.write();
        }

        if (projectIndex > -1 && !isTest) {
          ProjectModelLowdb.data.projects[projectIndex].isMigrationCompleted =
            true;
          ProjectModelLowdb.data.projects[projectIndex].isMigrationStarted =
            false;
          ProjectModelLowdb.data.projects[projectIndex].current_step =
            STEPPER_STEPS.MIGRATION;
          ProjectModelLowdb.data.projects[projectIndex].status = 5;
          await ProjectModelLowdb.write();
        }

        // Successful import — remove our backup folder. On failure the catch
        // branch above re-throws, so we intentionally leave the backup on disk
        // for post-mortem inspection.
        try {
          if (fs.existsSync(backupPath)) {
            await fs.promises.rm(backupPath, { recursive: true, force: true });
          }
        } catch (cleanupErr) {
          console.warn(
            `[runCli] Could not remove backup folder ${backupPath}:`,
            cleanupErr
          );
        }
      } finally {
        // no pruned export cleanup needed
      }
    } else {
      console.info('User not found.');
    }
  } catch (error) {
    console.error('🚀 ~ runCli ~ error:', error);
    throw error;
  }
};

export const utilsCli = { runCli };