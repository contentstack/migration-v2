import { describe, it, expect } from "vitest";

/**
 * Source Export Revamp, Phase 1a — the CLI module map, the dependency closure and
 * the run ordering.
 *
 * Backs `docs/plans/source-export-revamp.md` §5.3, §5.4, §5.5.
 *
 * Pure logic, no I/O. This unit decides *what* the CLI is asked to export, which
 * makes it the piece that determines whether a bundle is usable at all — a
 * closure missing `content-types` produces a folder our own Content mapping and
 * Audit pages cannot read.
 */
import {
  CLI_MODULE_NAMES,
  cliModuleName,
  resolveClosure,
  orderForExport,
  planExportRuns,
} from "../../../../v3/utils/cliModules.util.js";

describe("v3 CLI module map — our keys to the CLI's", () => {
  it("maps camelCase keys onto the CLI's kebab-case module names", () => {
    expect(cliModuleName("contentTypes")).toBe("content-types");
    expect(cliModuleName("globalFields")).toBe("global-fields");
  });

  it("passes through keys that are already the CLI's spelling", () => {
    expect(cliModuleName("entries")).toBe("entries");
    expect(cliModuleName("assets")).toBe("assets");
    expect(cliModuleName("locales")).toBe("locales");
    expect(cliModuleName("taxonomies")).toBe("taxonomies");
    expect(cliModuleName("extensions")).toBe("extensions");
    expect(cliModuleName("environments")).toBe("environments");
    expect(cliModuleName("webhooks")).toBe("webhooks");
  });

  /*
    An unmapped key must fail loudly rather than reach the CLI. `csdx` rejects an
    unknown --module, so a silent pass-through would surface as an opaque CLI
    error mid-export instead of a clear programming mistake here.
  */
  it("throws on a key it does not know rather than guessing", () => {
    expect(() => cliModuleName("madeUpModule")).toThrow(/madeUpModule/);
  });

  /*
    Every name we can emit must be one the CLI actually accepts. This list is
    lifted from `cm:stacks:export --help`; if a CLI upgrade renames a module, this
    is the test that catches it before an export does.
  */
  it("only ever emits names the CLI documents", () => {
    const documented = new Set([
      "assets",
      "content-types",
      "entries",
      "environments",
      "extensions",
      "marketplace-apps",
      "global-fields",
      "labels",
      "locales",
      "webhooks",
      "workflows",
      "custom-roles",
      "taxonomies",
      "studio",
      "stack",
      "publishing-rules",
      "personalize",
      "composable-studio",
    ]);
    for (const name of Object.values(CLI_MODULE_NAMES)) {
      expect(documented, `"${name}" is not a documented CLI module`).toContain(name);
    }
  });
});

describe("v3 CLI module closure — plan §5.4", () => {
  it("expands contentTypes to everything a content type references", () => {
    expect(resolveClosure(["contentTypes"]).sort()).toEqual([
      "contentTypes",
      "extensions",
      "globalFields",
      "locales",
      "taxonomies",
    ]);
  });

  /*
    The closure must NOT drag in entries or assets. "Set up the model in the
    destination first" is the whole point of selecting content types alone, and
    pulling assets in would download every binary — the cost this closure exists
    to avoid.
  */
  it("does not pull entries or assets into the contentTypes closure", () => {
    const closure = resolveClosure(["contentTypes"]);
    expect(closure).not.toContain("entries");
    expect(closure).not.toContain("assets");
  });

  it("expands entries to the contentTypes closure plus assets and environments", () => {
    expect(resolveClosure(["entries"]).sort()).toEqual([
      "assets",
      "contentTypes",
      "entries",
      "environments",
      "extensions",
      "globalFields",
      "locales",
      "taxonomies",
    ]);
  });

  /*
    `environments` is in the entries closure because entry `publish_details`
    reference environment uids, and the Audit page's unpublished-entries check
    reads exactly that field. Asserted on its own so the reason survives: if
    someone trims the closure later, this is the test that explains itself.
  */
  it("includes environments with entries, for publish_details", () => {
    expect(resolveClosure(["entries"])).toContain("environments");
  });

  it("leaves a freely-choosy module as itself", () => {
    expect(resolveClosure(["webhooks"])).toEqual(["webhooks"]);
  });

  /*
    Tier 4 modules must not drag the content graph along. Selecting webhooks
    alone is a legitimate, cheap request; forcing content types onto it would
    make every selection expensive.
  */
  it("does not force the content graph onto a Tier 4 module", () => {
    const closure = resolveClosure(["webhooks"]);
    expect(closure).not.toContain("contentTypes");
    expect(closure).not.toContain("assets");
  });

  it("unions overlapping closures without duplicating anything", () => {
    const closure = resolveClosure(["contentTypes", "entries"]);
    expect(new Set(closure).size).toBe(closure.length);
    expect(closure.sort()).toEqual(resolveClosure(["entries"]).sort());
  });

  /*
    An empty selection must stay empty. Defaulting it to "everything" would turn
    a UI bug — a picker that failed to report its state — into a full stack
    export the operator never asked for.
  */
  it("returns nothing for an empty selection rather than defaulting to everything", () => {
    expect(resolveClosure([])).toEqual([]);
  });

  it("is transitive: assets arrive via entries, not by being named", () => {
    expect(resolveClosure(["entries"])).toContain("assets");
  });

  /*
    An unknown key must throw here too. Silently dropping it would produce a
    quietly narrower export than the operator selected.
  */
  it("throws on an unknown module key rather than dropping it", () => {
    expect(() => resolveClosure(["contentTypes", "nope"])).toThrow(/nope/);
  });
});

