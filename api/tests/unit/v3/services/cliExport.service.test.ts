import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import nodeFs from "fs";
import nodePath from "path";

/**
 * Source Export Revamp, Phase 1b — the CLI spawn boundary.
 *
 * Backs `docs/plans/source-export-revamp.md` §5.1, §5.5, Impact 1, Impact 4,
 * Impact 8.
 *
 * `child_process.spawn` is the ONE boundary this unit owns, so it is the only
 * thing mocked. Everything else — argument construction, line assembly, ANSI
 * stripping, exit-code handling, chaining, and the serialising mutex — runs for
 * real, because those are the behaviours that decide whether the operator sees a
 * usable log and whether a failed export is detected.
 */
const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));

vi.mock("child_process", () => ({ spawn: mockSpawn }));

/*
  The presence check is mocked so this suite tests the SPAWN, not the developer's
  node_modules — and so the absent case is reachable at all (the CLI is installed
  here, so an unmocked check could only ever pass). Its own probe logic is covered
  in `cliPresence.util.test.ts`.
*/
const { mockAssertCli } = vi.hoisted(() => ({ mockAssertCli: vi.fn() }));
vi.mock("../../../../v3/utils/cliPresence.util.js", () => ({
  assertCliAvailable: mockAssertCli,
}));

import { runCliExport, stripAnsi } from "../../../../v3/services/cliExport.service.js";

/** A fake child process whose streams and exit we drive from the test. */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill() {
    this.killed = true;
  }
}

/** Queues children so a chained run gets one per invocation. */
const queueChildren = (n: number): FakeChild[] => {
  const children = Array.from({ length: n }, () => new FakeChild());
  let i = 0;
  mockSpawn.mockImplementation(() => children[i++]);
  return children;
};

/** Lets the event loop drain so a spawn's promise wiring is in place. */
const tick = () => new Promise((r) => setImmediate(r));

const BASE = {
  stackApiKey: "blt_source_key",
  branch: "main",
  dataDir: "/tmp/export-target",
  region: "NA",
  auth: { authtoken: "SUPER_SECRET_TOKEN", email: "a@b.com" },
};

beforeEach(() => {
  mockSpawn.mockReset();
  mockAssertCli.mockReset(); // default: available
  /*
    `vi.stubEnv` persists across tests unless cleared, and the log-poll interval is
    stubbed down to milliseconds further below. Leaking that into the rest of the file
    would leave other tests polling a hundred times a second.
  */
  vi.unstubAllEnvs();
});

// ───────────────────────── ANSI stripping (Impact 1) ─────────────────────────

describe("v3 CLI export — ANSI stripping", () => {
  it("strips simple colour codes", () => {
    expect(stripAnsi("[32mExported assets[39m")).toBe("Exported assets");
  });

  /*
    Multi-parameter sequences and cursor/erase controls, not just `[<n>m`.
    oclif's spinners emit erase-line and cursor-move constantly, and a regex that
    only handles simple colour codes leaves the log view full of escape garbage —
    which is exactly what the operator asked to be able to read.
  */
  it("strips multi-parameter, cursor and erase sequences", () => {
    expect(stripAnsi("[1;31mbold red[0m")).toBe("bold red");
    expect(stripAnsi("[2K[1Gspinner frame")).toBe("spinner frame");
    expect(stripAnsi("[?25lhidden cursor[?25h")).toBe("hidden cursor");
  });

  it("leaves text with no escape sequences untouched", () => {
    expect(stripAnsi("Exporting module: entries")).toBe("Exporting module: entries");
  });

  /*
    Stripping must not eat ordinary content. A greedy pattern that swallowed
    everything after a `[` would silently blank the most informative lines —
    module names and counts are full of brackets and colons.
  */
  it("does not remove bracketed text that is not an escape sequence", () => {
    expect(stripAnsi("Exported [12] entries (locale: en-us)")).toBe(
      "Exported [12] entries (locale: en-us)"
    );
  });
});

// ───────────────────────── argument construction (§5.1) ─────────────────────────

