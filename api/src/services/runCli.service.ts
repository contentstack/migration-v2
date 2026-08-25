/* eslint-disable */

import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { v4 } from 'uuid';
import { copyDirectory, createDirectoryAndFile } from '../utils/index.js';
import { CS_REGIONS, MIGRATION_DATA_CONFIG, DATABASE_FILES, getStepperSteps, CMS } from '../constants/index.js';
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
import { writeReconciliationWorkbook } from '../utils/reconciliation-xlsx.utils.js';

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

/** Sleeps for the given duration; used as a fixed backoff between entry-import retries. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes CLI commands and provides real-time output
 * Uses Node's spawn to run commands asynchronously
 *
 * @param timeoutMs - If provided, kills the process and rejects once this much time has
 * passed with no exit, instead of waiting indefinitely. Confirmed against real production
 * logs: `cm:stacks:import` can hang for 15-17 minutes on a degraded connection before it
 * finally reports "Connection failed: Unable to reach the server" — and because the CLI
 * exits 0 regardless (the same known behavior findIncompleteLocalePairs exists to catch),
 * our own retry loop had no way to notice and move on faster. A shorter, forced timeout
 * lets a bounded retry budget actually cover more real attempts instead of a few very
 * long hangs. Only pass this for the entries retry loop — the first, full-module import
 * legitimately takes a long time on its own and isn't the call that's been observed hanging.
 */
export const runCommand = (
  command: string,
  args: string[] = [],
  logFilePath?: string,
  timeoutMs?: number
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const cmdProcess = spawn(command, args, { shell: true });
    let settled = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    if (timeoutMs && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (logFilePath) {
          try {
            const timeoutLogEntry = {
              level: 'error',
              message: `Command timed out after ${timeoutMs}ms with no response (likely a hung connection) — killing it so a retry can start immediately instead of waiting out the hang.`,
              timestamp: new Date().toISOString(),
            };
            fs.appendFileSync(logFilePath, JSON.stringify(timeoutLogEntry) + '\n');
          } catch (err) {
            console.error('Error writing timeout event to log file:', err);
          }
        }
        cmdProcess.kill('SIGTERM');
        // Fire-and-forget escalation if SIGTERM alone doesn't stop it — does not gate
        // the rejection below, so the retry loop is never held up waiting for this.
        setTimeout(() => {
          try {
            cmdProcess.kill('SIGKILL');
          } catch {
            /* already exited */
          }
        }, 5000);
        reject(new Error(`Command timed out after ${timeoutMs}ms and was killed`));
      }, timeoutMs);
    }

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
      // The timeout path above already settled (rejected) this promise and killed the
      // process — its close event still fires afterward and must be a no-op here,
      // otherwise this would try to resolve/reject an already-settled promise with a
      // misleading "exit code" message that hides the real timeout cause.
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
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
 * Fires live reconciliation against the just-completed migration's destination stack, in
 * the background — the caller does not await this, so a slow live export/diff never delays
 * runCli's own return. SAP SmartEdit only: reconcile-live.ts's comparison logic parses the
 * source ImpEx, which is specific to that connector.
 *
 * Reconciliation existed only as `/reconcile`, invoked by hand — nothing forced it to run,
 * so a genuine silent import bug (a reference field's target misconfigured, dropping every
 * value written to it) could sit undetected for an entire migration unless someone thought
 * to check. Firing this automatically means every SAP SmartEdit migration gets checked, not
 * just the ones someone remembered to.
 *
 * Never throws — a reconciliation problem (or a bug in this function itself) must not be
 * mistaken for the migration itself having failed; it is recorded on the project's own
 * `reconciliation` field and logged instead.
 */
