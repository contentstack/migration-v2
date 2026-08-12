import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { buildGraph } from "./graph.service.js";
import { parseBundleContentTypes, parseBundleDetails, filterBundleBySelection } from "./bundle.service.js";
import { writeUploadedBundleFolder } from "./bundleWriter.service.js";
import { runCliExport } from "./cliExport.service.js";
import { planExportRuns } from "../utils/cliModules.util.js";
import { applyCliRegion, applyCliAuth } from "../utils/cliAuth.util.js";
import { createExportProgress, parseModuleAnnouncement } from "../utils/cliProgress.util.js";
import {
  readExportCounts,
  readExportedContentTypes,
  stampExportedAt,
  ExportCounts,
} from "../utils/exportFolder.util.js";
import { stackDataDir } from "../utils/migrationData.util.js";
import { getUploadMeta, getUploadZipPath } from "../models/upload.store.js";
import { getCliCredential } from "../models/auth.store.js";
import { setV3Graph } from "../models/project.store.js";
import { V3Source } from "../models/types.js";

/*
  Type-only: stack mode no longer calls the Management API at all — the
  Contentstack CLI performs the export (`docs/plans/source-export-revamp.md`) —
  but the job still carries the caller's session payload to resolve a credential
  and a region from. `import type` keeps the client module out of the runtime
  graph now that none of its functions are used here.
*/
import type { TokenPayload } from "./csManagement.service.js";

/**
 * v3 export/extract job runner. Jobs are tracked in an in-memory registry
 * (transient status/progress/logs/liveCounts); the durable artifact — the
 * content graph — is persisted to the v3 project store. Job durability across
 * restarts is a follow-up (trd.md TQ-10).
 */
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";

export interface JobLogLine {
  ts: string;
  level: LogLevel;
  msg: string;
}

export interface LiveCounts {
  contentTypes: number;
  assets: number;
  entries: number;
  globalFields: number;
  references: number;
}

export interface Job {
  jobId: string;
  projectId: string;
  status: JobStatus;
  progress: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  logs: JobLogLine[];
  /** Running tallies of real discovered items — updates as the job progresses,
   * not only once at the end. Counts are always exact as soon as their source
   * call resolves; only the accompanying log LINES are sampled for readability. */
  liveCounts: LiveCounts;
  /** How many log lines the cap discarded, so the UI can say so rather than
   * presenting a truncated log as if it were complete. */
  droppedLogs: number;
  /** Human-readable caption for what the job is doing right now.
   *
   * Server-provided because only the job knows which module the CLI is on. The UI
   * previously derived this from the progress PERCENTAGE against a hardcoded table
   * of the old pipeline's phase boundaries — boundaries the CLI export does not
   * have, which left the caption naming modules the run was not touching. */
  stage?: string;
}

export interface ExportInput {
  projectId: string;
  source: V3Source;
  tokenPayload?: TokenPayload;
}

const jobs = new Map<string, Job>();

export const getJob = (jobId: string): Job | undefined => jobs.get(jobId);

const nowIso = () => new Date().toISOString();
const nowClock = () => new Date().toTimeString().slice(0, 8);

/** Pacing between individual per-item log lines, purely for a "live streaming"
 * feel on fast/local operations (file mode) — the data itself is always real,
 * never fabricated. 0 in tests via V3_LOG_PACE_MS. */
const LOG_PACE_MS = Number(process.env.V3_LOG_PACE_MS) || 70;

/**
 * Cap on retained log lines (plan Q-4, mitigating R-4).
 *
 * Real CLI output replaced our own sampled lines, so this array is now fed by a
 * process that prints thousands of lines for a large stack. The job registry lives
 * in memory for the life of the server AND the status endpoint serialises the whole
 * log on every poll — so an uncapped array degrades the UI long before it exhausts
 * memory.
 *
 * The OLDEST lines go. The end of the log is where the outcome lives: the CLI's
 * final summary on success, and the failing module's error on failure.
 */
const maxLogLines = (): number => Number(process.env.V3_MAX_LOG_LINES) || 2000;
const pace = () => (LOG_PACE_MS > 0 ? new Promise((r) => setTimeout(r, LOG_PACE_MS)) : Promise.resolve());