describe("v3 CLI export — the command it builds", () => {
  it("passes the stack key, data dir, branch and the prompt override", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("cm:stacks:export");
    expect(args).toEqual(expect.arrayContaining(["-k", "blt_source_key"]));
    expect(args).toEqual(expect.arrayContaining(["-d", "/tmp/export-target"]));
    expect(args).toEqual(expect.arrayContaining(["--branch", "main"]));
    expect(args).toContain("-y");

    child.emit("close", 0);
    await done;
  });

  /*
    `--branch` must always be present. Omitting it makes the CLI export EVERY
    branch of the stack — several branch folders and far more data than the
    operator asked for, which reads as a hang rather than a bug.
  */
  it("never omits the branch flag", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, branch: undefined, runs: [{ module: undefined }] });
    await tick();

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain("--branch");

    child.emit("close", 0);
    await done;
  });

  it("passes no module flag for a whole-stack run", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();

    expect(mockSpawn.mock.calls[0][1]).not.toContain("--module");

    child.emit("close", 0);
    await done;
  });

  it("passes the module flag for a targeted run", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: "entries" }] });
    await tick();

    expect(mockSpawn.mock.calls[0][1]).toEqual(expect.arrayContaining(["--module", "entries"]));

    child.emit("close", 0);
    await done;
  });

  /*
    Spawned WITHOUT a shell, unlike v2's `runCli.service.ts` which passes
    `{ shell: true }`. The stack key and branch originate from a project record
    the operator populated, so a shell would make a branch named `x; rm -rf ~` a
    command-injection vector. Passing an argv array with no shell removes the
    class of bug entirely.
  */
  it("spawns without a shell, so arguments can never be interpreted as commands", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({
      ...BASE,
      branch: "main; echo pwned",
      runs: [{ module: undefined }],
    });
    await tick();

    const [, args, opts] = mockSpawn.mock.calls[0];
    expect(opts?.shell).not.toBe(true);
    // The dangerous value travels as one opaque argv entry, never concatenated.
    expect(args).toContain("main; echo pwned");

    child.emit("close", 0);
    await done;
  });
});

// ───────────────────────── log streaming (Impact 1) ─────────────────────────

describe("v3 CLI export — streaming the real CLI output", () => {
  it("reports each stdout line as the CLI emits it", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("Exporting module: locales\nExported locales\n"));
    child.emit("close", 0);
    await done;

    expect(lines).toEqual(["Exporting module: locales", "Exported locales"]);
  });

  /*
    A line split across two chunks must be reported ONCE, whole. Stream chunks
    respect no line boundary, so the naive "split each chunk on \n" produces
    truncated fragments — and the module-completion lines the progress bar depends
    on are exactly the long ones most likely to be split.
  */
  it("reassembles a line split across two chunks rather than emitting fragments", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("Exporting mod"));
    child.stdout.emit("data", Buffer.from("ule: entries\n"));
    child.emit("close", 0);
    await done;

    expect(lines).toEqual(["Exporting module: entries"]);
  });

  it("reports stderr lines too, tagged as stderr", async () => {
    const [child] = queueChildren(1);
    const seen: { line: string; stream: string }[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line, stream) => seen.push({ line, stream }),
    });
    await tick();

    child.stderr.emit("data", Buffer.from("warning: rate limited\n"));
    child.emit("close", 0);
    await done;

    expect(seen).toEqual([{ line: "warning: rate limited", stream: "stderr" }]);
  });

  /*
    A trailing fragment with no newline must still be reported when the process
    exits. The CLI's final summary line often lacks a trailing newline, and it is
    the one line that says whether the export succeeded.
  */
  it("flushes a trailing line that never received its newline", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("The content of the stack has been exported"));
    child.emit("close", 0);
    await done;

    expect(lines).toEqual(["The content of the stack has been exported"]);
  });

  it("strips ANSI from streamed lines", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("[32mExported assets[39m\n"));
    child.emit("close", 0);
    await done;

    expect(lines).toEqual(["Exported assets"]);
  });

  /*
    Blank lines are dropped. Spinner frames and erase sequences reduce to empty
    strings after stripping, so keeping them would flood the log view with blank
    rows — the CLI emits one per animation frame.
  */
  it("drops lines that are empty once stripped", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("[2K[1G\n\n   \nreal line\n"));
    child.emit("close", 0);
    await done;

    expect(lines).toEqual(["real line"]);
  });

  /*
    A credential must never reach the log callback. The token is injected into the
    CLI's config, never passed as an argument, so it cannot appear in output the
    CLI echoes back — asserted explicitly because a future change that passed it
    on the command line would leak it into the log the operator sees.
  */
  it("never emits the auth token through the log callback", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: undefined }],
      onLine: (line) => lines.push(line),
    });
    await tick();

    child.stdout.emit("data", Buffer.from("Authenticating…\n"));
    child.emit("close", 0);
    await done;

    expect(lines.join("\n")).not.toContain("SUPER_SECRET_TOKEN");
    expect(JSON.stringify(mockSpawn.mock.calls[0][1])).not.toContain("SUPER_SECRET_TOKEN");
  });
});

// ───────────────────────── exit codes (Impact 8) ─────────────────────────

