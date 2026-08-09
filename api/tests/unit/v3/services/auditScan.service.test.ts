import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-audit-report, Phase 1 tranche 2b: the scan job and the findings cache.
 *
 * Backs TC_AR_124, 125, 156–162, 177, 178, 189, 190
 * (feature.md FR-7.8, FR-10.1, NFR-7, NFR-11, NFR-13, EC-1, EC-2; trd.md TR-7, TR-8, TR-22).
 *
 * The reader and the checks are mocked — both are separate units with their own
 * suites, and this one is about orchestration: does a scan cache its result, does a
 * failure leave nothing behind, does a poll report per-check progress, and are the
 * logs free of customer content. The cache write is real filesystem I/O against a
 * temp dir, because where the document lands is part of the contract.
 */
const { mockReadExport, mockRunChecks, mockLog } = vi.hoisted(() => ({
  mockReadExport: vi.fn(),
  mockRunChecks: vi.fn(),
  mockLog: vi.fn(),
}));

vi.mock("../../../../v3/services/auditReader.service.js", () => ({
  readAuditExport: mockReadExport,
}));
vi.mock("../../../../v3/services/auditChecks.service.js", () => ({
  runAuditChecks: mockRunChecks,
}));
vi.mock("../../../../v3/utils/logger.util.js", () => ({ v3Log: mockLog }));

import {
  startAuditScan,
  getAuditJob,
  readCachedFindings,
} from "../../../../v3/services/auditScan.service.js";

const TMP = path.join(os.tmpdir(), `v3-audit-scan-${process.pid}`);
const CACHE = "audit.json";

/** A readable export carrying one unpublished record and one asset. */
const readableExport = (over: Record<string, unknown> = {}) => ({
  readable: true,
  modules: { contentTypes: true, globalFields: true, assets: true, entries: true },
  contentTypes: [{ uid: "blog" }],
  globalFields: [],
  assets: { a1: { uid: "a1", is_dir: false } },
  records: [{ ctUid: "blog", uid: "e1", locale: "en", entry: { uid: "e1", locale: "en", publish_details: [] } }],
  entryRecordCount: 1,
  variantRecords: [],
  variantsPresent: false,
  errors: {},
  exportedAt: EXPORTED_AT,
  ...over,
});

const checksResult = (over: Record<string, unknown> = {}) => ({
  checks: [
    { id: "unusedAssets", label: "Unused assets — referenced by any entry?", state: "done", count: 1, items: [{ key: "asset:a1", category: "unusedAssets", type: "Asset", title: "orphan.png", uid: "a1", status: "Unused" }] },
    { id: "unpublishedEntries", label: "Unpublished entries — has publish details?", state: "done", count: 1, items: [{ key: "entry:blog:e1:en", category: "unpublishedEntries", type: "Entry", title: "Draft", uid: "e1", contentType: "blog", locale: "en", status: "Never published" }] },
    { id: "emptyContentTypes", label: "Empty content types — any entries at all?", state: "done", count: 0, items: [] },
    { id: "unusedGlobalFields", label: "Unused global fields — referenced by a schema?", state: "done", count: 0, items: [] },
  ],
  totals: { contentTypes: 1, globalFields: 0, assets: 1, entryRecords: 1, denominator: 3 },
  variantsInspected: false,
  ...over,
});

