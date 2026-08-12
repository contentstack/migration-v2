import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Source Export Revamp, Phase 2 — progress derived from real CLI output.
 *
 * Backs `docs/plans/source-export-revamp.md` §Phase 2 and R-3.
 *
 * Why this exists: progress previously advanced only when a whole CLI *run*
 * finished. A whole-stack export is ONE run, so the bar jumped 10 → 75 and sat
 * there for the entire export — the longest part of the job showing no movement at
 * all.
 *
 * The signal used here was measured from a real export's `info.log`:
 *
 *   {"level":"info","message":"Exporting module: 'assets'..."}
 *   {"level":"info","message":"Exporting module: 'entries'..."}
 *
 * The CLI announces each module as it starts, in order, for both whole-stack and
 * single-module invocations. That is the only per-module signal it emits that is
 * consistent enough to parse — the completion lines vary per module ("Exported
 * stack settings successfully!", "Batch No. 1 of assets folders is complete"), so
 * parsing them would be guesswork that breaks on a CLI upgrade (R-3).
 */
import {
  CLI_EXPORT_MODULE_TYPES,
  parseModuleAnnouncement,
  createExportProgress,
  PROGRESS_SETUP_PCT,
  PROGRESS_CLI_CEILING_PCT,
} from "../../../../v3/utils/cliProgress.util.js";

// ───────────────────── parsing the announcement ─────────────────────

describe("v3 CLI progress — parsing the module announcement", () => {
  it("reads the module name from the CLI's real announcement line", () => {
    expect(parseModuleAnnouncement("Exporting module: 'assets'...")).toBe("assets");
    expect(parseModuleAnnouncement("Exporting module: 'content-types'...")).toBe("content-types");
  });

  /*
    Negative — taxonomy #2 (invalid shape): ordinary CLI chatter must not be read
    as a module start. Every false positive inflates the denominator's numerator
    and makes the bar run ahead of the work, which is worse than a slow bar.
  */
  it("returns undefined for lines that are not module announcements", () => {
    expect(parseModuleAnnouncement("Exporting stack settings...")).toBeUndefined();
    expect(parseModuleAnnouncement("Exported stack settings successfully!")).toBeUndefined();
    expect(parseModuleAnnouncement("Batch No. 1 of assets folders is complete")).toBeUndefined();
    expect(parseModuleAnnouncement("You are not using the most recent CLI release.")).toBeUndefined();
  });
});

// ───────────────────── the module list, verified against the CLI ─────────────────────

describe("v3 CLI progress — the module list matches the CLI's own", () => {
  /** The CLI's authoritative list, read from the installed package's config. */
  const cliOwnTypes = (): string[] => {
    const file = path.join(
      process.cwd(),
      "node_modules/@contentstack/cli-cm-export/lib/config/index.js"
    );
    const src = fs.readFileSync(file, "utf8");
    // `modules: { types: [ … ]` — the first array after the `types:` key.
    const block = src.slice(src.indexOf("types: ["));
    const list = block.slice(block.indexOf("["), block.indexOf("]") + 1);
    return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  };

  /*
    Read from the CLI's REAL config rather than compared against a second copy of
    the list. A whole-stack export's progress denominator is this count, so if the
    CLI adds or removes a module our bar silently skews — reaching 100% early, or
    never arriving. This test is what turns that into a visible failure.

    Deliberately NOT a runtime import: `@contentstack/cli-cm-export` is an oclif
    plugin whose config lives at an internal path, and depending on that path at
    runtime is exactly the mistake that made `@contentstack/cli-config`
    unimportable. Reading it in a test is safe; importing it in production is not.
  */
  it("matches the CLI's own module type list exactly", () => {
    expect(CLI_EXPORT_MODULE_TYPES).toEqual(cliOwnTypes());
  });

  /*
    Negative — the vacuity guard for the test above. Two empty arrays compare
    equal, so a parse that silently returned nothing would make the match pass
    while telling us nothing. Both sides must be substantial.
  */
  it("has a non-empty list on both sides, so the match above is not vacuous", () => {
    expect(CLI_EXPORT_MODULE_TYPES.length).toBeGreaterThan(10);
    expect(cliOwnTypes().length).toBeGreaterThan(10);
    expect(CLI_EXPORT_MODULE_TYPES).toContain("entries");
    expect(CLI_EXPORT_MODULE_TYPES).toContain("content-types");
  });
});

// ───────────────────── advancing the bar ─────────────────────

describe("v3 CLI progress — a whole-stack export", () => {
  const wholeStack = () => createExportProgress({ runs: [{ module: undefined }] });

  /*
    The defect this fixes. One run means one `onRunComplete`, so the bar used to
    sit at a single value for the whole export. Announcements must move it.
  */
  it("advances as modules are announced rather than sitting at one value", () => {
    const p = wholeStack();
    const seen: number[] = [];
    for (const m of ["stack", "assets", "locales", "environments", "extensions"]) {
      seen.push(p.noteModule(m).pct);
    }

    expect(new Set(seen).size).toBeGreaterThan(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  /*
    Negative — taxonomy #4 (forbidden state): the bar must never go backwards.
    The CLI can repeat an announcement (a retry), and a bar that regressed would
    read as the export losing ground it had already made.
  */
  it("never decreases when an announcement repeats", () => {
    const p = wholeStack();
    p.noteModule("stack");
    p.noteModule("assets");
    const high = p.noteModule("locales").pct;

    expect(p.noteModule("assets").pct).toBeGreaterThanOrEqual(high);
    expect(p.noteModule("stack").pct).toBeGreaterThanOrEqual(high);
  });

  /*
    The CLI's share of the bar stops below 100 so the steps AFTER it — finalising
    the folder, building the graph, persisting it — have room. A bar that hit 100%
    while work remained is the same lie as one that fills on failure.
  */
  it("stays within the CLI's share of the bar", () => {
    const p = wholeStack();
    for (const m of CLI_EXPORT_MODULE_TYPES) p.noteModule(m);

    expect(p.pct).toBeGreaterThan(PROGRESS_SETUP_PCT);
    expect(p.pct).toBeLessThanOrEqual(PROGRESS_CLI_CEILING_PCT);
  });

  /*
    Negative — taxonomy #3 (boundary): MORE announcements than expected must not
    push past the ceiling.

    Real risk, not hypothetical: the CLI auto-exports a module's dependencies, so a
    single-module invocation can announce several. Without a clamp the bar would
    overshoot into the range reserved for the graph phases and then appear to stall
    at 100% with work still running.
  */
  it("clamps at the ceiling when more modules are announced than expected", () => {
    const p = createExportProgress({ runs: [{ module: "entries" }] });
    for (const m of ["entries", "locales", "content-types", "assets", "environments", "extensions"]) {
      p.noteModule(m);
    }

    expect(p.pct).toBeLessThanOrEqual(PROGRESS_CLI_CEILING_PCT);
  });
});

describe("v3 CLI progress — a chained export", () => {
  it("advances on a completed run as well as on announcements", () => {
    const p = createExportProgress({
      runs: [{ module: "content-types" }, { module: "global-fields" }],
    });

    const afterFirstRun = p.noteRunComplete(0, 2);
    const afterSecondRun = p.noteRunComplete(1, 2);

    expect(afterSecondRun).toBeGreaterThan(afterFirstRun);
    expect(afterSecondRun).toBe(PROGRESS_CLI_CEILING_PCT);
  });

  /*
    Negative — a completed run must not drop the bar below where announcements had
    already taken it. The two signals advance at different rates, so taking the
    later one blindly would jerk the bar backwards mid-export.
  */
  it("a completed run never lowers progress already reached by announcements", () => {
    const p = createExportProgress({ runs: [{ module: "content-types" }, { module: "assets" }] });
    p.noteModule("content-types");
    p.noteModule("assets");
    const high = p.pct;

    expect(p.noteRunComplete(0, 2)).toBeGreaterThanOrEqual(high);
  });

  /*
    The caption names the module the CLI actually announced — not the one we
    planned. For a whole-stack run there IS no planned module, which is why the
    caption was the static "Exporting the whole stack" for the entire export.
  */
  it("captions the module the CLI announced, humanised", () => {
    const p = createExportProgress({ runs: [{ module: undefined }] });

    expect(p.noteModule("content-types").stage).toBe("Exporting content types");
    expect(p.noteModule("marketplace-apps").stage).toBe("Exporting marketplace apps");
  });

  // Negative — an unknown module name is still captioned rather than dropped; the
  // CLI may add modules our list does not know, and a blank caption reads as a stall.
  it("captions a module it does not recognise rather than going blank", () => {
    const p = createExportProgress({ runs: [{ module: undefined }] });

    expect(p.noteModule("brand-new-module").stage).toBe("Exporting brand new module");
  });
});