describe("v3 CLI export — success and failure", () => {
  it("resolves successfully on a zero exit code", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();
    child.emit("close", 0);

    await expect(done).resolves.toMatchObject({ ok: true });
  });

  /*
    A non-zero exit must FAIL the job. The pre-CLI exporter logged a bundle-write
    failure and carried on, because the in-memory graph was still considered
    valid. With the CLI the folder IS the product, so a partial folder reported as
    success would be read as a complete export by Audit and Content mapping.
  */
  it("fails on a non-zero exit code rather than reporting success", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();
    child.emit("close", 1);

    await expect(done).resolves.toMatchObject({ ok: false });
  });

  it("fails when the process cannot be spawned at all", async () => {
    const [child] = queueChildren(1);
    const done = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();
    child.emit("error", new Error("ENOENT"));

    await expect(done).resolves.toMatchObject({ ok: false });
  });

  /*
    The failure must name the module that failed. With up to eight chained runs,
    "the export failed" is not actionable; "the assets module failed" tells the
    operator whether their schema made it.
  */
  it("reports which module failed", async () => {
    const children = queueChildren(2);
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }, { module: "assets" }],
    });
    await tick();
    children[0].emit("close", 0);
    await tick();
    children[1].emit("close", 1);

    await expect(done).resolves.toMatchObject({ ok: false, failedModule: "assets" });
  });
});

// ───────────────────────── chaining (§5.5) ─────────────────────────

describe("v3 CLI export — chaining runs", () => {
  it("runs each planned module in order", async () => {
    const children = queueChildren(3);
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }, { module: "global-fields" }, { module: "assets" }],
    });
    await tick();
    children[0].emit("close", 0);
    await tick();
    children[1].emit("close", 0);
    await tick();
    children[2].emit("close", 0);
    await done;

    const modules = mockSpawn.mock.calls.map((c) => {
      const args = c[1] as string[];
      return args[args.indexOf("--module") + 1];
    });
    expect(modules).toEqual(["entries", "global-fields", "assets"]);
  });

  /*
    Sequential, never parallel. Concurrent invocations share one CLI config store
    and one data directory, so running them together would race on both — and
    with `assets` last, a parallel chain would start the expensive download before
    the cheap modules had a chance to fail.
  */
  it("waits for each run to finish before starting the next", async () => {
    const children = queueChildren(2);
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }, { module: "assets" }],
    });
    await tick();

    expect(mockSpawn).toHaveBeenCalledTimes(1);

    children[0].emit("close", 0);
    await tick();
    expect(mockSpawn).toHaveBeenCalledTimes(2);

    children[1].emit("close", 0);
    await done;
  });

  /*
    A failed run stops the chain. Continuing would spend minutes downloading
    assets into a folder whose schema export already failed, and would leave a
    bundle that looks structurally plausible.
  */
  it("stops the chain at the first failure instead of continuing", async () => {
    const children = queueChildren(2);
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }, { module: "assets" }],
    });
    await tick();
    children[0].emit("close", 1);

    await done;
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it("reports each completed run so progress can advance on real work", async () => {
    const children = queueChildren(2);
    const completed: { module?: string; index: number; total: number }[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }, { module: "assets" }],
      onRunComplete: (module, index, total) => completed.push({ module, index, total }),
    });
    await tick();
    children[0].emit("close", 0);
    await tick();
    children[1].emit("close", 0);
    await done;

    expect(completed).toEqual([
      { module: "entries", index: 0, total: 2 },
      { module: "assets", index: 1, total: 2 },
    ]);
  });

  /*
    A failed run must NOT be reported as completed. Progress derived from
    completions would otherwise advance past work that never happened — the
    fabricated-progress failure the plan rules out.
  */
  it("does not report a failed run as completed", async () => {
    const children = queueChildren(1);
    const completed: unknown[] = [];
    const done = runCliExport({
      ...BASE,
      runs: [{ module: "entries" }],
      onRunComplete: (m, i, t) => completed.push({ m, i, t }),
    });
    await tick();
    children[0].emit("close", 1);
    await done;

    expect(completed).toEqual([]);
  });
});

// ───────────────────────── the mutex (Impact 4 / R-1c) ─────────────────────────

describe("v3 CLI export — serialised invocations", () => {
  it("does not start a second export while one is running", async () => {
    const children = queueChildren(2);

    const first = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    const second = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();

    // Only the first has spawned; the second is queued behind the mutex.
    expect(mockSpawn).toHaveBeenCalledTimes(1);

    children[0].emit("close", 0);
    await first;
    await tick();

    expect(mockSpawn).toHaveBeenCalledTimes(2);
    children[1].emit("close", 0);
    await second;
  });

  /*
    The mutex must be released even when the export fails, or one bad export
    deadlocks every later one — a far worse outcome than the race it guards
    against.
  */
  it("releases the lock after a failed export so the next one can run", async () => {
    const children = queueChildren(2);

    const first = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();
    children[0].emit("close", 1);
    await first;

    const second = runCliExport({ ...BASE, runs: [{ module: undefined }] });
    await tick();
    expect(mockSpawn).toHaveBeenCalledTimes(2);

    children[1].emit("close", 0);
    await expect(second).resolves.toMatchObject({ ok: true });
  });
});