describe("v3 CLI run ordering — plan §5.5", () => {
  it("puts entries first, the heaviest schema-dependent module", () => {
    const ordered = orderForExport(resolveClosure(["entries"]));
    expect(ordered[0]).toBe("entries");
  });

  it("puts assets last so the expensive module runs only after the cheap ones", () => {
    const ordered = orderForExport(resolveClosure(["entries"]));
    expect(ordered[ordered.length - 1]).toBe("assets");
  });

  /*
    Ordering must not change the SET. A sort that dropped or invented a module
    would be invisible behind an order assertion.
  */
  it("preserves the closure exactly, adding and dropping nothing", () => {
    const closure = resolveClosure(["entries"]);
    expect(orderForExport(closure).sort()).toEqual([...closure].sort());
  });

  it("is stable for a closure with neither entries nor assets", () => {
    const closure = resolveClosure(["contentTypes"]);
    const ordered = orderForExport(closure);
    expect(ordered.sort()).toEqual([...closure].sort());
  });
});

describe("v3 export run plan — plan §5.3", () => {
  it("plans a single run with no module flag for a whole-stack export", () => {
    expect(planExportRuns({ scope: "whole" })).toEqual([{ module: undefined }]);
  });

  /*
    Whole-stack must NOT be expressed as "every module chained". That would be 17
    invocations of ~0.85s boot each, for a result one invocation already gives.
  */
  it("does not chain modules for a whole-stack export", () => {
    expect(planExportRuns({ scope: "whole" })).toHaveLength(1);
  });

  /*
    EVERY closure member gets its own run — including `locales` and
    `content-types`, which `--module entries` would bring along by itself.

    Revised from an earlier expectation of 6 runs that relied on that auto-pull
    (plan §5.5). The CLI's dependency table is typed, but leaning on it means a
    future CLI change silently yields a bundle with no `content-types` — the one
    module Content mapping and Audit read directly, so it would surface as those
    pages breaking rather than as an export failure. The extra ~1.7s of process
    boot is the cheaper side of that trade. This assertion is therefore STRONGER
    than the one it replaced, not looser.
  */
  it("plans one run per closure member for a specific-module export", () => {
    const runs = planExportRuns({ scope: "specific", selected: ["entries"] });
    expect(runs.map((r) => r.module)).toEqual([
      "entries",
      "content-types",
      "global-fields",
      "taxonomies",
      "locales",
      "extensions",
      "environments",
      "assets",
    ]);
  });

  /*
    The two modules the CLI would auto-pull must be planned explicitly, asserted
    on their own so the intent is not buried in an ordering list.
  */
  it("plans explicit runs for locales and content-types rather than trusting the auto-pull", () => {
    const names = planExportRuns({ scope: "specific", selected: ["entries"] }).map((r) => r.module);
    expect(names).toContain("content-types");
    expect(names).toContain("locales");
  });

  /*
    The plan must carry CLI names, not ours. `--module globalFields` is rejected
    by the CLI, and that failure would arrive mid-chain rather than here.
  */
  it("emits CLI module names in the plan, not our internal keys", () => {
    const runs = planExportRuns({ scope: "specific", selected: ["contentTypes"] });
    expect(runs.map((r) => r.module)).not.toContain("globalFields");
    expect(runs.map((r) => r.module)).toContain("global-fields");
  });

  it("plans no asset run when assets are outside the closure", () => {
    const runs = planExportRuns({ scope: "specific", selected: ["contentTypes"] });
    expect(runs.map((r) => r.module)).not.toContain("assets");
  });

  /*
    A specific-module export with nothing selected must plan NO runs. Falling back
    to a whole-stack run would export everything on the strength of an empty
    selection — the most expensive possible response to a likely bug.
  */
  it("plans no runs at all for a specific export with an empty selection", () => {
    expect(planExportRuns({ scope: "specific", selected: [] })).toEqual([]);
  });

  it("never plans the same module twice", () => {
    const runs = planExportRuns({ scope: "specific", selected: ["entries", "contentTypes", "assets"] });
    const names = runs.map((r) => r.module);
    expect(new Set(names).size).toBe(names.length);
  });

  /*
    `stack` is prepended by the CLI itself on every invocation
    (`exportSingleModule`), so planning it explicitly would be a redundant run.
  */
  it("never plans a run for the stack module the CLI adds itself", () => {
    const runs = planExportRuns({ scope: "specific", selected: ["entries"] });
    expect(runs.map((r) => r.module)).not.toContain("stack");
  });
});