/** "Specific module" scope → the effective selection to gate what actually
 * gets fetched/counted/logged; "whole"/"all" (or any other scope) → undefined,
 * meaning "everything" (unchanged from prior behavior). */
const selectionFor = (scope: string | undefined, selectedModules: string[] | undefined): string[] | undefined =>
  scope === "specific" ? selectedModules ?? [] : undefined;

const pushLog = (jobId: string, level: LogLevel, msg: string): void => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.logs.push({ ts: nowClock(), level, msg });
  // Read per call, not at module load: a module-level constant would freeze the
  // value before any env override could apply, making the cap untestable and
  // unconfigurable without a restart.
  const cap = maxLogLines();
  if (job.logs.length > cap) {
    const overflow = job.logs.length - cap;
    job.logs.splice(0, overflow);
    // Counted, not silently forgotten: a truncated log presented as complete
    // would have someone conclude the CLI never printed something it did.
    job.droppedLogs += overflow;
  }
};

const setStage = (jobId: string, stage: string): void => {
  const job = jobs.get(jobId);
  if (job) job.stage = stage;
};

const setProgress = (jobId: string, pct: number): void => {
  const job = jobs.get(jobId);
  if (job) job.progress = pct;
};

const setLiveCount = (jobId: string, key: keyof LiveCounts, value: number): void => {
  const job = jobs.get(jobId);
  if (job) job.liveCounts[key] = value;
};

const bumpLiveCount = (jobId: string, key: keyof LiveCounts, delta = 1): void => {
  const job = jobs.get(jobId);
  if (job) job.liveCounts[key] += delta;
};

/** Starts the export asynchronously and returns the jobId immediately. */
export const startExportJob = (input: ExportInput): string => {
  const jobId = randomUUID();
  jobs.set(jobId, {
    jobId,
    projectId: input.projectId,
    status: "queued",
    progress: 0,
    startedAt: nowIso(),
    logs: [],
    liveCounts: { contentTypes: 0, assets: 0, entries: 0, globalFields: 0, references: 0 },
    droppedLogs: 0,
  });

  runExport(jobId, input).catch((e: any) => {
    const job = jobs.get(jobId);
    if (job) {
      pushLog(jobId, "ERROR", e?.message ?? "Export failed");
      job.status = "failed";
      job.error = e?.message ?? "Export failed";
      job.finishedAt = nowIso();
    }
  });

  return jobId;
};

async function runFileSource(
  jobId: string,
  buffer: Buffer,
  selected: string[] | undefined
): Promise<{ contentTypes: any[]; counts: Record<string, number> }> {
  const wants = (key: string) => !selected || selected.includes(key);

  pushLog(jobId, "DEBUG", "Parsing manifest and content-type schemas");
  const contentTypes = wants("contentTypes") ? parseBundleContentTypes(buffer) : [];
  const details = parseBundleDetails(buffer);
  setProgress(jobId, 25);

  if (wants("contentTypes")) {
    for (const ct of details.contentTypes) {
      pushLog(jobId, "INFO", `Discovered content type: ${ct.title}`);
      bumpLiveCount(jobId, "contentTypes", 1);
      await pace();
    }
  }
  setProgress(jobId, 35);

  if (wants("globalFields")) {
    for (const gf of details.globalFields) {
      pushLog(jobId, "DEBUG", `Discovered global field: ${gf.title}`);
      bumpLiveCount(jobId, "globalFields", 1);
      await pace();
    }
  }
  setProgress(jobId, 45);

  const assetCount = wants("assets") ? details.assetCount : 0;
  setLiveCount(jobId, "assets", assetCount); // accurate total immediately
  if (wants("assets")) {
    for (const a of details.assetSample) {
      pushLog(jobId, "INFO", `Exporting asset: ${a.title}`);
      await pace();
    }
    const remainingAssets = details.assetCount - details.assetSample.length;
    if (remainingAssets > 0) {
      pushLog(jobId, "INFO", `…and ${remainingAssets} more asset(s)`);
    }
  }
  setProgress(jobId, 60);

  let totalEntries = 0;
  if (wants("entries")) {
    for (const ctSample of details.entriesByContentType) {
      totalEntries += ctSample.count;
      for (const e of ctSample.sample) {
        pushLog(jobId, "INFO", `Exporting entry: ${e.title} (${ctSample.ctTitle})`);
        await pace();
      }
      const remaining = ctSample.count - ctSample.sample.length;
      if (remaining > 0) {
        pushLog(jobId, "INFO", `…and ${remaining} more entries in ${ctSample.ctTitle}`);
      }
    }
  }
  setLiveCount(jobId, "entries", totalEntries);
  setProgress(jobId, 80);

  return {
    contentTypes,
    counts: {
      entries: totalEntries,
      assets: assetCount,
      globalFields: wants("globalFields") ? details.globalFields.length : 0,
    },
  };
}