/*
  ───────────────── Failure detection that does NOT trust the exit code ─────────

  MEASURED, not assumed. Running the real CLI against a nonexistent branch:

      $ csdx cm:stacks:export -k blt0000000000000000 -d /tmp/x --branch main -y
      [2026-08-11 18:11:42] ERROR: No branch found with the given name main
      [2026-08-11 18:11:42] INFO: The log has been stored at '…'
      exit=0

  It reports a hard failure on stdout and **exits 0**. Trusting the exit code alone
  therefore means a failed export is reported as SUCCESS — and because the rest of
  the pipeline then stamps `exportedAt` and renames the folder into place, the
  operator gets a "successful" export containing nothing, which Audit and Content
  mapping happily read as valid. That is strictly worse than a crash.

  Everything the CLI writes goes to stdout; `stderr` and `error.log` were both
  empty in the captured runs, so the ERROR line in the stream is the only signal
  available.
*/
describe("v3 CLI export — failure detection independent of the exit code", () => {
  it("fails a run whose output contains an ERROR line even when the process exits 0", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "content-types" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from("[2026-08-11 18:11:42] ERROR: No branch found with the given name main\n")
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.failedModule).toBe("content-types");
    expect(result.error).toContain("No branch found");
  });

  // Negative — a clean run must still be a success. A check that failed everything
  // would be as useless as one that failed nothing.
  it("succeeds when the output holds no ERROR line and the process exits 0", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "content-types" }] });
    await tick();

    child.stdout.emit("data", Buffer.from("[2026-08-11 18:11:42] SUCCESS: Exported content types!\n"));
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
  });

  /*
    The word "error" inside ordinary prose must NOT fail a run. The CLI logs paths
    and messages that can legitimately contain it, and a substring match would
    abort healthy exports — turning a safety check into an outage.
  */
  it("does not fail a run merely because a line mentions the word error", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from("[2026-08-11 18:11:42] INFO: The log has been stored at '/logs/error.log'.\n")
    );
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
  });

  // A non-zero exit still fails, regardless of what was printed — the exit code is
  // now one of two signals rather than the only one.
  it("still fails on a non-zero exit even when no ERROR line was printed", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit("data", Buffer.from("[2026-08-11 18:11:42] INFO: working\n"));
    child.emit("close", 1);

    expect((await promise).ok).toBe(false);
  });

  /*
    A failed run must stop the chain. Continuing would spend minutes downloading
    assets into a folder that can never be imported — and with the exit code lying,
    this is the only thing that stops it.
  */
  it("stops the chain at an ERROR line rather than running later modules", async () => {
    const children = queueChildren(2);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "content-types" }, { module: "assets" }],
    });
    await tick();

    children[0].stdout.emit("data", Buffer.from("[ts] ERROR: schema export failed\n"));
    children[0].emit("close", 0);

    expect((await promise).ok).toBe(false);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });
});