/** Waits for a job to leave `running`, the way the export suite settles its jobs. */
const settle = async (jobId: string) => {
  for (let i = 0; i < 200; i++) {
    const job = getAuditJob(jobId);
    if (job && job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error("audit job did not settle in time");
};

/**
 * A throwaway export directory carrying a real `export-info.json`.
 *
 * The timestamp matches the one the mocked reader reports, because the findings cache
 * is keyed on it (TRR-6). Corrected 2026-08-05: this helper originally created a bare
 * directory, which meant TC_AR_125's Given — "a cache whose key does not match the
 * export's exportedAt" — could not be expressed at all, since there was no exportedAt
 * on disk to mismatch against. A fixture that cannot state its own precondition tests
 * nothing; the assertion is unchanged.
 */
const EXPORTED_AT = "2026-08-05T09:20:27.553Z";

const exportDir = (name: string): string => {
  const dir = path.join(TMP, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "export-info.json"),
    JSON.stringify({ contentVersion: 2, exportedAt: EXPORTED_AT })
  );
  return dir;
};

beforeEach(() => {
  mockReadExport.mockReset();
  mockRunChecks.mockReset();
  mockLog.mockReset();
  mockReadExport.mockReturnValue(readableExport());
  mockRunChecks.mockReturnValue(checksResult());
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("v3 auditScan — running a scan and caching its result", () => {
  it("TC_AR_156 (positive): a scan returns a job id and settles as succeeded", async () => {
    const dir = exportDir("s1");

    const jobId = startAuditScan({ projectId: "P1", exportDir: dir });
    const job = await settle(jobId);

    expect(typeof jobId).toBe("string");
    expect(job.status).toBe("succeeded");
  });

  /*
    Negative — taxonomy #6 (dependency failure): the reader reports the export
    unreadable (EC-1/EC-2). The job must settle as failed with a classification the
    panel can turn into its error state — and, critically, write no findings.
  */
  it("TC_AR_161 (negative): an unreadable export fails the job and writes no findings document", async () => {
    const dir = exportDir("s2");
    mockReadExport.mockReturnValue({
      ...readableExport(),
      readable: false,
      failureReason: "export_missing",
    });

    const job = await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    expect(job.status).toBe("failed");
    expect(job.error).toBe("export_missing");
    expect(fs.existsSync(path.join(dir, CACHE))).toBe(false);
  });

  it("TC_AR_124 (positive): a successful scan writes its findings beside the export", async () => {
    const dir = exportDir("s3");

    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    // Inside the export directory, so the exporter clearing that directory
    // invalidates the cache structurally rather than by a rule (FR-7.8).
    const cached = JSON.parse(fs.readFileSync(path.join(dir, CACHE), "utf8"));
    expect(cached.totals.denominator).toBe(3);
    expect(cached.checks).toHaveLength(4);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the checks throw partway through.
    NFR-11 requires no partial cache — a half-written document that a later read
    mistook for a complete result would report findings for checks that never ran.
  */
  it("TC_AR_189 (negative): a scan that throws partway leaves no partial cache behind", async () => {
    const dir = exportDir("s4");
    mockRunChecks.mockImplementation(() => {
      throw new Error("boom during checks");
    });

    const job = await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    expect(job.status).toBe("failed");
    expect(fs.existsSync(path.join(dir, CACHE))).toBe(false);
    expect(readCachedFindings(dir)).toBeUndefined();
  });
});

describe("v3 auditScan — reading the cache", () => {
  it("TC_AR_157 (positive): cached findings are returned without re-reading the export", async () => {
    const dir = exportDir("c1");
    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));
    mockReadExport.mockClear();

    const cached = readCachedFindings(dir);

    expect(cached?.totals.denominator).toBe(3);
    // The whole point of the cache: no scan, no disk walk (AC-1.4).
    expect(mockReadExport).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #1 (missing input): no cache document exists yet, so the
    read reports absence rather than an empty findings object. The panel branches on
    this to decide whether to start a scan, and an empty-but-present object would
    render as a completed audit of an empty stack.
  */
  it("TC_AR_157 (negative): an export with no cache document reads undefined, not empty findings", () => {
    const dir = exportDir("c2");

    expect(readCachedFindings(dir)).toBeUndefined();
  });

  it("TC_AR_125 (positive): a cache whose key does not match the export's exportedAt is not used", async () => {
    const dir = exportDir("c3");
    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    // Stand-in for a re-export: the document survives but the export it describes
    // has moved on.
    const cached = JSON.parse(fs.readFileSync(path.join(dir, CACHE), "utf8"));
    cached.cacheKey = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(path.join(dir, CACHE), JSON.stringify(cached));

    expect(readCachedFindings(dir)).toBeUndefined();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the cache document is corrupt. It must be
    ignored — treated as no cache, so a fresh scan runs — rather than throwing and
    taking the whole panel to its error state over a file that is safe to discard.
  */
  it("TC_AR_125 (negative): a corrupt cache document is ignored rather than thrown on", () => {
    const dir = exportDir("c4");
    fs.writeFileSync(path.join(dir, CACHE), "{ not json at all");

    expect(readCachedFindings(dir)).toBeUndefined();
  });
});

describe("v3 auditScan — re-running", () => {
  it("TC_AR_158 (positive): a forced scan ignores a valid cache and reads the export again", async () => {
    const dir = exportDir("r1");
    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));
    mockReadExport.mockClear();

    await settle(startAuditScan({ projectId: "P1", exportDir: dir, force: true }));

    expect(mockReadExport).toHaveBeenCalled();
  });

  it("TC_AR_159 (positive): a re-run overwrites the cache with the current findings", async () => {
    const dir = exportDir("r2");
    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    mockRunChecks.mockReturnValue(
      checksResult({ totals: { contentTypes: 2, globalFields: 1, assets: 5, entryRecords: 9, denominator: 17 } })
    );
    await settle(startAuditScan({ projectId: "P1", exportDir: dir, force: true }));

    expect(readCachedFindings(dir)?.totals.denominator).toBe(17);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a scan must never touch the project's
    decisions. TC_AR_160's requirement — decisions survive a re-run — is guaranteed
    by the scan simply having no access to them, which is stronger than remembering
    not to write.
  */
  it("TC_AR_160 (negative): a scan neither reads nor writes the project's decisions", async () => {
    const dir = exportDir("r3");

    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    const cached = JSON.parse(fs.readFileSync(path.join(dir, CACHE), "utf8"));
    // The findings document describes the export only — no decision state anywhere
    // in it, so a re-run cannot disturb what the user chose (FR-7.6).
    expect(cached).not.toHaveProperty("decisions");
    expect(cached).not.toHaveProperty("categories");
    expect(cached).not.toHaveProperty("itemOverrides");
  });
});

describe("v3 auditScan — job progress and lifetime", () => {
  it("TC_AR_156b (positive): a settled job reports every check's resolved state", async () => {
    const dir = exportDir("j1");

    const job = await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    expect(job.checks).toHaveLength(4);
    expect(job.checks.map((c: any) => c.id)).toEqual([
      "unusedAssets",
      "unpublishedEntries",
      "emptyContentTypes",
      "unusedGlobalFields",
    ]);
    expect(job.resolvedCount).toBe(4);
  });

  /*
    Negative — taxonomy #1 (missing input): an unknown job id. The registry is
    in-memory (trd.md DM-4, TRR-1), so every id is unknown after a restart. It must
    read as absent so the client can start a new scan, rather than throwing.
  */
  it("TC_AR_162 (negative): an unknown job id reads undefined rather than throwing", () => {
    expect(getAuditJob("no-such-job")).toBeUndefined();
    expect(() => getAuditJob("no-such-job")).not.toThrow();
  });
});

describe("v3 auditScan — logging", () => {
  it("TC_AR_190 (positive): a completed run logs the project id, each check's state and count, and a duration", async () => {
    const dir = exportDir("l1");

    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    const events = mockLog.mock.calls.map(([event]) => event);
    expect(events).toContain("audit.scan.started");
    expect(events).toContain("audit.scan.check");
    expect(events).toContain("audit.scan.succeeded");

    const checkLines = mockLog.mock.calls.filter(([e]) => e === "audit.scan.check");
    expect(checkLines).toHaveLength(4);
    expect(checkLines[0][1]).toMatchObject({ projectId: "P1" });
    expect(checkLines[0][1]).toHaveProperty("state");

    const [, doneFields] = mockLog.mock.calls.find(([e]) => e === "audit.scan.succeeded")!;
    expect(doneFields).toMatchObject({ projectId: "P1" });
    expect(typeof (doneFields as any).durationMs).toBe("number");
  });

  /*
    Negative — taxonomy #5 (information disclosure): no log line may carry customer
    content. NFR-7 names the fields — entry titles, entry uids, asset filenames,
    asset uids, content-type titles — and the flagged items the scan just computed
    contain every one of them, so this is the easiest place in the feature to leak
    by passing an item straight into a log call.
  */
  it("TC_AR_177 (negative): no log line carries an entry title, uid, asset filename or content-type title", async () => {
    const dir = exportDir("l2");

    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    const logged = JSON.stringify(mockLog.mock.calls);
    for (const secret of ["Draft", "orphan.png", "e1", "a1", "blog"]) {
      expect(logged).not.toContain(secret);
    }
  });

  /*
    Negative — taxonomy #5 (information disclosure): the failure line must carry a
    fixed classification, not a filesystem path. An export path contains the source
    stack's api key, so logging it turns a diagnostic into a credential-adjacent
    leak (trd.md §11).
  */
  it("TC_AR_178 (negative): a failure logs a fixed reason, never the export path", async () => {
    const dir = exportDir("blt42a635a271789809");
    mockReadExport.mockReturnValue({
      ...readableExport(),
      readable: false,
      failureReason: "export_unreadable",
    });

    await settle(startAuditScan({ projectId: "P1", exportDir: dir }));

    const failure = mockLog.mock.calls.find(([e]) => e === "audit.scan.failed");
    expect(failure).toBeTruthy();
    expect(failure![1]).toMatchObject({ projectId: "P1", reason: "export_unreadable" });
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain("blt42a635a271789809");
    expect(JSON.stringify(mockLog.mock.calls)).not.toContain(dir);
  });
});
