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
 * @contentstack/cli-cm-import ships extremely conservative defaults
 * (concurrency: 1, rateLimit: 5) intended to be safe for any org's API limits.
 * At real migration volume (e.g. 10k entries x 4 locales = ~40k entry
 * operations) that throughput means a full import needs 12+ hours — and the
 * CLI process exits 0 after whatever it manages to process in one run rather
 * than guaranteeing completion, so a single invocation silently under-imports.
 * A moderate bump cuts wall-clock time substantially while staying well under
 * typical Management API limits (which are usually far higher than these
 * defaults). Written to a temp file and passed via `-c` on every invocation.
 */
export function writeFastImportConfig(backupPath: string): string {
  const configPath = path.join(backupPath, 'cli-import-config.json');
  const config = {
    concurrency: 3,
    rateLimit: 8,
    importConcurrency: 8,
    fetchConcurrency: 8,
    writeConcurrency: 8,
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  return configPath;
}

/**
 * Every (content type, locale) pair present in the source data must have a
 * matching folder under the CLI's own `--backup-dir`/mapper/entries tree —
 * that is how the CLI itself tracks which entries it has actually created or
 * localized. Its absence means the CLI never even attempted that pair, not
 * that it tried and silently failed (confirmed against a real run where
 * fr-fr/es-es were simply missing from the mapper for every bulk content
 * type, while the CLI still exited with code 0 claiming success).
 */
/** Every source entry uid our own connector wrote for this (type, locale). */
function readOurEntryUids(localeDir: string, locale: string): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(localeDir, `${locale}.json`), 'utf8'));
    return new Set(Object.keys(data ?? {}));
  } catch {
    return new Set();
  }
}

/**
 * Every entry uid the CLI itself has actually recorded as mapped for this
 * (type, locale) — the CLI writes one or more `<batch-id>-entries.json` files
 * per folder (confirmed: real runs commonly have 2+, one per batch), each
 * keyed by source uid, so a single file is not enough to know the true total.
 */
function readMappedEntryUids(mapperDir: string): Set<string> {
  const uids = new Set<string>();
  let files: string[] = [];
  try {
    files = fs.readdirSync(mapperDir).filter((f) => f.endsWith('-entries.json'));
  } catch {
    return uids;
  }
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(mapperDir, f), 'utf8'));
      for (const uid of Object.keys(data ?? {})) uids.add(uid);
    } catch {
      // an unreadable/corrupt batch file counts as incomplete, not as a crash here
    }
  }
  return uids;
}