/*
  ───────────────── Level parsing ──────────────────────────────────────────────

  The CLI prefixes every console line with `[timestamp] LEVEL:`, and the levels it
  uses are DEBUG / INFO / SUCCESS / WARN / ERROR — captured from a real run's
  `info.log`, which records `{"level":"success", …}` alongside info and debug.

  Without parsing this, every stdout line arrives as INFO, which makes the log
  view's level filter chips inert and renders a real CLI error in the same colour
  as routine progress.
*/
describe("v3 CLI export — level parsing", () => {
  const levelsFor = async (raw: string): Promise<Array<string | undefined>> => {
    const [child] = queueChildren(1);
    const seen: Array<string | undefined> = [];
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (_line, _stream, level) => seen.push(level),
    });
    await tick();
    child.stdout.emit("data", Buffer.from(raw));
    child.emit("close", 0);
    await promise;
    return seen;
  };

  it("reads the level from the CLI's own line prefix", async () => {
    expect(await levelsFor("[2026-08-11 18:11:42] SUCCESS: Exported assets!\n")).toEqual(["SUCCESS"]);
    expect(await levelsFor("[2026-08-11 18:11:42] DEBUG: Setting up export configuration\n")).toEqual([
      "DEBUG",
    ]);
    expect(await levelsFor("[2026-08-11 18:11:42] WARN: retrying\n")).toEqual(["WARN"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a line with no recognisable prefix must
    report NO level rather than a guessed one. The CLI's own upgrade notice
    ("You are not using the most recent CLI release…") arrives bare, and labelling
    it ERROR or SUCCESS would be inventing information.
  */
  it("reports no level for a line without the CLI's prefix", async () => {
    expect(
      await levelsFor("You are not using the most recent CLI release.\n")
    ).toEqual([undefined]);
  });

  // The message must reach the log WITHOUT the level prefix duplicated in it —
  // the view renders the level as its own column.
  it("passes the message through without its level prefix", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (line) => lines.push(line),
    });
    await tick();
    child.stdout.emit("data", Buffer.from("[2026-08-11 18:11:42] INFO: Exporting module: 'assets'...\n"));
    child.emit("close", 0);
    await promise;

    expect(lines).toEqual(["Exporting module: 'assets'..."]);
  });

  // Negative — an unprefixed line is passed through untouched, not trimmed of
  // something it never had.
  it("passes an unprefixed line through unchanged", async () => {
    const [child] = queueChildren(1);
    const lines: string[] = [];
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (line) => lines.push(line),
    });
    await tick();
    child.stdout.emit("data", Buffer.from("You are not using the most recent CLI release.\n"));
    child.emit("close", 0);
    await promise;

    expect(lines).toEqual(["You are not using the most recent CLI release."]);
  });
});

/*
  ───────────────── CLI availability (Impact 7) ────────────────────────────────

  A missing CLI must be reported before any export work starts. Discovering it from
  a failed spawn means the operator waits, watches a progress bar move, and then
  gets an opaque error — for a condition knowable up front with a one-line fix.
*/
describe("v3 CLI export — availability is checked before spawning", () => {
  it("spawns normally when the CLI is available", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "content-types" }] });
    await tick();
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #6 (dependency failure): an unavailable CLI must abort
    BEFORE the spawn, and the error must reach the caller so the job fails with the
    actionable message rather than an exit code.
  */
  it("never spawns when the CLI is unavailable, and surfaces the reason", async () => {
    mockAssertCli.mockImplementation(() => {
      throw new Error("The Contentstack CLI (csdx) is not available. Run `npm install` …");
    });

    await expect(
      runCliExport({ ...BASE, runs: [{ module: "content-types" }] })
    ).rejects.toThrow(/npm install/);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  /*
    The lock must be released even when the check throws, or the FIRST failed export
    would deadlock every later one — turning a fixable "run npm install" into a
    server that silently never exports again.
  */
  it("releases the lock when the availability check throws", async () => {
    mockAssertCli.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    await expect(runCliExport({ ...BASE, runs: [{ module: "assets" }] })).rejects.toThrow();

    // A second export must still be able to run.
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
  });
});

// ───────── partial vs fatal failure (cli-v1-to-v2-migration.md §4.6, Step 0) ─────────