/**
 * The caption for a run, from the CLI module it exports.
 *
 * A whole-stack run has no module, and must NOT be captioned with one — claiming
 * "Exporting entries" while the CLI exports everything is precisely the defect
 * this replaces.
 */
const stageLabelFor = (module?: string): string =>
  module ? `Exporting ${module.replace(/-/g, " ")}` : "Exporting the whole stack";

/** Pushes a folder read's counts into the job's live tallies. */
const applyCounts = (jobId: string, counts: ExportCounts): void => {
  setLiveCount(jobId, "contentTypes", counts.contentTypes);
  setLiveCount(jobId, "globalFields", counts.globalFields);
  setLiveCount(jobId, "assets", counts.assets);
  setLiveCount(jobId, "entries", counts.entries);
};

/**
 * Moves a finished export into its final location.
 *
 * Any previous export is moved ASIDE rather than deleted up front: if the rename
 * fails we can still put it back, whereas delete-then-fail would destroy a good
 * export to make room for one that never arrived. Every later step (Audit,
 * Content mapping, import) reads this folder, so losing it costs the whole
 * migration, not just the failed run.
 */
const finaliseExportFolder = (tempDir: string, destDir: string): void => {
  fs.mkdirSync(path.dirname(destDir), { recursive: true });

  const backupDir = `${destDir}.previous-${process.pid}`;
  const hadPrevious = fs.existsSync(destDir);
  if (hadPrevious) fs.renameSync(destDir, backupDir);

  try {
    fs.renameSync(tempDir, destDir);
  } catch (e) {
    if (hadPrevious) fs.renameSync(backupDir, destDir);
    throw e;
  }
  fs.rmSync(backupDir, { recursive: true, force: true });
};

/**
 * Stack mode — the real export, performed by the Contentstack CLI.
 *
 * Implements `docs/plans/source-export-revamp.md`. Replaces the previous pair of
 * functions (`runStackSource` counting via Management API calls, then
 * `writeStackBundle` re-fetching everything to write it) with one CLI-driven
 * pass, which is what fixed the two silent gaps that pair had: entries in
 * non-master locales, and entry variants.
 *
 * Unlike the old flow, a failure here FAILS THE JOB. Previously the graph came
 * from separate API calls, so a failed disk write still left a valid preview;
 * disk is now the only source for the graph, the counts and every later step, so
 * reporting success would hand the operator a project whose next step silently
 * reads a PREVIOUS export.
 */
