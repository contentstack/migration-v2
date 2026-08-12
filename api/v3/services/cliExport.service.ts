import { spawn } from "child_process";

import { ExportRun } from "../utils/cliModules.util.js";
import { assertCliAvailable } from "../utils/cliPresence.util.js";

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
  if (run.module) args.push("-m", run.module);
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
const runOne = (
  input: CliExportInput,
  run: ExportRun
): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => {
    const child = spawn(CLI_BIN, buildArgs(input, run), {
      cwd: process.cwd(),
      // No shell — see the header note.
      shell: false,
      env: { ...process.env },
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
        if (level === "ERROR" && !firstError) firstError = message;
        input.onLine?.(message, stream, level);
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

    // The first declared ERROR is what gets reported: later ones are usually
    // consequences of it, and the first is the actionable cause.
    let firstError: string | undefined;

    const out = makeReader("stdout");
    const err = makeReader("stderr");

    child.stdout?.on("data", (c: Buffer) => out.push(c));
    child.stderr?.on("data", (c: Buffer) => err.push(c));

    child.on("error", (e: Error) => {
      out.flush();
      err.flush();
      resolve({ ok: false, error: e.message });
    });

    child.on("close", (code: number | null) => {
      out.flush();
      err.flush();
      // Either signal fails the run. The declared error is preferred in the
      // message because it says WHAT went wrong, where an exit code only says that
      // something did.
      if (firstError) return resolve({ ok: false, error: firstError });
      resolve(code === 0 ? { ok: true } : { ok: false, error: `CLI exited with code ${code}` });
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

    for (let i = 0; i < total; i++) {
      const run = input.runs[i];
      const result = await runOne(input, run);

      if (!result.ok) {
        return { ok: false, failedModule: run.module, error: result.error };
      }
      // Only a genuine success advances progress.
      input.onRunComplete?.(run.module, i, total);
    }

    return { ok: true };
  });