/*
  The CLI reports two very different things at ERROR level and does not distinguish
  them for us:

    fatal   — a module threw; the chain aborted; later modules never ran
    partial — one item failed (an asset download, one entry); the module carried on

  Both call `handleAndLogError`, so both print ERROR. Treating either as a failed run
  means ONE failed asset out of eighty discards an otherwise complete export — which is
  what this code did before these tests. Verified in the shipped v1 plugin at
  `assets.js:264` / `:291`.

  What separates them in the output: a fatal error aborts before the CLI can print its
  closing success line, whereas a partial failure is followed by continued work and then
  that line. So "an error was logged AND no success line followed" is the fatal signal —
  not "an error was logged".

  Keyed on the CLI's own wording, confirmed present in all four captured v2 runs at
  SUCCESS level:
    "The content of branch main has been exported successfully!"
    "The content of the stack <apiKey> has been exported successfully!"
*/
describe("v3 CLI export — a partial failure is not a failed run", () => {
  it("succeeds when an item failed but the export still finished", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from(
        "[2026-08-24 22:25:14] ERROR: Failed to download asset 'orchid.jpg' (UID: blt5d83e6)\n" +
          "[2026-08-24 22:25:59] SUCCESS: The content of the stack blt_source_key has been exported successfully!\n"
      )
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): an error with NO closing success line is
    fatal and must still fail. Paired so "a partial failure succeeds" cannot be satisfied
    by a check that simply stopped failing anything — which would restore the original
    bug in the opposite direction, silently accepting a truly broken export.
  */
  it("still fails when an error was logged and the export never finished", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from("[2026-08-24 22:25:14] ERROR: No branch found with the given name main\n")
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No branch found");
  });

  it("surfaces the problems from a partial failure rather than dropping them", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from(
        "[2026-08-24 22:25:14] ERROR: Failed to download asset 'a.jpg' (UID: blt1)\n" +
          "[2026-08-24 22:25:15] ERROR: Failed to download asset 'b.jpg' (UID: blt2)\n" +
          "[2026-08-24 22:25:59] SUCCESS: The content of the stack blt_source_key has been exported successfully!\n"
      )
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    // Reported, not swallowed: an operator has to be able to see that two assets are
    // missing from an export we just called successful.
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings?.[0]).toContain("a.jpg");
  });

  /*
    Negative — taxonomy #1 (missing/empty): a clean run reports NO warnings. Without this,
    "problems are surfaced" could be satisfied by code that always reports something,
    which would put a permanent warning on every healthy export.
  */
  it("reports no warnings for a run that had no problems", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from(
        "[2026-08-24 22:25:59] SUCCESS: The content of the stack blt_source_key has been exported successfully!\n"
      )
    );
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.warnings ?? []).toHaveLength(0);
  });

  it("fails on a non-zero exit even when the success line was printed", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    child.stdout.emit(
      "data",
      Buffer.from(
        "[2026-08-24 22:25:59] SUCCESS: The content of the stack blt_source_key has been exported successfully!\n"
      )
    );
    child.emit("close", 1);

    expect((await promise).ok).toBe(false);
  });

  /*
    Negative — taxonomy #3 (boundary): the chain must still STOP at a fatal failure in an
    early run rather than spending minutes exporting assets into a folder that can never
    be imported. Pairs with the partial case above, where the chain must NOT stop.
  */
  it("continues the chain past a partial failure but stops at a fatal one", async () => {
    const children = queueChildren(3);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "content-types" }, { module: "assets" }, { module: "entries" }],
    });
    await tick();

    // Run 1: an item failed, but it finished — the chain should carry on.
    children[0].stdout.emit(
      "data",
      Buffer.from(
        "[t] ERROR: Failed to download asset 'x.jpg' (UID: blt9)\n" +
          "[t] SUCCESS: The content of the stack blt_source_key has been exported successfully!\n"
      )
    );
    children[0].emit("close", 0);
    await tick();

    // Run 2: fatal — no success line. The chain must stop here.
    children[1].stdout.emit("data", Buffer.from("[t] ERROR: Stack not found\n"));
    children[1].emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.failedModule).toBe("assets");
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });
});

// ───── progress and failure from the log file (§4.5, §5.4 — Step 2) ─────

/*
  v2 stops printing the per-step lines we parse off stdout, so progress has to come from
  the CLI's own log file instead. Both majors write it, so this is proven here on v1
  before the version changes underneath it.

  The log location is made deterministic by setting `CS_CLI_LOG_PATH` on the child, which
  is the first branch of `getLogPath()` in both majors' `cli-utilities` — ahead of user
  config. That is chosen over parsing the CLI's "The log has been stored at …" line,
  which differs between the versions (v1 prints the base directory with a trailing
  period, v2 the session directory without one).

  These tests read the path out of the spawn call and then write real log files into it,
  so the wiring under test is the actual one rather than an injected stand-in.
*/
const LOG_POLL_MS = "5";

/** The log directory the service told the child to use. */
const logBaseFromSpawn = (call = 0): string =>
  mockSpawn.mock.calls[call][2].env.CS_CLI_LOG_PATH;

/** Writes JSONL into a CLI-shaped session directory under `base`. */
const writeCliLog = (
  base: string,
  lines: Record<string, unknown>[],
  file = "info.log"
): string => {
  const dir = nodePath.join(base, "2026-08-25", "cm-stacks-export-1-test");
  nodeFs.mkdirSync(dir, { recursive: true });
  nodeFs.appendFileSync(
    nodePath.join(dir, file),
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n"
  );
  return dir;
};

const logLine = (message: string, level = "info", module = "assets") => ({
  module,
  level,
  message,
  timestamp: "2026-08-25T10:00:00.000Z",
});

const FINISHED = "The content of the stack blt_source_key has been exported successfully!";

/** Waits for the service's poller to have run at least once. */
const settle = async (ms = 40) => {
  await new Promise((r) => setTimeout(r, ms));
};

