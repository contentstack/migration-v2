import fs from "fs";
import { randomUUID } from "crypto";

import { buildGraph } from "./graph.service.js";
import { csManagement, TokenPayload } from "./csManagement.service.js";
import { parseBundleContentTypes } from "./bundle.service.js";
import { getUploadMeta, getUploadZipPath } from "../models/upload.store.js";
import { setV3Graph } from "../models/project.store.js";
import { V3Source } from "../models/types.js";

/**
 * v3 export/extract job runner. Jobs are tracked in an in-memory registry
 * (transient status/progress/logs); the durable artifact — the content graph —
 * is persisted to the v3 project store. Job durability across restarts is a
 * follow-up (trd.md TQ-10).
 */
export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SUCCESS";

export interface JobLogLine {
  ts: string;
  level: LogLevel;
  msg: string;
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

const pushLog = (jobId: string, level: LogLevel, msg: string): void => {
  const job = jobs.get(jobId);
  if (job) job.logs.push({ ts: nowClock(), level, msg });
};

const setProgress = (jobId: string, pct: number): void => {
  const job = jobs.get(jobId);
  if (job) job.progress = pct;
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

async function runExport(jobId: string, input: ExportInput): Promise<void> {
  const job = jobs.get(jobId)!;
  job.status = "running";
  pushLog(jobId, "INFO", "Starting export…");
  setProgress(jobId, 5);

  const { source } = input;
  let contentTypes: any[] = [];
  let counts: Record<string, number> = {};

  if (source.mode === "file") {
    const sourceId = source.file?.sourceId as string;
    pushLog(jobId, "DEBUG", "Reading uploaded bundle from disk");
    const buffer = fs.readFileSync(getUploadZipPath(sourceId));
    setProgress(jobId, 30);

    pushLog(jobId, "DEBUG", "Parsing manifest and content-type schemas");
    contentTypes = parseBundleContentTypes(buffer);
    counts = getUploadMeta(sourceId)?.modules ?? {};
    pushLog(jobId, "INFO", `Found ${contentTypes.length} content type(s)`);
    setProgress(jobId, 55);
  } else {
    const tp = input.tokenPayload;
    const apiKey = source.stack?.stackApiKey as string;
    const branch = source.stack?.branch;

    pushLog(jobId, "DEBUG", `Authenticating to Contentstack (${tp?.region ?? "unknown region"})`);
    pushLog(jobId, "DEBUG", "Fetching content types");
    contentTypes = await csManagement.getContentTypes(tp, apiKey, branch);
    pushLog(jobId, "INFO", `Found ${contentTypes.length} content type(s)`);
    setProgress(jobId, 35);

    pushLog(jobId, "DEBUG", "Fetching global fields, assets, and entry counts");
    counts = await csManagement.getStackModuleCounts(tp, apiKey, branch, contentTypes);
    pushLog(
      jobId,
      "INFO",
      `Counted ${counts.entries ?? 0} entries, ${counts.assets ?? 0} assets, ${counts.globalFields ?? 0} global field(s)`
    );
    setProgress(jobId, 65);
  }

  pushLog(jobId, "DEBUG", "Building content graph");
  const graph = buildGraph(contentTypes, counts);
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
