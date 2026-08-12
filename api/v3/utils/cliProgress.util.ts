import { ExportRun } from "./cliModules.util.js";

/**
 * v3 export progress, derived from the Contentstack CLI's real output.
 *
 * Implements `docs/plans/source-export-revamp.md` Phase 2, mitigating R-3.
 *
 * **The problem this solves.** Progress used to advance only when a whole CLI
 * *run* finished. A whole-stack export is ONE run, so the bar jumped 10 → 75 and
 * stayed there for the entire export — no movement during the longest part of the
 * job.
 *
 * **The signal.** Measured from a real export's `info.log`, the CLI announces each
 * module as it begins:
 *
 *     Exporting module: 'assets'...
 *     Exporting module: 'entries'...
 *
 * It does this in order, for both whole-stack and single-module invocations. It is
 * the only per-module signal consistent enough to parse: the completion lines vary
 * per module ("Exported stack settings successfully!", "Batch No. 1 of assets
 * folders is complete"), so keying on those would be guesswork that breaks on a CLI
 * upgrade.
 *
 * **Degrading rather than throwing (R-3).** If a CLI version stopped emitting the
 * announcement, `noteModule` simply never fires and progress falls back to the
 * per-run signal — the previous coarse-but-correct behaviour. Nothing here can fail
 * an export.
 */

/**
 * The CLI's own export module list, from
 * `@contentstack/cli-cm-export/lib/config/index.js` → `modules.types`.
 *
 * Copied rather than imported: that package is an oclif plugin whose config sits at
 * an internal path, and depending on such a path at runtime is precisely what made
 * `@contentstack/cli-config` unimportable. A test reads the CLI's real file and
 * asserts this list matches, so drift fails loudly there instead of silently
 * skewing the bar.
 */
export const CLI_EXPORT_MODULE_TYPES = [
  "stack",
  "assets",
  "locales",
  "environments",
  "extensions",
  "webhooks",
  "taxonomies",
  "global-fields",
  "content-types",
  "custom-roles",
  "workflows",
  "publishing-rules",
  "personalize",
  "entries",
  "labels",
  "marketplace-apps",
  "composable-studio",
];

/** Where setup ends and the CLI's share of the bar begins. */
export const PROGRESS_SETUP_PCT = 10;
/**
 * The top of the CLI's share. Everything after the export — finalising the folder,
 * building the graph, persisting it — lives above this, so the bar must not reach
 * 100 while real work remains.
 */
export const PROGRESS_CLI_CEILING_PCT = 75;

const SPAN = PROGRESS_CLI_CEILING_PCT - PROGRESS_SETUP_PCT;

/**
 * The module name from a CLI announcement, or undefined for any other line.
 *
 * Deliberately anchored on the CLI's exact phrasing. A looser match would catch
 * ordinary chatter like "Exporting stack settings..." and run the bar ahead of the
 * work — worse than a bar that moves too slowly, because it promises completion
 * that has not happened.
 */
export const parseModuleAnnouncement = (line: string): string | undefined => {
  const m = line.match(/^Exporting module:\s*'([^']+)'/);
  return m ? m[1] : undefined;
};

/** kebab-case module name → the caption shown to the operator. */
const humanise = (module: string): string => `Exporting ${module.replace(/-/g, " ")}`;

export interface ExportProgress {
  /** Records a module announcement; returns the new percentage and caption. */
  noteModule(module: string): { pct: number; stage: string };
  /** Records a finished CLI run; returns the new percentage. */
  noteRunComplete(index: number, total: number): number;
  /** The current percentage. */
  readonly pct: number;
}

/**
 * Tracks export progress from two independent signals — announced modules and
 * completed runs — taking whichever is further along.
 *
 * Monotonic by construction. The CLI can repeat an announcement on a retry, and
 * the two signals advance at different rates, so either could otherwise pull the
 * bar backwards; a bar that loses ground reads as the export failing.
 */
export const createExportProgress = (opts: { runs: ExportRun[] }): ExportProgress => {
  const isWholeStack = opts.runs.length === 1 && !opts.runs[0]?.module;
  /*
    A whole-stack run walks every module the CLI knows, so that count is the
    denominator. A chained run exports one module per invocation, so the run count
    is — though the CLI also auto-exports a module's dependencies, which is why the
    result is clamped rather than trusted to land exactly.
  */
  const expected = Math.max(
    1,
    isWholeStack ? CLI_EXPORT_MODULE_TYPES.length : opts.runs.length
  );

  let announced = 0;
  let current = PROGRESS_SETUP_PCT;

  const advance = (candidate: number): number => {
    current = Math.min(PROGRESS_CLI_CEILING_PCT, Math.max(current, Math.round(candidate)));
    return current;
  };

  return {
    noteModule(module: string) {
      announced += 1;
      /*
        Credit is given for the modules already FINISHED — the announced one has
        only just started. Counting it as done would report work that has not
        happened, which is the same overstatement the old fixed percentages made.
      */
      const completed = Math.max(0, announced - 1);
      return {
        pct: advance(PROGRESS_SETUP_PCT + (completed / expected) * SPAN),
        stage: humanise(module),
      };
    },

    noteRunComplete(index: number, total: number) {
      // A finished run is genuine completed work, so this one counts in full.
      return advance(PROGRESS_SETUP_PCT + ((index + 1) / Math.max(1, total)) * SPAN);
    },

    get pct() {
      return current;
    },
  };
};
