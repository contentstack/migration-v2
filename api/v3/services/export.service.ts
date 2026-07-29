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
 * (transient status/progress); the durable artifact — the content graph — is
 * persisted to the v3 project store. Job durability across restarts is a
 * follow-up (trd.md TQ-10).
 */
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  jobId: string;
  projectId: string;
  status: JobStatus;
  progress: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ExportInput {
  projectId: string;
  source: V3Source;
  tokenPayload?: TokenPayload;
}

const jobs = new Map<string, Job>();

export const getJob = (jobId: string): Job | undefined => jobs.get(jobId);

const nowIso = () => new Date().toISOString();

/** Starts the export asynchronously and returns the jobId immediately. */
export const startExportJob = (input: ExportInput): string => {
  const jobId = randomUUID();
  jobs.set(jobId, {
    jobId,
    projectId: input.projectId,
    status: "queued",
    progress: 0,
    startedAt: nowIso(),
  });

  runExport(jobId, input).catch((e: any) => {
    const job = jobs.get(jobId);
    if (job) {
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
  job.progress = 50;

  const { source } = input;
  let contentTypes: any[] = [];
  let counts: Record<string, number> = {};

  if (source.mode === "file") {
    const sourceId = source.file?.sourceId as string;
    const buffer = fs.readFileSync(getUploadZipPath(sourceId));
    contentTypes = parseBundleContentTypes(buffer);
    counts = getUploadMeta(sourceId)?.modules ?? {};
  } else {
    const tp = input.tokenPayload;
    const apiKey = source.stack?.stackApiKey as string;
    const branch = source.stack?.branch;
    contentTypes = await csManagement.getContentTypes(tp, apiKey, branch);
    counts = await csManagement.getStackModuleCounts(tp, apiKey, branch, contentTypes);
  }

  const graph = buildGraph(contentTypes, counts);
  const finishedAt = nowIso();

  await setV3Graph(
    input.projectId,
    graph,
    { jobId, status: "succeeded", startedAt: job.startedAt, finishedAt },
    finishedAt
  );

  job.status = "succeeded";
  job.progress = 100;
  job.finishedAt = finishedAt;
}