describe("v3 CLI export — progress read from the CLI's log file", () => {
  beforeEach(() => {
    vi.stubEnv("V3_CLI_LOG_POLL_MS", LOG_POLL_MS);
  });

  it("tells the child where to write its logs", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    expect(base).toBeTruthy();
    expect(nodePath.isAbsolute(base)).toBe(true);

    writeCliLog(base, [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);
    await promise;
  });

  /*
    Negative — taxonomy #4 (forbidden state): the variable must be set on the CHILD only.
    Setting it in our own process would redirect the logs of every later export in this
    server, including ones whose own base we then could not predict.
  */
  it("does not set the log path on our own process", async () => {
    const before = process.env.CS_CLI_LOG_PATH;
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    writeCliLog(logBaseFromSpawn(), [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);
    await promise;

    expect(process.env.CS_CLI_LOG_PATH).toBe(before);
  });

  it("emits the log file's lines to the live log as they are written", async () => {
    const seen: { message: string; level?: string }[] = [];
    const [child] = queueChildren(1);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (message, _stream, level) => seen.push({ message, level }),
    });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Exporting module: 'assets'..."), logLine("Exported 80 assets", "success")]);
    await settle();
    writeCliLog(base, [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);
    await promise;

    expect(seen.map((s) => s.message)).toContain("Exporting module: 'assets'...");
    expect(seen.find((s) => s.message === "Exported 80 assets")?.level).toBe("SUCCESS");
  });

  /*
    Negative — taxonomy #7 (conflict): a line must reach the live log ONCE. On v1 the same
    line appears on stdout AND in the log file, so reading both without choosing would
    double every line in the view.
  */
  it("does not emit a line twice when it appears on stdout and in the log", async () => {
    const seen: string[] = [];
    const [child] = queueChildren(1);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (message) => seen.push(message),
    });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Exporting module: 'assets'..."), logLine(FINISHED, "success")]);
    await settle();
    // The same line the CLI also printed, as v1 does.
    child.stdout.emit("data", Buffer.from("[t] INFO: Exporting module: 'assets'...\n"));
    await settle();
    child.emit("close", 0);
    await promise;

    expect(seen.filter((m) => m === "Exporting module: 'assets'...")).toHaveLength(1);
  });

  it("takes success from the log's closing line rather than from stdout", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    // Nothing useful on stdout at all — v2's normal state.
    writeCliLog(logBaseFromSpawn(), [logLine("Exporting module: 'assets'..."), logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
  });

  /*
    Negative — taxonomy #6 (dependency failure): an error in the log with no closing line
    is a fatal failure, exactly as it is on stdout. The signal moved; the rule did not.
  */
  it("fails when the log holds an error and no closing line", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    // error.log, because that is the only file the CLI writes an error to. Putting it in
    // info.log would let a reader that polls info.log alone pass this test.
    writeCliLog(logBaseFromSpawn(), [logLine("No branch found with the given name main", "error")], "error.log");
    await settle();
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No branch found");
  });

  it("reports a partial failure from the log as a success with warnings", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const partialBase = logBaseFromSpawn();
    // Split across the two files exactly as the CLI splits them by level.
    writeCliLog(partialBase, [logLine("Failed to download asset 'a.jpg' (UID: blt1)", "error")], "error.log");
    writeCliLog(partialBase, [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  /*
    Negative — taxonomy #6 (dependency failure): if no log file ever appears — the
    variable ignored, the directory unwritable — we must fall back to stdout rather than
    silently reporting every export as successful with no progress at all. Losing the log
    must degrade to the old behaviour, not to blindness.
  */
  it("falls back to stdout when no log file ever appears", async () => {
    const seen: string[] = [];
    const [child] = queueChildren(1);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (message) => seen.push(message),
    });
    await tick();

    // No log written at all. stdout carries a fatal error, as v1 would print it.
    child.stdout.emit("data", Buffer.from("[t] ERROR: Stack not found\n"));
    await settle();
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Stack not found");
    expect(seen).toContain("Stack not found");
  });
});

// ───── the temporary log directory is cleaned up ─────

/*
  Each run creates its own log directory. Ours are read into the job log as they arrive, so
  the files are redundant once the run ends — and a chained export makes one per module, so
  leaving them behind leaks a directory per module per export forever.

  Found by inspection after a real export: 527 stale directories, most of them from this
  very test file, since `mkdtempSync` runs for real even when `spawn` is mocked.
*/
describe("v3 CLI export — temporary log directory", () => {
  beforeEach(() => {
    vi.stubEnv("V3_CLI_LOG_POLL_MS", "5");
  });

  it("removes its temporary log directory when the run finishes", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    expect(nodeFs.existsSync(base)).toBe(true);

    writeCliLog(base, [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);
    await promise;

    expect(nodeFs.existsSync(base)).toBe(false);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the directory must NOT be removed while the
    run is still going, or the poller loses the file it is tailing halfway through and
    progress stops moving with no error to show why.
  */
  it("keeps the directory while the run is still in flight", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Exporting module: 'assets'...")]);
    await settle();

    expect(nodeFs.existsSync(base)).toBe(true);

    writeCliLog(base, [logLine(FINISHED, "success")]);
    await settle();
    child.emit("close", 0);
    await promise;
  });

  it("cleans up after a failed run too", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Stack not found", "error")], "error.log");
    await settle();
    child.emit("close", 0);

    expect((await promise).ok).toBe(false);
    expect(nodeFs.existsSync(base)).toBe(false);
  });

  /*
    Negative — taxonomy #6 (dependency failure): a run that never spawns at all must not
    leave its directory behind either. The `error` path is the one that skips `close`
    entirely, so it needs its own cleanup rather than sharing the close handler's.
  */
  it("cleans up when the process cannot be spawned", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    child.emit("error", new Error("spawn ENOENT"));

    expect((await promise).ok).toBe(false);
    expect(nodeFs.existsSync(base)).toBe(false);
  });
});