async function runStackCliExport(
  jobId: string,
  projectId: string,
  tp: TokenPayload | undefined,
  apiKey: string,
  branch: string | undefined,
  scope: "whole" | "specific",
  selected: string[] | undefined
): Promise<{ contentTypes: any[]; counts: Record<string, number> }> {
  const runs = planExportRuns({ scope, selected });
  /*
    An empty selection exports NOTHING rather than falling back to the whole
    stack. Exporting everything here would act on what is almost certainly a UI
    bug, and would cost the operator the very asset downloads they declined.
  */
  if (!runs.length) {
    throw new Error(
      "No modules were selected for export — pick at least one module, or choose to export the whole stack."
    );
  }

  const region = tp?.region;
  const userId = tp?.user_id;
  if (!region || !userId) {
    throw new Error("Missing region or user in this session — sign in again before exporting.");
  }

  /*
    Verifies the CLI resolved the SAME Contentstack this app is configured for,
    and refuses otherwise. Outside production `cs.ts` resolves staging hosts while
    the CLI's region map is production-only, and because the same api key exists in
    both instances an unchecked export would SUCCEED against the wrong one (R-9).
  */
  applyCliRegion(region);

  const auth = await getCliCredential(region, userId, !!tp?.is_sso);
  if (!auth) {
    // Refuse rather than spawn: with nothing injected the CLI would fall back to
    // whatever token a previous export left in its shared config and export as
    // the wrong user.
    throw new Error(
      `No Contentstack credential is stored for this user in ${region} — sign in again before exporting.`
    );
  }
  applyCliAuth(auth);
  setProgress(jobId, 10);
  setStage(jobId, "Connecting to Contentstack");

  // Sanitising is `stackDataDir`'s job now, for both segments — see safeSegment.
  const destDir = stackDataDir(projectId, apiKey);
  /*
    The CLI writes into a temp SIBLING of the destination, never the destination
    itself: a crash or a failed module would otherwise leave a half-written folder
    indistinguishable from a complete export. A sibling rather than the OS temp dir
    keeps it on the same filesystem, so finalising is a true atomic rename instead
    of a copy (Impact 8).
  */
  const tempDir = `${destDir}.partial-${jobId}`;

  pushLog(jobId, "INFO", `Exporting with the Contentstack CLI — ${runs.length} run(s)`);
  /*
    Progress and the caption are driven by the CLI's own per-module announcements.
    Before this, a whole-stack export was ONE run, so the bar jumped to 75 and sat
    there for the entire export while the caption read a single static string.
  */
  const progress = createExportProgress({ runs });
  setStage(jobId, stageLabelFor(runs[0].module));

  const result = await runCliExport({
    runs,
    stackApiKey: apiKey,
    branch,
    dataDir: tempDir,
    region,
    auth,
    /*
      Real CLI output, verbatim — the operator sees what the CLI actually said
      rather than prose we invented about it.

      The level comes from the CLI's own `[timestamp] LEVEL:` prefix, so its errors
      render as errors and the log view's level filter actually works. Falling back
      to the stream is only for lines that carried no prefix (the CLI's bare upgrade
      notice, for one) — never a guess at a level the CLI did not declare.
    */
    onLine: (line, stream, level) => {
      pushLog(jobId, level ?? (stream === "stderr" ? "WARN" : "INFO"), line);
      // A module announcement is the one per-module signal the CLI emits
      // consistently; anything else leaves progress untouched rather than guessed.
      const module = parseModuleAnnouncement(line);
      if (module) {
        const next = progress.noteModule(module);
        setProgress(jobId, next.pct);
        setStage(jobId, next.stage);
      }
    },
    onRunComplete: (_module, index, total) => {
      // A finished run is genuine completed work. The tracker takes whichever of
      // the two signals is further along, so this can only move the bar forward.
      setProgress(jobId, progress.noteRunComplete(index, total));
      // Safe mid-export — the reader defaults every absent module to 0 (Q-1).
      applyCounts(jobId, readExportCounts(tempDir));
      const next = runs[index + 1];
      if (next) setStage(jobId, stageLabelFor(next.module));
    },
  });

  if (!result.ok) {
    throw new Error(
      result.failedModule
        ? `Contentstack CLI export failed on module "${result.failedModule}": ${result.error ?? "unknown error"}`
        : `Contentstack CLI export failed: ${result.error ?? "unknown error"}`
    );
  }

  /*
    ⚠️ Before the rename, and load-bearing: its absence fails SILENTLY. The Audit
    page keys its cache on `exportedAt` and the CLI writes no timestamp of its own,
    so an unstamped export makes a stale audit indistinguishable from a fresh one.
  */
  stampExportedAt(tempDir, nowIso());
  finaliseExportFolder(tempDir, destDir);
  pushLog(jobId, "SUCCESS", `Export data saved: ${destDir}`);
  setProgress(jobId, 78);

  setStage(jobId, "Building content graph");
  const counts = readExportCounts(destDir);
  applyCounts(jobId, counts);

  return {
    // The graph is built from what was actually written, not from what we asked
    // for — so it can never describe content the export did not produce.
    contentTypes: readExportedContentTypes(destDir),
    counts: {
      contentTypes: counts.contentTypes,
      globalFields: counts.globalFields,
      assets: counts.assets,
      entries: counts.entries,
    },
  };
}

