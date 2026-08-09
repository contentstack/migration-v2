import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { readAuditExport } from "./auditReader.service.js";
import { runAuditChecks } from "./auditChecks.service.js";
import type { AuditCheck, AuditTotals } from "./auditChecks.service.js";
import { v3Log } from "../utils/logger.util.js";

/**
 * The audit scan job and the findings cache
 * (cs-audit-report trd.md TR-7, TR-8, TR-22).
 *
 * The job registry is in-memory and process-local (DM-4), so every job id is unknown
 * after a restart — `getAuditJob` reports absence so the client can start a fresh scan
 * rather than polling a ghost (TRR-1).
 *
 * The findings document is written INSIDE the export directory. That is what makes
 * FR-7.8's invalidation structural rather than a rule someone has to remember: the
 * exporter clears the directory before rewriting, so a stale cache cannot outlive its
 * input. The export's own `exportedAt` is stored alongside as a second, independent
 * check, in case the exporter ever stops clearing (TRR-6).
 */
export type AuditJobStatus = "running" | "succeeded" | "failed";

export interface AuditJobCheck {
  id: string;
  state: "queued" | "checking" | "done" | "notPresent" | "unavailable";
}

export interface AuditJob {
  jobId: string;
  projectId: string;
  status: AuditJobStatus;
  checks: AuditJobCheck[];
  resolvedCount: number;
  /** A fixed classification, never a path — see NFR-7 and trd.md §11. */
  error?: string;
}

export interface AuditFindingsDocument {
  /** The export's own `exportedAt`, so a stale document is detectable (TRR-6). */
  cacheKey?: string;
  checks: AuditCheck[];
  totals: AuditTotals;
  modules: Record<string, boolean>;
  variantsInspected: boolean;
}

export interface StartAuditScanInput {
  projectId: string;
  exportDir: string;
  /** Ignores any cached document — the "Re-run audit" path (UC-8). */
  force?: boolean;
}

const CACHE_FILE = "audit.json";

const CHECK_IDS = [
  "unusedAssets",
  "unpublishedEntries",
  "emptyContentTypes",
  "unusedGlobalFields",
] as const;

/** Process-local, lost on restart by design (DM-4, TRR-1). */
const jobs = new Map<string, AuditJob>();

const cachePath = (exportDir: string): string => path.join(exportDir, CACHE_FILE);

/**
 * Reads the cached findings, or `undefined` when there is no usable document.
 *
 * A corrupt document is treated as absent rather than thrown on: a fresh scan will
 * replace it, so taking the whole panel to its error state over a file that is safe to
 * discard would be the wrong trade (TC_AR_125's negative).
 */
export const readCachedFindings = (
  exportDir: string
): AuditFindingsDocument | undefined => {
  try {
    const file = cachePath(exportDir);
    if (!fs.existsSync(file)) return undefined;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as AuditFindingsDocument;
    if (!parsed || !Array.isArray(parsed.checks) || !parsed.totals) return undefined;

    // The cache key must still match the export it claims to describe. Without this a
    // re-export that failed to clear the directory would serve findings for data that
    // no longer exists — silently wrong, the worst outcome for this feature (TRR-6).
    const current = readExportedAt(exportDir);
    if (parsed.cacheKey !== current) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
};

/** The export's own timestamp, read cheaply without a full scan. */
const readExportedAt = (exportDir: string): string | undefined => {
  for (const candidate of [exportDir, ...safeSubdirs(exportDir)]) {
    try {
      const file = path.join(candidate, "export-info.json");
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (typeof parsed?.exportedAt === "string") return parsed.exportedAt;
    } catch {
      /* fall through to the next candidate */
    }
  }
  return undefined;
};

const safeSubdirs = (dir: string): string[] => {
  try {
    return fs
      .readdirSync(dir)
      .map((n) => path.join(dir, n))
      .filter((p) => fs.statSync(p).isDirectory());
  } catch {
    return [];
  }
};

export const getAuditJob = (jobId: string): AuditJob | undefined => jobs.get(jobId);

export const startAuditScan = (input: StartAuditScanInput): string => {
  const { projectId, exportDir } = input;
  const jobId = randomUUID();

  const job: AuditJob = {
    jobId,
    projectId,
    status: "running",
    checks: CHECK_IDS.map((id) => ({ id, state: "queued" })),
    resolvedCount: 0,
  };
  jobs.set(jobId, job);

  v3Log("audit.scan.started", { projectId });
  const startedAt = Date.now();

  // Deferred to a microtask so the caller gets its job id before any work happens,
  // which is what lets the client render the analyzing state immediately.
  void Promise.resolve().then(() => {
    try {
      const data = readAuditExport(exportDir);

      if (!data.readable) {
        job.status = "failed";
        job.error = data.failureReason ?? "export_unreadable";
        // A fixed classification only. The export path contains the source stack's api
        // key, so logging it would turn a diagnostic into a credential-adjacent leak.
        v3Log("audit.scan.failed", { projectId, reason: job.error });
        return;
      }

      const result = runAuditChecks(data);

      job.checks = result.checks.map((c) => ({ id: c.id, state: c.state }));
      job.resolvedCount = job.checks.length;
      for (const c of result.checks) {
        // Identifiers and numbers only — never an item title, uid or filename (NFR-7).
        v3Log("audit.scan.check", {
          projectId,
          check: c.id,
          state: c.state,
          count: c.count,
        });
      }

      // Written only after every check resolved, so a crash mid-scan cannot leave a
      // partial document a later read would mistake for a complete result (NFR-11).
      const document: AuditFindingsDocument = {
        cacheKey: data.exportedAt,
        checks: result.checks,
        totals: result.totals,
        modules: { ...data.modules },
        variantsInspected: result.variantsInspected,
      };
      fs.writeFileSync(cachePath(exportDir), JSON.stringify(document, null, 2));

      job.status = "succeeded";
      v3Log("audit.scan.succeeded", {
        projectId,
        durationMs: Date.now() - startedAt,
        denominator: result.totals.denominator,
      });
    } catch {
      job.status = "failed";
      job.error = "internal";
      v3Log("audit.scan.failed", { projectId, reason: "internal" });
    }
  });

  return jobId;
};