// ───── errors live in error.log, NOT info.log ─────

/*
  ⚠️ The bug this suite exists to prevent, found by running a real failed v2 export.

  The CLI keeps a SEPARATE logger per level, each writing to its own file:
  error → error.log, warn → warn.log, info and success → info.log. An ERROR line
  therefore NEVER appears in info.log.

  The first version of the log reader polled only info.log. On a realistic failure — a
  few modules succeed, then one throws — that produced: log active (info.log had lines),
  zero errors seen (they were in error.log), no closing line... and the rule
  "errors AND no closing line" evaluated false, so the run resolved as SUCCESS. A failed
  export, reported complete, stamped and moved into place.

  The deliberate-failure test missed it because that failure happened during branch
  resolution, before any info line existed — info.log was 0 bytes, the reader fell back
  to stdout, and the fallback caught it. The masking is why this needs its own test.

  Measured from the real failed run:
    info.log    0 bytes
    error.log   807 bytes  {"level":"error","message":"No branch found with the given name main",…}
    exit code   0
*/
describe("v3 CLI export — a fatal error that only reaches error.log", () => {
  beforeEach(() => {
    vi.stubEnv("V3_CLI_LOG_POLL_MS", "5");
  });

  it("fails when info.log has lines but the error is in error.log", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    // A run that got going — this is what makes the log "active".
    writeCliLog(base, [logLine("Exporting module: 'assets'..."), logLine("Exported 12 assets", "success")]);
    // ...and then died. The error goes ONLY here, exactly as the CLI writes it.
    writeCliLog(base, [logLine("No branch found with the given name main", "error")], "error.log");
    await settle();
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No branch found");
  });

  /*
    Negative — taxonomy #4 (forbidden state): a run whose error.log stays EMPTY and which
    printed its closing line is a success. Paired so "read error.log" cannot be satisfied
    by code that treats the file's mere existence as failure — the CLI creates it empty on
    every single run.
  */
  it("succeeds when error.log exists but is empty", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Exporting module: 'assets'..."), logLine(FINISHED, "success")]);
    const dir = nodePath.join(base, "2026-08-25", "cm-stacks-export-1-test");
    nodeFs.writeFileSync(nodePath.join(dir, "error.log"), "");
    await settle();
    child.emit("close", 0);

    expect((await promise).ok).toBe(true);
  });

  it("reports an item failure from error.log as a warning when the run still finished", async () => {
    const [child] = queueChildren(1);
    const promise = runCliExport({ ...BASE, runs: [{ module: "assets" }] });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine("Exporting module: 'assets'..."), logLine(FINISHED, "success")]);
    writeCliLog(base, [logLine("Failed to download asset 'a.jpg' (UID: blt1)", "error")], "error.log");
    await settle();
    child.emit("close", 0);

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(["Failed to download asset 'a.jpg' (UID: blt1)"]);
  });

  /*
    Negative — taxonomy #1 (missing information): warnings reach the operator too. The CLI
    writes them to their own file as well, so a reader that only knew about info.log and
    error.log would drop them silently.
  */
  it("surfaces warn.log lines to the live log", async () => {
    const seen: { message: string; level?: string }[] = [];
    const [child] = queueChildren(1);
    const promise = runCliExport({
      ...BASE,
      runs: [{ module: "assets" }],
      onLine: (message, _s, level) => seen.push({ message, level }),
    });
    await tick();

    const base = logBaseFromSpawn();
    writeCliLog(base, [logLine(FINISHED, "success")]);
    writeCliLog(base, [logLine("Asset 'x.jpg' has no publish details", "warn")], "warn.log");
    await settle();
    child.emit("close", 0);
    await promise;

    expect(seen.find((s) => s.message.includes("no publish details"))?.level).toBe("WARN");
  });
});
