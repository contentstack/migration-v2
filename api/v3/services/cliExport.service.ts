import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { ExportRun } from "../utils/cliModules.util.js";
import { assertCliAvailable } from "../utils/cliPresence.util.js";
/*
  Step 2 of `docs/plans/cli-v1-to-v2-migration.md`: progress and failure come from the
  CLI's own log file, not from its terminal output. v2 draws progress bars and stops
  printing the per-step lines, so stdout has nothing left to parse — and the log file is
  a better source on v1 too.
*/
import { findSessionDir, readLogSince } from "../utils/cliLogReader.util.js";

/**
 * v3 CLI export boundary — spawns `csdx cm:stacks:export` and streams its real
 * output.
 *
 * Implements `docs/plans/source-export-revamp.md` §5.1, §5.5, Impact 1, Impact 4
 * and Impact 8. This is the ONE place the process boundary lives, so it is the
 * only thing the rest of the export pipeline has to mock.
 *
 * Three decisions worth knowing before changing anything here:
 *
 *   1. **No shell.** v2's `runCli.service.ts` spawns with `{ shell: true }`. The
 *      stack key and branch come from a project record the operator filled in, so
 *      a shell would make a branch named `x; rm -rf ~` a command-injection
 *      vector. An argv array with no shell removes that class of bug outright.
 *   2. **The credential never appears in argv.** It is injected into the CLI's own
 *      config before the spawn (see `cliAuth.util.ts`), so it cannot surface in
 *      the log the operator reads, nor in a process listing.
 *   3. **Runs are strictly sequential and globally serialised.** Concurrent
 *      invocations would race on one shared CLI config store and one data
 *      directory (R-1c).
 */

export interface CliAuth {
  authtoken?: string;
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  userUid?: string;
  organizationUid?: string;
  updatedAt?: string;
}

export interface CliExportInput {
  runs: ExportRun[];
  stackApiKey: string;
  branch?: string;
  dataDir: string;
  region: string;
  auth: CliAuth;
  /**
   * Every line of real CLI output, ANSI already stripped and the CLI's own
   * `[timestamp] LEVEL:` prefix removed. `level` is whatever the CLI declared, or
   * undefined for a line that carried no prefix.
   */
  onLine?: (line: string, stream: "stdout" | "stderr", level?: CliLevel) => void;
  /** Fired only when a run genuinely SUCCEEDS — progress must never outrun work. */
  onRunComplete?: (module: string | undefined, index: number, total: number) => void;
}

/** The levels the CLI actually emits, measured from a real run's `info.log`. */
export type CliLevel = "DEBUG" | "INFO" | "SUCCESS" | "WARN" | "ERROR";

/**
 * The CLI's own closing line, and the only thing that distinguishes a FATAL failure
 * from a partial one.
 *
 * A fatal error aborts the module chain, so this line is never reached. A partial
 * failure — one asset that would not download — is followed by the rest of the work
 * and then this line. Both are logged at ERROR level by `handleAndLogError`, so the
 * ERROR itself says nothing about which happened.
 *
 * Matched loosely on purpose. The CLI emits it twice with different subjects
 * ("The content of branch main …", "The content of the stack <apiKey> …"), and the
 * variable part is the subject, not the phrase. Confirmed present in all four
 * captured v2 runs and in the shipped v1 plugin (`export.js:28`).
 */
const EXPORT_FINISHED = /has been exported successfully/i;

/**
 * How often the CLI's log file is re-read while a run is in flight.
 *
 * Read per call, never captured at module load — a module-level constant freezes the
 * value before any test or runtime override can apply, which has caught us twice.
 */
const logPollMs = (): number => Number(process.env.V3_CLI_LOG_POLL_MS) || 500;

/**
 * Splits a CLI console line into its declared level and its message.
 *
 * Real format, captured from a live run:
 *   `[2026-08-11 18:11:42] SUCCESS: Exported content types!`
 *
 * A line with no such prefix — the CLI's bare "You are not using the most recent
 * CLI release." notice, for instance — keeps its text and reports NO level, rather
 * than being labelled with a guess.
 */
export const parseCliLine = (line: string): { level?: CliLevel; message: string } => {
  const m = line.match(/^\[[^\]]*\]\s*(DEBUG|INFO|SUCCESS|WARN|ERROR)\s*:\s*([\s\S]*)$/);
  if (!m) return { message: line };
  return { level: m[1].toUpperCase() as CliLevel, message: m[2] };
};

