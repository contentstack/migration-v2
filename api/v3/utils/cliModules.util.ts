/**
 * v3 CLI module map, dependency closure and run ordering.
 *
 * Implements `docs/plans/source-export-revamp.md` §5.3 … §5.5. This unit decides
 * WHAT the Contentstack CLI is asked to export, which makes it the piece that
 * determines whether the resulting folder is usable at all: a closure missing
 * `content-types` produces a bundle our own Content mapping and Audit pages
 * cannot read.
 *
 * Two facts drive the design:
 *
 *   1. `--module` takes ONE module per invocation (`flags.string`, no
 *      `multiple: true`), so a multi-module selection becomes a chain of runs.
 *   2. The CLI declares only `entries → locales, content-types`. It does NOT
 *      auto-pull `global-fields`, `taxonomies` or `extensions`, even though
 *      content types reference all three — so the closure is ours to enforce.
 */

/** Our internal module keys → the CLI's `--module` values. */
export const CLI_MODULE_NAMES: Record<string, string> = {
  contentTypes: "content-types",
  globalFields: "global-fields",
  entries: "entries",
  assets: "assets",
  locales: "locales",
  extensions: "extensions",
  taxonomies: "taxonomies",
  environments: "environments",
  webhooks: "webhooks",
  workflows: "workflows",
  labels: "labels",
  customRoles: "custom-roles",
  publishingRules: "publishing-rules",
  marketplaceApps: "marketplace-apps",
  personalize: "personalize",
  composableStudio: "composable-studio",
};

/**
 * The dependency closure, per plan §5.4.
 *
 * Grounded in a real export (23 content types): 51 fields across 11 distinct
 * extensions, 6 taxonomy fields, 4 global-field references, 66 file fields.
 *
 * `environments` sits under `entries` rather than `contentTypes` because entry
 * `publish_details` reference environment uids — nothing in a content type's
 * schema does.
 */
const DEPENDS_ON: Record<string, string[]> = {
  contentTypes: ["globalFields", "taxonomies", "locales", "extensions"],
  entries: ["contentTypes", "assets", "environments"],
};

/**
 * `stack` is never planned: `exportSingleModule` prepends it to every
 * invocation, so asking for it explicitly would be a wasted run.
 */
const CLI_ADDS_ITSELF = new Set(["stack"]);

export const cliModuleName = (key: string): string => {
  const name = CLI_MODULE_NAMES[key];
  if (!name) {
    // Loudly, not silently: `csdx` rejects an unknown --module, so a pass-through
    // would surface as an opaque CLI failure mid-export instead of a clear
    // programming error here.
    throw new Error(`Unknown module key: ${key}`);
  }
  return name;
};

/** Every module implied by a selection, transitively. Never defaults to "all". */
export const resolveClosure = (selected: string[]): string[] => {
  const out = new Set<string>();

  const add = (key: string): void => {
    if (!CLI_MODULE_NAMES[key]) throw new Error(`Unknown module key: ${key}`);
    if (out.has(key)) return;
    out.add(key);
    for (const dep of DEPENDS_ON[key] ?? []) add(dep);
  };

  for (const key of selected) add(key);
  return [...out];
};

/**
 * Orders a closure so the CLI's own auto-pull removes duplicated work.
 *
 * `entries` first: it brings `locales` and `content-types` with it, so running
 * it before them means neither is fetched twice. `assets` last: it is the only
 * module that downloads binaries, so everything cheap gets a chance to fail
 * first — a bad credential should not cost a gigabyte of downloads.
 */
export const orderForExport = (closure: string[]): string[] => {
  const rank = (key: string): number => {
    if (key === "entries") return 0;
    if (key === "assets") return 2;
    return 1;
  };
  return [...closure].sort((a, b) => rank(a) - rank(b));
};

export interface ExportRun {
  /** The CLI `--module` value, or undefined for a whole-stack invocation. */
  module?: string;
}

/**
 * The invocation plan for one export (plan §5.3).
 *
 * A whole-stack export is ONE run with no `--module` — deliberately not "every
 * module chained", which would be 17 invocations of ~0.85s boot each for a
 * result one invocation already produces.
 */
export const planExportRuns = (input: {
  scope: "whole" | "specific";
  selected?: string[];
}): ExportRun[] => {
  if (input.scope === "whole") return [{ module: undefined }];

  const closure = resolveClosure(input.selected ?? []);
  // An empty selection plans NOTHING. Falling back to a whole-stack run would
  // export everything on the strength of what is most likely a UI bug.
  return orderForExport(closure)
    .filter((key) => !CLI_ADDS_ITSELF.has(key))
    .map((key) => ({ module: cliModuleName(key) }));
};
