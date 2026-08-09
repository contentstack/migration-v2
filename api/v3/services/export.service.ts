import fs from "fs";
import { randomUUID } from "crypto";

import { buildGraph } from "./graph.service.js";
import { csManagement, TokenPayload } from "./csManagement.service.js";
import { parseBundleContentTypes, parseBundleDetails, filterBundleBySelection } from "./bundle.service.js";
import { writeStackBundleFolder, writeUploadedBundleFolder } from "./bundleWriter.service.js";
import { stackDataDir } from "../utils/migrationData.util.js";
import { getUploadMeta, getUploadZipPath } from "../models/upload.store.js";
import { setV3Graph } from "../models/project.store.js";
import { V3Source } from "../models/types.js";

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
const pace = () => (LOG_PACE_MS > 0 ? new Promise((r) => setTimeout(r, LOG_PACE_MS)) : Promise.resolve());

/** "Specific module" scope → the effective selection to gate what actually
 * gets fetched/counted/logged; "whole"/"all" (or any other scope) → undefined,
 * meaning "everything" (unchanged from prior behavior). */
const selectionFor = (scope: string | undefined, selectedModules: string[] | undefined): string[] | undefined =>
  scope === "specific" ? selectedModules ?? [] : undefined;

const pushLog = (jobId: string, level: LogLevel, msg: string): void => {
  const job = jobs.get(jobId);
  if (job) job.logs.push({ ts: nowClock(), level, msg });
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

async function runStackSource(
  jobId: string,
  tp: TokenPayload | undefined,
  apiKey: string,
  branch: string | undefined,
  selected: string[] | undefined
): Promise<{ contentTypes: any[]; counts: Record<string, number> }> {
  const wants = (key: string) => !selected || selected.includes(key);

  pushLog(jobId, "DEBUG", `Authenticating to Contentstack (${tp?.region ?? "unknown region"})`);
  pushLog(jobId, "DEBUG", "Fetching content types");
  const contentTypes = wants("contentTypes") ? await csManagement.getContentTypes(tp, apiKey, branch) : [];
  setLiveCount(jobId, "contentTypes", contentTypes.length);
  for (const ct of contentTypes) {
    pushLog(jobId, "INFO", `Discovered content type: ${ct.title ?? ct.uid}`);
  }
  setProgress(jobId, 35);

  pushLog(jobId, "DEBUG", "Fetching global fields, assets, and entries");
  const counts = await csManagement.getStackModuleCounts(
    tp,
    apiKey,
    branch,
    contentTypes,
    (event) => {
      if (event.type === "globalField") {
        pushLog(jobId, "DEBUG", `Discovered global field: ${event.name}`);
        bumpLiveCount(jobId, "globalFields", 1);
      } else if (event.type === "asset") {
        pushLog(jobId, "INFO", `Exporting asset: ${event.name}`);
      } else if (event.type === "entry") {
        pushLog(jobId, "INFO", `Exporting entry: ${event.name} (${event.ctTitle})`);
      }
    },
    selected
  );
  setLiveCount(jobId, "assets", counts.assets ?? 0);
  setLiveCount(jobId, "entries", counts.entries ?? 0);
  setLiveCount(jobId, "globalFields", counts.globalFields ?? 0);
  setProgress(jobId, 65);

  return { contentTypes, counts };
}

const sanitizeForFilename = (s: string): string => s.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);

/** Real export against a live stack: dispatching every content type's full
 * entries pagination at once burst past Contentstack's rate limit. Runs at
 * most `limit` fetches concurrently instead of all-at-once. */
const EXPORT_ENTRIES_CONCURRENCY = Number(process.env.V3_EXPORT_ENTRIES_CONCURRENCY) || 3;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Extracts a leading `blt...` stack id from an uploaded file's name (real CS
 * export bundles are named after their source stack); falls back to the
 * sanitized file name so a folder is always produced either way. */
const stackIdFromFileName = (fileName: string): string => {
  const m = fileName.match(/^(blt[a-z0-9]+)/i);
  return m ? m[1] : sanitizeForFilename(fileName.replace(/\.zip$/i, "")) || "export";
};