export async function triggerPostMigrationReconciliation(
  projectId: string,
  stackId: string,
  sourceFilePath: string,
  executionLogPath: string,
  iteration: number = 1
): Promise<void> {
  const log = (level: string, message: string) => {
    try {
      fs.appendFileSync(executionLogPath, JSON.stringify({ level, message, timestamp: new Date().toISOString() }) + '\n');
    } catch {
      /* best effort — a logging failure here must not derail reconciliation itself */
    }
  };

  const startedAt = new Date().toISOString();
  try {
    await ProjectModelLowdb.read();
    const idx = ProjectModelLowdb.chain.get('projects').findIndex({ id: projectId }).value();
    if (idx > -1) {
      ProjectModelLowdb.data.projects[idx].reconciliation = { status: 'running', startedAt };
      await ProjectModelLowdb.write();
    }
  } catch (err: any) {
    log('warn', `Could not record reconciliation start on the project record: ${err?.message ?? err}`);
  }

  log('info', `Starting automatic post-migration reconciliation against live stack ${stackId} ...`);

  const jsonReportPath = path.join(path.dirname(executionLogPath), `live-reconciliation-${stackId}-${Date.now()}.json`);
  // reconcile-live.ts exports the ENTIRE live stack over the network — the same class of
  // hang cm:stacks:import can hit (documented elsewhere in this file as 15-17 minutes
  // before it self-reports failure, or indefinitely with no such report). Without a bound
  // here, a hung export leaves this call's own promise never settling, which leaves the
  // 'running' status already written to the project record above stuck there permanently —
  // there is no watchdog anywhere else that would ever notice or recover it. 20 minutes is
  // generous enough for a legitimately large stack export while still guaranteeing this
  // eventually times out and falls through to the "no readable report" failure path below.
  const RECONCILIATION_TIMEOUT_MS = 20 * 60 * 1000;
  try {
    await runCommand(
      'npx',
      [
        'tsx',
        'scripts/reconcile-live.ts',
        sourceFilePath.includes(' ') ? `"${sourceFilePath}"` : sourceFilePath,
        stackId,
        '--json',
        jsonReportPath.includes(' ') ? `"${jsonReportPath}"` : jsonReportPath,
        // We already know exactly which project/iteration this is — skip reconcile-live's
        // own search-by-stack-id (resolveProjectForStack), which can match the WRONG
        // project when more than one record's destination/test stack id references the
        // same stack (common in a dev/test environment with reused stacks).
        '--project-id',
        projectId,
        '--iteration',
        String(iteration),
      ],
      undefined,
      RECONCILIATION_TIMEOUT_MS
    );
  } catch {
    // reconcile-live.ts exits non-zero both when it genuinely cannot run (bad source path,
    // no stored credentials, export failure) AND when it runs fine but finds critical/error
    // findings — a real, useful result, not a crash. The report file on disk, not the exit
    // code, is what tells those two cases apart below, so a rejection here is not itself an
    // error worth logging twice.
  }

  const completedAt = new Date().toISOString();
  let parsedReport: any = null;
  try {
    parsedReport = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
  } catch {
    parsedReport = null;
  }

  // The JSON reconcile() itself produces is a machine-readable intermediate, not something
  // to hand a customer or manager — build the same 3-sheet workbook a manually-run
  // /reconcile has always produced, so the AUTOMATIC check hands back a real deliverable.
  // Best-effort: if this fails for any reason, fall back to the JSON rather than losing
  // the whole reconciliation result over a report-formatting problem.
  let reportPath = jsonReportPath;
  if (parsedReport?.summary) {
    const reconcileFilesDir = path.join(process.cwd(), MIGRATION_DATA_CONFIG.RECONCILE_FILES_DIR);
    const xlsxReportPath = path.join(reconcileFilesDir, `${stackId}.reconcile.xlsx`);
    try {
      fs.mkdirSync(reconcileFilesDir, { recursive: true });
      await writeReconciliationWorkbook(parsedReport, { stackId, sourcePath: sourceFilePath }, xlsxReportPath);
      reportPath = xlsxReportPath;
    } catch (err: any) {
      log('warn', `Could not generate the Excel reconciliation report (falling back to JSON): ${err?.message ?? err}`);
    }
  }

  try {
    await ProjectModelLowdb.read();
    const idx = ProjectModelLowdb.chain.get('projects').findIndex({ id: projectId }).value();
    if (idx === -1) return;

    if (parsedReport?.summary) {
      const { critical = 0, error = 0, warning = 0 } = parsedReport.summary;
      ProjectModelLowdb.data.projects[idx].reconciliation = {
        status: 'completed',
        startedAt,
        completedAt,
        summary: { critical, error, warning },
        reportPath,
      };
      log(
        critical || error ? 'error' : 'info',
        `Automatic post-migration reconciliation finished: ${critical} critical, ${error} error, ${warning} warning finding(s). Report: ${reportPath}`
      );
    } else {
      ProjectModelLowdb.data.projects[idx].reconciliation = {
        status: 'failed',
        startedAt,
        completedAt,
        error: 'Reconciliation did not produce a readable report — see server logs for the underlying error.',
      };
      log('error', `Automatic post-migration reconciliation failed to complete for stack ${stackId} — no readable report was produced.`);
    }
    await ProjectModelLowdb.write();
  } catch (err: any) {
    log('warn', `Could not record reconciliation result on the project record: ${err?.message ?? err}`);
  }
}

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
      //
      // MAX_ENTRY_IMPORT_ATTEMPTS was 6, and a real overnight run still failed with
      // 16 (content type, locale) pairs never imported — not because 6 retries of
      // genuine work weren't enough, but because `cm:stacks:import` can hang for
      // 15-17 minutes on a degraded connection before it self-reports "Connection
      // failed", and runCommand had no way to notice sooner. Two changes together:
      // a bounded per-attempt timeout so a hung attempt fails fast instead of
      // eating that whole window, and a higher attempt ceiling now that most
      // attempts are cheap (a hang-free retry is fast; a hung one no longer costs
      // 15+ minutes). A short fixed backoff avoids immediately re-hitting a
      // connection that just failed.
      const MAX_ENTRY_IMPORT_ATTEMPTS = 15;
      const ENTRY_IMPORT_ATTEMPT_TIMEOUT_MS = 6 * 60 * 1000;
      const ENTRY_IMPORT_RETRY_BACKOFF_MS = 10 * 1000;
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

        await sleep(ENTRY_IMPORT_RETRY_BACKOFF_MS);
        try {
          await runCommand('npx', importArgs('entries'), transformePath, ENTRY_IMPORT_ATTEMPT_TIMEOUT_MS);
        } catch (attemptErr: any) {
          // A single attempt failing (including our own timeout-kill) is exactly
          // what this loop exists to absorb — log it and let the next iteration's
          // findIncompleteLocalePairs check decide whether more work remains,
          // instead of letting one bad attempt abort the entire migration here.
          const attemptFailureLog = {
            level: 'warn',
            message: `Entries import attempt ${attempt}/${MAX_ENTRY_IMPORT_ATTEMPTS} failed: ${attemptErr?.message ?? attemptErr}. Will retry if attempts remain.`,
            timestamp: new Date().toISOString(),
          };
          fs.appendFileSync(transformePath, JSON.stringify(attemptFailureLog) + '\n');
        }
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

        // Fire-and-forget: reconciliation is no longer something that only runs if someone
        // remembers to invoke /reconcile by hand. Not awaited — a slow live export/diff must
        // never delay this function's own return, and any failure inside is captured on the
        // project record rather than propagated here.
        if (proj?.legacy_cms?.cms === CMS.SAP_SMARTEDIT && proj?.legacy_cms?.file_path) {
          triggerPostMigrationReconciliation(
            projectId,
            stack_uid,
            proj.legacy_cms.file_path,
            transformePath,
            proj?.iteration || 1
          ).catch((err) => console.error('Post-migration reconciliation trigger crashed unexpectedly:', err));
        }
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