export function findIncompleteLocalePairs(
  sourcePath: string,
  backupPath: string
): Array<{ type: string; locale: string }> {
  const missing: Array<{ type: string; locale: string }> = [];
  const entriesDir = path.join(sourcePath, 'entries');
  if (!fs.existsSync(entriesDir)) return missing;

  for (const type of fs.readdirSync(entriesDir)) {
    const typeDir = path.join(entriesDir, type);
    if (!fs.statSync(typeDir).isDirectory()) continue;
    for (const locale of fs.readdirSync(typeDir)) {
      const localeDir = path.join(typeDir, locale);
      if (!fs.statSync(localeDir).isDirectory()) continue;
      const ourUids = readOurEntryUids(localeDir, locale);
      if (!ourUids.size) continue; // an empty locale folder has nothing to import

      // A directory existing only proves the CLI STARTED this locale, not that
      // it finished — a crash partway (network blip, OOM) leaves a non-empty
      // but incomplete folder that used to read as "done". Compare the actual
      // uid sets instead of just checking the folder exists.
      const mapperDir = path.join(backupPath, 'mapper', 'entries', type, locale);
      const mappedUids = readMappedEntryUids(mapperDir);
      const isComplete = [...ourUids].every((uid) => mappedUids.has(uid));
      if (!isComplete) {
        missing.push({ type, locale });
      }
    }
  }
  return missing;
}

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

    // For stderr handler
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
      const fastConfigPath = writeFastImportConfig(backupPath);
      const importArgs = (moduleOnly?: string) => [
        '@contentstack/cli',
        'cm:stacks:import',
        '-k',
        stack_uid,
        '-d',
        sourcePath.includes(' ') ? `"${sourcePath}"` : sourcePath,
        '--backup-dir',
        backupPath.includes(' ') ? `"${backupPath}"` : backupPath,
        '-c',
        fastConfigPath.includes(' ') ? `"${fastConfigPath}"` : fastConfigPath,
        ...(moduleOnly ? ['-m', moduleOnly] : []),
        '--yes',
      ];

      await runCommand('npx', importArgs(), transformePath);

      // The CLI exits 0 as soon as it stops running, NOT necessarily when every
      // (content type, locale) pair has actually been imported — confirmed on a
      // real 10k-row run where it silently left fr-fr/es-es untouched for every
      // large content type. Re-invoke, scoped to just the entries module (assets/
      // content-types/etc already succeeded), relying on the CLI's own mapper
      // state to skip what's done and continue with what isn't, until nothing is
      // missing or a bounded number of attempts is exhausted.
      const MAX_ENTRY_IMPORT_ATTEMPTS = 6;
      let attempt = 0;
      let incomplete = findIncompleteLocalePairs(sourcePath, backupPath);
      while (incomplete.length && attempt < MAX_ENTRY_IMPORT_ATTEMPTS) {
        attempt += 1;
        const retryLogEntry = {
          level: 'warn',
          message: `Entries import incomplete after attempt ${attempt}/${MAX_ENTRY_IMPORT_ATTEMPTS}: ${incomplete.length} (content type, locale) pair(s) still missing (e.g. ${incomplete
            .slice(0, 3)
            .map((p) => `${p.type}/${p.locale}`)
            .join(', ')}). Retrying entries import.`,
          timestamp: new Date().toISOString(),
        };
        fs.appendFileSync(transformePath, JSON.stringify(retryLogEntry) + '\n');

        await runCommand('npx', importArgs('entries'), transformePath);
        incomplete = findIncompleteLocalePairs(sourcePath, backupPath);
      }

      if (incomplete.length) {
        const failureLogEntry = {
          level: 'error',
          message: `Entries import still incomplete after ${MAX_ENTRY_IMPORT_ATTEMPTS} attempts: ${incomplete.length} (content type, locale) pair(s) never imported (e.g. ${incomplete
            .slice(0, 5)
            .map((p) => `${p.type}/${p.locale}`)
            .join(', ')}). Migration is NOT fully complete.`,
          timestamp: new Date().toISOString(),
        };
        fs.appendFileSync(transformePath, JSON.stringify(failureLogEntry) + '\n');
        throw new Error(failureLogEntry.message);
      }

      // After the import command completes

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

      // Keep the project status update code:
      // ... rest of the code ...

      // Add debug logs to track project index and test flag

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
        // Record every locale that just successfully migrated so the next delta restart can
        // tell which locales need a full pass vs delta. Set-union with prior value.
        const proj: any = ProjectModelLowdb.data.projects[projectIndex];
        const ranLocales = Array.from(
          new Set([
            ...Object.keys(proj?.master_locale ?? {}),
            ...Object.keys(proj?.locales ?? {}),
          ]),
        );
        const existing: string[] = Array.isArray(proj?.migrated_locales)
          ? proj.migrated_locales
          : [];
        proj.migrated_locales = Array.from(new Set([...existing, ...ranLocales]));
        await ProjectModelLowdb.write();
      }
    } else {
      console.info('User not found.');
    }
  } catch (error: any) {
    console.error('🚀 ~ runCli ~ error:', error);
    // Previously swallowed here with no rethrow, so the caller always saw a
    // resolved promise regardless of whether the Contentstack import (or the
    // incomplete-entries retry loop above) actually completed — a real
    // migration could fail outright (bad token, network drop, org quota, or
    // entries still incomplete after every retry) and still be treated as a
    // success by migration.service.ts. Write a loud, UI-visible entry into
    // the SAME execution log the rest of this function already writes to,
    // then rethrow so the caller can react instead of the failure vanishing
    // into the server's own stdout.
    try {
      const failureLogEntry = {
        level: 'error',
        message: `Migration import failed: ${error?.message ?? error}`,
        timestamp: new Date().toISOString(),
      };
      fs.appendFileSync(transformePath, JSON.stringify(failureLogEntry) + '\n');
    } catch { /* best effort — do not mask the original error with a logging failure */ }
    throw error;
  }
};

export const utilsCli = { runCli };