/** Fetches EVERY real item (not the sampled preview) for the selected stack
 * modules and writes them as a genuine Contentstack export — a real FOLDER
 * (not a zip) under cmsMigrationData/<stackApiKey>, including every asset's
 * actually-downloaded binary — so a later import step can read it directly,
 * the same on-disk location the migration engine's import CLI already uses.
 * A failure here is logged but does not fail the job — the graph preview
 * above is still valid even if the disk write isn't. */
async function writeStackBundle(
  jobId: string,
  tp: TokenPayload | undefined,
  apiKey: string,
  branch: string | undefined,
  selected: string[] | undefined,
  contentTypes: any[]
): Promise<void> {
  const wants = (key: string) => !selected || selected.includes(key);
  try {
    pushLog(jobId, "DEBUG", "Fetching full data for the real export bundle…");

    const globalFields = wants("globalFields") ? await csManagement.getAllGlobalFields(tp, apiKey, branch) : [];
    const assets = wants("assets") ? await csManagement.getAllAssets(tp, apiKey, branch) : [];

    /*
      Locales are fetched unconditionally, not as a selectable module: they are
      needed to write locales.json/master-locale.json AND to know which locales to
      pull entries for.

      A stack always has at least a master locale, so an empty list means the call
      returned nothing usable — fall back to en-us rather than iterating an empty
      array, which would fetch zero entries and produce an empty bundle. A
      successful job containing no content is worse than the bug this replaces.
    */
    const locales = await csManagement.getAllLocales(tp, apiKey, branch);
    const localeCodes = locales.map((l: any) => l?.code).filter((c: unknown): c is string => !!c);
    const codes = localeCodes.length ? localeCodes : ["en-us"];
    if (codes.length > 1) {
      pushLog(jobId, "DEBUG", `Exporting entries for ${codes.length} locales: ${codes.join(", ")}`);
    }

    /*
      Every content type × every locale. Previously this fetched one locale per
      content type (getAllEntries' default), which silently dropped all
      non-master-locale content: a three-locale stack exported 10 of its 28
      entries and the job still reported success.
    */
    const entryGroups = wants("entries")
      ? await mapWithConcurrency(
          contentTypes
            .filter((ct) => ct?.uid)
            .flatMap((ct) => codes.map((locale) => ({ ctUid: ct.uid as string, locale }))),
          EXPORT_ENTRIES_CONCURRENCY,
          async ({ ctUid, locale }) => ({
            ctUid,
            locale,
            entries: await csManagement.getAllEntries(tp, apiKey, branch, ctUid, locale),
          })
        )
      : [];

    if (assets.length) pushLog(jobId, "DEBUG", `Downloading ${assets.length} real asset file(s)…`);
    const destDir = stackDataDir(sanitizeForFilename(apiKey));
    const { failedAssets } = await writeStackBundleFolder({
      contentTypes,
      globalFields,
      assets,
      entryGroups,
      locales,
      destDir,
    });
    if (failedAssets.length) {
      pushLog(jobId, "WARN", `${failedAssets.length} asset(s) failed to download and were skipped`);
    }
    pushLog(jobId, "SUCCESS", `Export data saved: ${destDir}`);
    setProgress(jobId, 80);
  } catch (e: any) {
    pushLog(jobId, "ERROR", `Could not save the export data to disk: ${e?.message ?? "unknown error"}`);
  }
}

/** File-mode equivalent: the uploaded bundle already holds the real, full
 * data, so this just repackages it down to the selected modules (no
 * sampling involved) and writes it as a real folder under cmsMigrationData/,
 * downloading every asset's actual bytes the same way stack mode does. */
async function writeFileBundle(jobId: string, buffer: Buffer, selected: string[] | undefined, fileName: string): Promise<void> {
  try {
    const filtered = filterBundleBySelection(buffer, selected);
    const destDir = stackDataDir(stackIdFromFileName(fileName));
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
    await writeFileBundle(jobId, buffer, selected, source.file?.fileName ?? "export");
  } else {
    const apiKey = source.stack?.stackApiKey as string;
    const branch = source.stack?.branch;
    const selected = selectionFor(source.stack?.scope, source.stack?.selectedModules);
    result = await runStackSource(jobId, input.tokenPayload, apiKey, branch, selected);
    await writeStackBundle(jobId, input.tokenPayload, apiKey, branch, selected, result.contentTypes);
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
