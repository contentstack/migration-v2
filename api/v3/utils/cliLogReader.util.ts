import fs from "fs";
import path from "path";

import type { CliLevel } from "../services/cliExport.service.js";

/**
 * Reads the Contentstack CLI's own log files.
 *
 * Implements `docs/plans/cli-v1-to-v2-migration.md` §4.5 and §5.4 (Step 2).
 *
 * ## Why not stdout
 *
 * We used to parse the CLI's terminal output. CLI v2 draws animated progress bars and
 * suppresses the informational lines for the export command, so there is nothing left
 * on stdout to read — the module announcements progress depends on simply stop
 * appearing.
 *
 * Both majors write structured logs, and those are a better source regardless of
 * version: no ANSI to strip, no dependence on the exact `[timestamp] LEVEL: message`
 * wording, and one field per fact rather than a regex over prose.
 *
 * ## The layout
 *
 * Measured from real logs on both majors — identical in each:
 *
 *     <base>/<YYYY-MM-DD>/cm-stacks-export-<stamp>-<sessionId>/
 *       info.log      one JSON object per line
 *       error.log     0 bytes on a clean run
 *       warn.log
 *       debug.log     the same, far noisier
 *       session.json  includes MachineEnvironment.CLI_VERSION
 *
 * A v1 line carries exactly `{module, level, message, timestamp}`. v2 adds fields
 * (`command`, `apiKey`, `sessionId`, …) but never removes those four, so one reader
 * serves both.
 *
 * ## Finding `<base>`
 *
 * The caller sets `CS_CLI_LOG_PATH` on the spawned process. That environment variable
 * is the FIRST branch of `getLogPath()` in both v1 and v2's `cli-utilities`, ahead of
 * any user config, so pointing it at a directory we own makes the location
 * deterministic. That is deliberately chosen over parsing the CLI's
 * "The log has been stored at …" line, which differs between the majors — v1 prints the
 * base directory with a trailing period, v2 prints the session directory without one.
 */

/** One log line, in the shape the live log view and the progress parser already use. */
export interface CliLogLine {
  level: CliLevel;
  message: string;
  /**
   * The CLI's own module tag. Present for most lines and empty for a few.
   *
   * ⚠️ Do NOT drive progress from this. Measured on a real export it takes 21 distinct
   * values against 17 announcements (the extras are personalize sub-modules), and on the
   * announcement line itself it reports the PREVIOUS module — the line
   * `Exporting module: 'entries'...` is tagged `experiences`. It is a usable label and
   * an unusable signal.
   */
  module?: string;
  /** The CLI's own ISO timestamp, preferred over our receive time. */
  ts?: string;
}

/** Session directories the CLI creates are always named for the command that made them. */
const SESSION_PREFIX = "cm-stacks-export-";

const statOf = (p: string): fs.Stats | undefined => {
  try {
    return fs.statSync(p);
  } catch {
    return undefined;
  }
};

/**
 * The session directory the CLI created under `base`, or undefined if it has not made
 * one yet.
 *
 * Undefined is the normal first state, not an error: this is polled from the moment the
 * child is spawned, and the CLI creates its directory a moment later.
 *
 * When several exist the newest wins. A fresh base per run means there is usually
 * exactly one, but the base is a real directory and a retried run can leave a sibling.
 */
export const findSessionDir = (base: string): string | undefined => {
  let dates: fs.Dirent[];
  try {
    dates = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return undefined;
  }

  let best: { dir: string; mtimeMs: number } | undefined;

  const consider = (dir: string) => {
    const stat = statOf(dir);
    if (!stat) return;
    if (!best || stat.mtimeMs > best.mtimeMs) best = { dir, mtimeMs: stat.mtimeMs };
  };

  for (const date of dates) {
    if (!date.isDirectory()) continue;
    const dateDir = path.join(base, date.name);
    let sessions: fs.Dirent[];
    try {
      sessions = fs.readdirSync(dateDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      // Named-prefix match, so a stray directory alongside the real one is ignored
      // rather than tailed as though it were a log.
      if (session.isDirectory() && session.name.startsWith(SESSION_PREFIX)) {
        consider(path.join(dateDir, session.name));
      }
    }
  }

  return best?.dir;
};

/** The CLI's lowercase levels, mapped onto the ones the log view renders. */
const LEVELS: Record<string, CliLevel> = {
  debug: "DEBUG",
  info: "INFO",
  success: "SUCCESS",
  warn: "WARN",
  error: "ERROR",
};

/**
 * Reads log lines appended since `offset`.
 *
 * Returns the new lines and the offset to pass next time. Reading from an offset rather
 * than re-reading the file is what keeps the live log from re-emitting every line on
 * every poll — a 300-line export would otherwise render thousands of duplicates.
 *
 * ⚠️ A trailing line with no newline is held back, and the offset stops before it. The
 * file is read WHILE the CLI writes to it, so catching a flush mid-line is expected;
 * emitting the fragment would put garbage in the log view and drop the real line.
 */
export const readLogSince = (
  file: string,
  offset: number
): { lines: CliLogLine[]; offset: number } => {
  const stat = statOf(file);
  if (!stat || !stat.isFile()) return { lines: [], offset };

  // A truncated or replaced file (size shrank) restarts from the beginning rather than
  // reading from a stale offset past the new end.
  const from = stat.size < offset ? 0 : offset;
  if (stat.size === from) return { lines: [], offset: from };

  let raw: string;
  try {
    const fd = fs.openSync(file, "r");
    try {
      const length = stat.size - from;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, from);
      raw = buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return { lines: [], offset };
  }

  const lastNewline = raw.lastIndexOf("\n");
  // Nothing complete yet: keep the offset where it was so the partial line is re-read.
  if (lastNewline === -1) return { lines: [], offset: from };

  const complete = raw.slice(0, lastNewline);
  const consumed = from + Buffer.byteLength(complete, "utf8") + 1;

  const lines: CliLogLine[] = [];
  for (const text of complete.split("\n")) {
    if (!text.trim()) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // One corrupt line must not blind the reader to the export's outcome.
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const message = typeof parsed.message === "string" ? parsed.message : "";
    if (!message) continue;
    lines.push({
      // An unrecognised level is still information, so it degrades to INFO rather than
      // becoming undefined or dropping the line.
      level: LEVELS[String(parsed.level).toLowerCase()] ?? "INFO",
      message,
      module: typeof parsed.module === "string" && parsed.module ? parsed.module : undefined,
      ts: typeof parsed.timestamp === "string" ? parsed.timestamp : undefined,
    });
  }

  return { lines, offset: consumed };
};

/**
 * Which CLI produced this export, from the session manifest.
 *
 * Undefined means "not known", which is deliberately distinct from any version string:
 * anything keyed on this has to be able to tell v1 from unknown.
 */
export const readCliVersion = (sessionDir: string): string | undefined => {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(sessionDir, "session.json"), "utf8"));
    const version = parsed?.MachineEnvironment?.CLI_VERSION;
    return typeof version === "string" && version ? version : undefined;
  } catch {
    return undefined;
  }
};
