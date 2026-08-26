import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * CLI v1→v2 migration, Step 2 — reading the CLI's own log files instead of its stdout.
 *
 * Backs `docs/plans/cli-v1-to-v2-migration.md` §4.5 and §5.4.
 *
 * Why this exists: v2 draws progress bars and stops printing the per-step lines we
 * parse off stdout, so there is nothing left to read there. Both majors do write
 * structured logs, and those are a better source anyway — no ANSI to strip, no
 * dependence on the exact `[timestamp] LEVEL: message` wording, and one field per
 * fact instead of a regex.
 *
 * Layout and format measured from real logs on this machine, v1 and v2 alike:
 *
 *   <base>/<YYYY-MM-DD>/cm-stacks-export-<stamp>-<sessionId>/
 *     info.log     one JSON object per line
 *     error.log    0 bytes on a clean run
 *     warn.log
 *     debug.log
 *     session.json includes MachineEnvironment.CLI_VERSION
 *
 * A v1 line carries exactly `{module, level, message, timestamp}`; v2 adds more
 * fields but never removes those four. Real filesystem against a temp dir, because
 * the directory layout IS the subject.
 */
import {
  findSessionDir,
  readLogSince,
  readCliVersion,
} from "../../../../v3/utils/cliLogReader.util.js";

const TMP = path.join(os.tmpdir(), `v3-cli-log-reader-${process.pid}`);
let base: string;

/** Writes JSONL exactly as winston's File transport does — one object per line. */
const writeJsonl = (file: string, lines: Record<string, unknown>[]): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
};

const appendJsonl = (file: string, lines: Record<string, unknown>[]): void => {
  fs.appendFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
};