const sanitizeForFilename = (s: string): string => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);

/** Extracts a leading `blt...` stack id from an uploaded file's name (real CS
 * export bundles are named after their source stack); falls back to the
 * sanitized file name so a folder is always produced either way. */
const stackIdFromFileName = (fileName: string): string => {
  const m = fileName.match(/^(blt[a-z0-9]+)/i);
  return m ? m[1] : sanitizeForFilename(fileName.replace(/\.zip$/i, "")) || "export";
};

/** File-mode equivalent: the uploaded bundle already holds the real, full
 * data, so this just repackages it down to the selected modules (no
 * sampling involved) and writes it as a real folder under exportData/,
 * downloading every asset's actual bytes the same way stack mode does. */
async function writeFileBundle(
  jobId: string,
  projectId: string,
  buffer: Buffer,
  selected: string[] | undefined,
  fileName: string
): Promise<void> {
  try {
    const filtered = filterBundleBySelection(buffer, selected);
    const destDir = stackDataDir(projectId, stackIdFromFileName(fileName));
    const { failedAssets } = await writeUploadedBundleFolder(filtered, destDir);
    if (failedAssets.length) {
      pushLog(jobId, "WARN", `${failedAssets.length} asset(s) failed to download and were skipped`);
    }
    pushLog(jobId, "SUCCESS", `Export data saved: ${destDir}`);
    setProgress(jobId, 82);
  } catch (e: any) {
    pushLog(jobId, "ERROR", `Could not save the export data to disk: ${e?.message ?? "unknown error"}`);
  }
}

async function runExport(jobId: string, input: ExportInput): Promise<void> {
  const job = jobs.get(jobId)!;
  job.status = "running";
  pushLog(jobId, "INFO", "Starting export…");
  setProgress(jobId, 5);

  const { source } = input;
  let result: { contentTypes: any[]; counts: Record<string, number> };

  if (source.mode === "file") {
    const sourceId = source.file?.sourceId as string;
    pushLog(jobId, "DEBUG", "Reading uploaded bundle from disk");
    const buffer = fs.readFileSync(getUploadZipPath(sourceId));
    setProgress(jobId, 15);
    const selected = selectionFor(source.file?.scope, source.file?.selectedModules);
    result = await runFileSource(jobId, buffer, selected);
    await writeFileBundle(jobId, input.projectId, buffer, selected, source.file?.fileName ?? "export");
  } else {
    const apiKey = source.stack?.stackApiKey as string;
    const branch = source.stack?.branch;
    // "specific" gates which modules the CLI exports; anything else means the
    // whole stack, which is ONE run with no --module filter.
    const scope = source.stack?.scope === "specific" ? "specific" : "whole";
    result = await runStackCliExport(
      jobId,
      input.projectId,
      input.tokenPayload,
      apiKey,
      branch,
      scope,
      source.stack?.selectedModules
    );
  }

  pushLog(jobId, "DEBUG", "Building content graph");
  const graph = buildGraph(result.contentTypes, result.counts);
  setLiveCount(jobId, "references", graph.edges.length);
  pushLog(jobId, "INFO", `Content graph ready — ${graph.nodes.length} node(s), ${graph.edges.length} reference(s)`);
  setProgress(jobId, 85);

  const finishedAt = nowIso();
  pushLog(jobId, "DEBUG", "Persisting content graph");
  await setV3Graph(
    input.projectId,
    graph,
    { jobId, status: "succeeded", startedAt: job.startedAt, finishedAt },
    finishedAt
  );

  pushLog(jobId, "SUCCESS", "Export complete");
  job.status = "succeeded";
  job.progress = 100;
  job.finishedAt = finishedAt;
}