export interface CliExportResult {
  ok: boolean;
  /** Which module's run failed, so a chained failure is actionable. */
  failedModule?: string;
  error?: string;
  /**
   * Problems the CLI reported that did NOT stop the export — a single asset that
   * would not download, one entry that failed. The run is a success and the folder
   * is usable, but the operator has to be able to see what is missing from it.
   */
  warnings?: string[];
}

/**
 * Strips ANSI escape sequences.
 *
 * Deliberately broader than v2's `/\[\d+m/g`, which only catches simple
 * colour codes. oclif's spinners emit erase-line (`[2K`), cursor-move (`[1G`)
 * and cursor-visibility (`[?25l`) sequences continuously; leaving those in fills
 * the log view with escape garbage, which defeats the point of showing real CLI
 * output.
 */
export const stripAnsi = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/\[[0-9;?]*[ -/]*[@-~]/g, "");

/** The CLI binary, resolved from this package's own node_modules. */
const CLI_BIN = "npx";
const CLI_ARGS_PREFIX = ["--no-install", "csdx"];

/**
 * A process-wide lock. Not a security control — a correctness one. The CLI keeps
 * its auth and region in a single shared config store, so two exports running at
 * once would swap each other's credentials mid-chain and silently produce a
 * wrong-region export instead of a clean error (plan Impact 4, R-1c).
 */
let lock: Promise<void> = Promise.resolve();

const withLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
  const previous = lock;
  let release!: () => void;
  lock = new Promise<void>((r) => (release = r));
  await previous;
  try {
    return await fn();
  } finally {
    // Always released, including on failure: one bad export must not deadlock
    // every later one.
    release();
  }
};

const buildArgs = (input: CliExportInput, run: ExportRun): string[] => {
  const args = [
    ...CLI_ARGS_PREFIX,
    "cm:stacks:export",
    "-k",
    input.stackApiKey,
    "-d",
    input.dataDir,
    // Always present. Without it the CLI exports EVERY branch of the stack,
    // which reads as a hang rather than a misconfiguration.
    "--branch",
    input.branch || "main",
    // Marketplace prompts would otherwise block forever on a non-interactive stdin.
    "-y",
  ];
  /*
    The LONG form deliberately. v1 accepts both `-m` and `--module`; v2 dropped the short
    alias entirely (`docs/plans/cli-v1-to-v2-migration.md` §4.7). Using the long form works
    on both majors, so this can be changed and verified before the version moves.
  */
  if (run.module) args.push("--module", run.module);
  return args;
};

/**
 * One spawn, resolved when the process closes. Never rejects — it reports.
 *
 * ⚠️ The exit code is NOT trusted on its own. Measured against the real CLI:
 *
 *     $ csdx cm:stacks:export -k blt0000000000000000 -d /tmp/x --branch main -y
 *     [2026-08-11 18:11:42] ERROR: No branch found with the given name main
 *     exit=0
 *
 * A hard failure reported on stdout with a ZERO exit status. Believing the exit
 * code would mark that export successful, after which the pipeline stamps
 * `exportedAt` and renames an empty folder into place — and Audit and Content
 * mapping then read it as a valid export. So a declared ERROR line fails the run
 * too. Everything the CLI writes goes to stdout; stderr was empty in every
 * captured run.
 */
/**
 * One CLI invocation. `warnings` carries the problems that did NOT stop it, so the
 * caller can report them without treating the run as failed.
 */