/** A session directory under the CLI's `<base>/<date>/<session>` layout. */
const makeSession = (root: string, date = "2026-08-25", id = "cm-stacks-export-1-abc") => {
  const dir = path.join(root, date, id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const line = (over: Record<string, unknown> = {}) => ({
  module: "assets",
  level: "info",
  message: "Exporting module: 'assets'...",
  timestamp: "2026-08-25T10:00:00.000Z",
  ...over,
});

beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  base = path.join(TMP, `case-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(base, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// ───────────────────────── locating the session directory ─────────────────────────

describe("v3 CLI log reader — locating the session directory", () => {
  it("finds the session directory the CLI created under our base", () => {
    const session = makeSession(base);

    expect(findSessionDir(base)).toBe(session);
  });

  /*
    Negative — taxonomy #1 (missing input): before the CLI has created anything there is
    no session directory, and that must read as "not yet" rather than as an error. The
    reader is polled from the moment the child spawns, so this is the normal first state
    on every single export.
  */
  it("returns undefined before the CLI has created anything", () => {
    expect(findSessionDir(base)).toBeUndefined();
  });

  it("picks the newest session when the base holds more than one", () => {
    const older = makeSession(base, "2026-08-24", "cm-stacks-export-1-old");
    const newer = makeSession(base, "2026-08-25", "cm-stacks-export-2-new");
    // mtime decides, so make the intended winner unambiguously newer.
    fs.utimesSync(older, new Date("2026-08-24T00:00:00Z"), new Date("2026-08-24T00:00:00Z"));
    fs.utimesSync(newer, new Date("2026-08-25T00:00:00Z"), new Date("2026-08-25T00:00:00Z"));

    expect(findSessionDir(base)).toBe(newer);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a stray file or a directory that is not a
    session must not be returned. Each chained module run gets its own base, but the base
    is a real directory on a real disk and may contain anything.
  */
  it("ignores stray files and directories that are not export sessions", () => {
    fs.writeFileSync(path.join(base, "notes.txt"), "hello");
    fs.mkdirSync(path.join(base, "2026-08-25", "something-else"), { recursive: true });

    expect(findSessionDir(base)).toBeUndefined();
  });
});

// ───────────────────────── reading lines incrementally ─────────────────────────

describe("v3 CLI log reader — reading lines incrementally", () => {
  it("reads every line and reports how far it got", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [line(), line({ message: "Exported 80 assets", level: "success" })]);

    const first = readLogSince(file, 0);

    expect(first.lines).toHaveLength(2);
    expect(first.lines[0].message).toBe("Exporting module: 'assets'...");
    expect(first.lines[1].level).toBe("SUCCESS");
    expect(first.offset).toBeGreaterThan(0);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a second read from the returned offset must
    yield NOTHING when the file has not grown. Without this the live log would re-emit
    every line on every poll, so a 300-line export would render thousands of duplicates.
  */
  it("returns no lines when the file has not grown since the last read", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [line(), line()]);

    const first = readLogSince(file, 0);
    const second = readLogSince(file, first.offset);

    expect(second.lines).toEqual([]);
    expect(second.offset).toBe(first.offset);
  });

  it("reads only the newly appended lines on a later poll", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [line({ message: "first" })]);
    const first = readLogSince(file, 0);

    appendJsonl(file, [line({ message: "second" }), line({ message: "third" })]);
    const second = readLogSince(file, first.offset);

    expect(second.lines.map((l) => l.message)).toEqual(["second", "third"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a half-written final line must not be emitted
    as garbage, and must not be skipped either — the file is read WHILE the CLI writes to
    it, so catching a line mid-flush is expected rather than exceptional. The offset must
    stay before the partial line so it is re-read once complete.
  */
  it("holds back a partially written trailing line until it is complete", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [line({ message: "complete" })]);
    // A flush caught mid-write: valid JSON prefix, no newline yet.
    fs.appendFileSync(file, '{"module":"assets","level":"info","message":"par');

    const first = readLogSince(file, 0);
    expect(first.lines.map((l) => l.message)).toEqual(["complete"]);

    // Once the rest arrives, the held-back line is delivered exactly once.
    fs.appendFileSync(file, 'tial","timestamp":"2026-08-25T10:00:01.000Z"}\n');
    const second = readLogSince(file, first.offset);
    expect(second.lines.map((l) => l.message)).toEqual(["partial"]);
  });

  it("reports a missing file as no lines rather than throwing", () => {
    const result = readLogSince(path.join(base, "nope", "info.log"), 0);

    expect(result.lines).toEqual([]);
    expect(result.offset).toBe(0);
  });

  /*
    Negative — taxonomy #2: a line that is not JSON at all must be skipped without
    costing the lines around it. One corrupt line must not blind the reader to the
    export's outcome.
  */
  it("skips an unparseable line and still returns the valid ones", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    fs.writeFileSync(
      file,
      [JSON.stringify(line({ message: "before" })), "{ not json at all", JSON.stringify(line({ message: "after" }))].join("\n") + "\n"
    );

    const result = readLogSince(file, 0);

    expect(result.lines.map((l) => l.message)).toEqual(["before", "after"]);
  });

  it("normalises the CLI's lowercase levels to the levels the log view uses", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [
      line({ level: "info" }),
      line({ level: "success" }),
      line({ level: "warn" }),
      line({ level: "error" }),
      line({ level: "debug" }),
    ]);

    const levels = readLogSince(file, 0).lines.map((l) => l.level);

    expect(levels).toEqual(["INFO", "SUCCESS", "WARN", "ERROR", "DEBUG"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a level the CLI has never emitted must not
    become `undefined` and must not crash the mapping. An unrecognised level is
    information, so it degrades to INFO rather than being dropped.
  */
  it("degrades an unrecognised level to INFO rather than dropping the line", () => {
    const session = makeSession(base);
    const file = path.join(session, "info.log");
    writeJsonl(file, [line({ level: "verbose", message: "kept" })]);

    const result = readLogSince(file, 0);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ level: "INFO", message: "kept" });
  });
});

// ───────────────────────── which CLI produced this ─────────────────────────

describe("v3 CLI log reader — reading the CLI version", () => {
  it("reads the CLI version from the session manifest", () => {
    const session = makeSession(base);
    fs.writeFileSync(
      path.join(session, "session.json"),
      JSON.stringify({ command: "cm:stacks:export", MachineEnvironment: { CLI_VERSION: "1.63.0" } })
    );

    expect(readCliVersion(session)).toBe("1.63.0");
  });

  /*
    Negative — taxonomy #1 (missing input): no manifest means we do not know, and "do not
    know" must not be reported as a version. Anything keyed on this has to be able to tell
    the difference between v1 and unknown.
  */
  it("returns undefined when there is no session manifest", () => {
    const session = makeSession(base);

    expect(readCliVersion(session)).toBeUndefined();
  });
});