const runOne = (
  input: CliExportInput,
  run: ExportRun
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> =>
  new Promise((resolve) => {
    /*
      A log directory of our own, per run. `CS_CLI_LOG_PATH` is the FIRST branch of
      `getLogPath()` in both v1 and v2's `cli-utilities`, ahead of user config, so this
      makes the location deterministic.

      Chosen over parsing the CLI's "The log has been stored at …" line, which differs
      between the majors: v1 prints the base directory with a trailing period, v2 the
      session directory without one. Set on the CHILD only — putting it in our own env
      would redirect every later export in this server process.
    */
    let logBase: string | undefined;
    try {
      logBase = fs.mkdtempSync(path.join(os.tmpdir(), "v3-cli-log-"));
    } catch {
      // Losing the log directory must not stop the export; the stdout fallback below
      // covers it.
      logBase = undefined;
    }

    const child = spawn(CLI_BIN, buildArgs(input, run), {
      cwd: process.cwd(),
      // No shell — see the header note.
      shell: false,
      env: { ...process.env, ...(logBase ? { CS_CLI_LOG_PATH: logBase } : {}) },
    });

    /*
      Stream chunks respect no line boundary, so a partial line is held over
      until its newline arrives. Without this the log shows truncated fragments,
      and the module-completion lines progress depends on are the long ones most
      likely to be split.
    */
    const makeReader = (stream: "stdout" | "stderr") => {
      let buffered = "";
      const emit = (raw: string) => {
        const line = stripAnsi(raw).trim();
        // Spinner frames reduce to empty strings once stripped; the CLI emits one
        // per animation frame, so keeping them would flood the view with blanks.
        if (!line) return;
        const { level, message } = parseCliLine(line);
        /*
          Only a DECLARED level counts as an error. Matching the substring
          "error" anywhere would abort healthy exports on lines like
          `INFO: The log has been stored at '/logs/error.log'` — turning a safety
          check into an outage.
        */
        if (level === "ERROR") stdoutProblems.push(message);
        if (EXPORT_FINISHED.test(message)) stdoutFinished = true;
        /*
          Held, not emitted. On v1 the same line appears on stdout AND in the log file,
          so emitting both would double every line in the operator's view. These are
          replayed at close only if the log yielded nothing at all.
        */
        heldLines.push({ message, stream, level });
      };
      return {
        push: (chunk: Buffer) => {
          buffered += chunk.toString();
          const parts = buffered.split(/\r?\n/);
          buffered = parts.pop() ?? "";
          for (const part of parts) emit(part);
        },
        flush: () => {
          // The CLI's final summary often has no trailing newline, and it is the
          // line that says whether the export worked.
          if (buffered) emit(buffered);
          buffered = "";
        },
      };
    };

    /*
      Two independent readings of the same run: one from the CLI's log file, one from its
      terminal output. The log is authoritative when it produced anything at all; stdout
      is the fallback for when it did not.

      In each, the FIRST error is what gets reported on a fatal failure — later ones are
      usually consequences of it. All of them are reported as warnings on a partial
      failure, because "two assets are missing" is a different message from "one is".
    */
    const logProblems: string[] = [];
    let logFinished = false;
    /** Set once the log has yielded a single line — from then on it is the source. */
    let logActive = false;

    const stdoutProblems: string[] = [];
    let stdoutFinished = false;
    /** stdout lines held back, replayed only if the log never yields anything. */
    const heldLines: { message: string; stream: "stdout" | "stderr"; level?: CliLevel }[] = [];

    const out = makeReader("stdout");
    const err = makeReader("stderr");

    child.stdout?.on("data", (c: Buffer) => out.push(c));
    child.stderr?.on("data", (c: Buffer) => err.push(c));

    /*
      Tail the CLI's log while the run is in flight. The session directory does not exist
      the instant the child spawns, so it is resolved lazily and then remembered.
    */
    let sessionDir: string | undefined;

    /*
      ⚠️ THREE files, not one. The CLI keeps a SEPARATE logger per level, each writing to
      its own file: error → error.log, warn → warn.log, info and success → info.log. An
      ERROR line therefore NEVER appears in info.log.

      An earlier version of this polled info.log alone. On a realistic failure — a few
      modules succeed, then one throws — that gave: log active, zero errors seen, no
      closing line, and the "errors AND no closing line" rule evaluated false. The run
      resolved as SUCCESS: a failed export, reported complete, stamped and moved into
      place. Confirmed against a real failed v2 export whose info.log was 0 bytes and
      whose error.log held the only record of what went wrong.

      `debug.log` is deliberately NOT read: it repeats everything at ten times the volume
      (3,569 lines against 278 on a real export) and adds nothing we act on.
    */
    const offsets: Record<string, number> = { "info.log": 0, "error.log": 0, "warn.log": 0 };

    const pollLog = (): void => {
      if (!logBase) return;
      if (!sessionDir) sessionDir = findSessionDir(logBase);
      if (!sessionDir) return;

      for (const file of Object.keys(offsets)) {
        const { lines, offset: next } = readLogSince(path.join(sessionDir, file), offsets[file]);
        offsets[file] = next;
        for (const entry of lines) {
          logActive = true;
          if (entry.level === "ERROR") logProblems.push(entry.message);
          // Only ever printed at success level, so only ever in info.log.
          if (EXPORT_FINISHED.test(entry.message)) logFinished = true;
          input.onLine?.(entry.message, "stdout", entry.level);
        }
      }
    };

    const timer = setInterval(pollLog, logPollMs());
    // Never hold the process open on account of the poller.
    timer.unref?.();

    const stopPolling = (): void => {
      clearInterval(timer);
      // One last read: the CLI writes its closing line moments before exiting, so the
      // final poll is the one that decides success.
      pollLog();
    };

    /*
      The log files are redundant once the run ends: every line has already been copied
      into the job's own log, which is what the operator actually reads. A chained export
      makes one directory per module, so keeping them leaks a directory per module per
      export — 527 had accumulated by the time this was noticed.

      Called only AFTER the final poll inside `stopPolling`, never while the run is in
      flight: removing the file mid-run would leave the poller tailing a deleted path and
      progress would stop moving with nothing to show why.
    */
    const cleanupLogs = (): void => {
      if (!logBase) return;
      try {
        fs.rmSync(logBase, { recursive: true, force: true });
      } catch {
        // A log directory we cannot remove is untidy, never a reason to fail an export.
      }
    };

    /** Replays the held stdout lines. Only reached when the log gave us nothing. */
    const replayStdout = (): void => {
      for (const l of heldLines) input.onLine?.(l.message, l.stream, l.level);
    };

    child.on("error", (e: Error) => {
      out.flush();
      err.flush();
      stopPolling();
      if (!logActive) replayStdout();
      cleanupLogs();
      resolve({ ok: false, error: e.message });
    });

    child.on("close", (code: number | null) => {
      out.flush();
      err.flush();
      stopPolling();

      /*
        The log wins when it produced anything; stdout is the fallback for when it did
        not — an ignored variable, an unwritable directory. Losing the log must degrade
        to the previous behaviour, never to blindness: reporting every export successful
        with no progress at all would be the worst possible failure here.
      */
      if (!logActive) replayStdout();
      const problems = logActive ? logProblems : stdoutProblems;
      const sawFinished = logActive ? logFinished : stdoutFinished;

      // A non-zero exit is unambiguous and outranks everything else — the process
      // did not end normally, whatever it managed to log on the way.
      cleanupLogs();

      if (code !== 0) return resolve({ ok: false, error: `CLI exited with code ${code}` });

      /*
        An error with no closing line means the chain aborted: FATAL. The declared
        error is preferred in the message because it says WHAT went wrong, where an
        exit code only says that something did — and the CLI exits 0 either way.
      */
      if (problems.length && !sawFinished) {
        return resolve({ ok: false, error: problems[0] });
      }

      /*
        Errors AND the closing line means the export finished with casualties. This is
        a SUCCESS: the folder is complete apart from the named items, and failing here
        would discard an otherwise usable export over one bad download — which is
        exactly the bug this replaced.
      */
      resolve(problems.length ? { ok: true, warnings: problems } : { ok: true });
    });
  });

/**
 * Runs the planned invocations in order, stopping at the first failure.
 *
 * Stopping matters: continuing past a failed schema export would spend minutes
 * downloading assets into a folder that can never be imported, and would leave a
 * bundle that looks structurally plausible.
 */
export const runCliExport = (input: CliExportInput): Promise<CliExportResult> =>
  withLock(async () => {
    // Before anything else: a missing CLI must say so, not fail as an opaque spawn
    // error minutes into the operator's attempt (Impact 7).
    assertCliAvailable();

    const total = input.runs.length;
    /*
      Warnings accumulate ACROSS runs. Each run is its own process, so a partial
      failure in the assets run and another in the entries run are two separate
      reports — returning only the last one would hide the first.
    */
    const warnings: string[] = [];

    for (let i = 0; i < total; i++) {
      const run = input.runs[i];
      const result = await runOne(input, run);

      if (!result.ok) {
        return { ok: false, failedModule: run.module, error: result.error };
      }
      if (result.warnings?.length) warnings.push(...result.warnings);
      // A run that finished advances progress, even if it finished with casualties —
      // the module really is done and the chain really does move on.
      input.onRunComplete?.(run.module, i, total);
    }

    return warnings.length ? { ok: true, warnings } : { ok: true };
  });
