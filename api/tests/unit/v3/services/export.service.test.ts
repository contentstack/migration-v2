import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TDD — v3 export.service (startExportJob / getJob / async runExport).
 * Backs TC_SRC_038 (start → jobId), TC_SRC_039 (status reflects completion),
 * TC_SRC_055 (failure surfaced, not a crash), TC_SRC_035 (empty source → valid
 * zero-state graph). feature.md FR-5.5, EC-6, EC-7.
 *
 * Collaborators mocked at their boundaries; the pure buildGraph runs real.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UPDATED 2026-08-11 — Source Export Revamp, Phase 3.
 *
 * Stack mode no longer exports by making Management API calls of its own; it
 * invokes the Contentstack CLI (`docs/plans/source-export-revamp.md`). Every
 * stack-mode test below therefore moved to the new boundary — `runCliExport`
 * rather than `csManagement.getContentTypes` / `getStackModuleCounts` /
 * `writeStackBundleFolder`. Each moved test records what it used to assert and
 * why the new assertion is the equivalent (or, in two cases, stronger) guarantee.
 *
 * FILE mode is untouched: an uploaded bundle is already a real export, so it
 * still parses and repackages the zip. Those tests are unchanged, verbatim.
 *
 * One assertion deliberately REVERSED, recorded here because it is a real
 * behaviour change rather than a re-point:
 *
 *   old: "(bundle, negative) a bundle-save failure is logged as an error but does
 *         not fail the job" — the graph came from separate API calls, so a failed
 *         disk write still left a valid preview.
 *   new: a failure to finalise the export folder FAILS the job.
 *
 * The reason is that disk is now the only source: the graph, the counts and every
 * later step (Audit, Content mapping) all read the folder the CLI wrote. Reporting
 * success after a failed write would hand the operator a project whose next step
 * silently reads a PREVIOUS export — the same class of stale-data bug that
 * `stampExportedAt` exists to prevent. Failing loudly is the only safe outcome.
 */
const { mockGetUploadMeta, mockGetUploadZipPath } = vi.hoisted(() => ({
  mockGetUploadMeta: vi.fn(),
  mockGetUploadZipPath: vi.fn(() => "/fake/s1.zip"),
}));
vi.mock("../../../../v3/models/upload.store.js", () => ({
  getUploadMeta: mockGetUploadMeta,
  getUploadZipPath: mockGetUploadZipPath,
  saveUpload: vi.fn(),
}));

const { mockParseCts, mockParseDetails, mockFilterBundle } = vi.hoisted(() => ({
  mockParseCts: vi.fn(),
  mockParseDetails: vi.fn(),
  mockFilterBundle: vi.fn(() => Buffer.from("filtered-zip")),
}));
vi.mock("../../../../v3/services/bundle.service.js", () => ({
  parseBundleContentTypes: mockParseCts,
  parseBundleDetails: mockParseDetails,
  filterBundleBySelection: mockFilterBundle,
}));

/*
  Only `writeUploadedBundleFolder` remains — `writeStackBundleFolder` was deleted on
  2026-08-12 with the pre-CLI pipeline. Declaring a mock for a function that no longer
  exists is worse than useless: vitest happily fabricates it, so any
  `expect(mock).not.toHaveBeenCalled()` against it passes unconditionally and reads
  like a real guarantee.
*/
const { mockWriteUploadedFolder } = vi.hoisted(() => ({
  mockWriteUploadedFolder: vi.fn(() => Promise.resolve({ destDir: "/fake/exportData/export", failedAssets: [] })),
}));
vi.mock("../../../../v3/services/bundleWriter.service.js", () => ({
  writeUploadedBundleFolder: mockWriteUploadedFolder,
}));

const { mockStackDataDir } = vi.hoisted(() => ({
  mockStackDataDir: vi.fn((pid: string, id: string) => `/fake/exportData/${pid}/${id}`),
}));
vi.mock("../../../../v3/utils/migrationData.util.js", () => ({
  stackDataDir: mockStackDataDir,
}));

const emptyDetails = () => ({
  contentTypes: [],
  globalFields: [],
  assetSample: [],
  assetCount: 0,
  entriesByContentType: [],
});

const { mockSetGraph } = vi.hoisted(() => ({ mockSetGraph: vi.fn() }));
vi.mock("../../../../v3/models/project.store.js", () => ({
  setV3Graph: mockSetGraph,
}));

/*
  Only the functions that STILL EXIST are mocked. `getContentTypes`,
  `getAllGlobalFields` and `getAllLocales` were deleted on 2026-08-12 — mocking them
  would fabricate functions the real module no longer has, making any "was not called"
  assertion against them pass by construction while looking meaningful.

  `getStackModuleCounts`, `getAllAssets` and `getAllEntries` are real and callable, so
  asserting the CLI export does NOT reach for them still catches something.
*/
const { mockGetCounts, mockGetAllAssets, mockGetAllEntries } = vi.hoisted(() => ({
  mockGetCounts: vi.fn(),
  mockGetAllAssets: vi.fn(() => Promise.resolve([])),
  mockGetAllEntries: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: {
    getStackModuleCounts: mockGetCounts,
    getAllAssets: mockGetAllAssets,
    getAllEntries: mockGetAllEntries,
  },
}));

// ── the CLI boundary (Source Export Revamp) ───────────────────────────────────

const { mockRunCliExport } = vi.hoisted(() => ({
  mockRunCliExport: vi.fn(() => Promise.resolve({ ok: true })),
}));
vi.mock("../../../../v3/services/cliExport.service.js", () => ({
  runCliExport: mockRunCliExport,
}));

const { mockApplyCliRegion, mockApplyCliAuth } = vi.hoisted(() => ({
  mockApplyCliRegion: vi.fn(),
  mockApplyCliAuth: vi.fn(),
}));
vi.mock("../../../../v3/utils/cliAuth.util.js", () => ({
  applyCliRegion: mockApplyCliRegion,
  applyCliAuth: mockApplyCliAuth,
}));

const { mockGetCliCredential } = vi.hoisted(() => ({
  mockGetCliCredential: vi.fn(() => Promise.resolve({ authtoken: "AUTH_1", email: "a@b.com" })),
}));
vi.mock("../../../../v3/models/auth.store.js", () => ({
  getCliCredential: mockGetCliCredential,
}));

const { mockReadCounts, mockReadCts, mockStampExportedAt } = vi.hoisted(() => ({
  mockReadCounts: vi.fn(() => ({ contentTypes: 0, globalFields: 0, assets: 0, entries: 0 })),
  mockReadCts: vi.fn(() => [] as any[]),
  mockStampExportedAt: vi.fn(),
}));
vi.mock("../../../../v3/utils/exportFolder.util.js", () => ({
  readExportCounts: mockReadCounts,
  readExportedContentTypes: mockReadCts,
  stampExportedAt: mockStampExportedAt,
}));

const { mockReadFileSync, mockExistsSync, mockRenameSync, mockRmSync, mockMkdirSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(() => Buffer.from("zip")),
  mockExistsSync: vi.fn(() => false),
  mockRenameSync: vi.fn(),
  mockRmSync: vi.fn(),
  mockMkdirSync: vi.fn(),
}));
vi.mock("fs", () => {
  const api = {
    readFileSync: mockReadFileSync,
    existsSync: mockExistsSync,
    renameSync: mockRenameSync,
    rmSync: mockRmSync,
    mkdirSync: mockMkdirSync,
  };
  return { default: api, ...api };
});

import { startExportJob, getJob } from "../../../../v3/services/export.service.js";

const settle = async (jobId: string) => {
  for (let i = 0; i < 100; i++) {
    const j = getJob(jobId);
    if (j && (j.status === "succeeded" || j.status === "failed")) return j;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("job did not settle in time");
};

const fileInput = (over: any = {}) => ({
  projectId: "P1",
  source: { mode: "file" as const, file: { sourceId: "s1", scope: "all", selectedModules: [] } },
  ...over,
});

/** A stack-mode job. `stack` overrides merge over a whole-stack default. */
const stackInput = (stack: any = {}) => ({
  projectId: "P1",
  source: { mode: "stack" as const, stack: { stackApiKey: "blt1", branch: "main", ...stack } },
  tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
});

/** The runs `runCliExport` was actually asked to perform. */
const runsFromCall = (): Array<string | undefined> =>
  ((mockRunCliExport.mock.calls[0]?.[0] as any)?.runs ?? []).map((r: any) => r.module);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("V3_LOG_PACE_MS", "0"); // no artificial pacing delay in tests
  mockGetUploadZipPath.mockReturnValue("/fake/s1.zip");
  mockReadFileSync.mockReturnValue(Buffer.from("zip"));
  mockSetGraph.mockResolvedValue(undefined);
  mockParseDetails.mockReturnValue(emptyDetails());
  // clearAllMocks() clears call history but NOT a per-test .mockImplementation
  // override (e.g. the "disk full" throw below) — restore the shared default
  // here so it doesn't leak into whichever test runs next.
  mockWriteUploadedFolder.mockImplementation(() => Promise.resolve({ destDir: "/fake/exportData/export", failedAssets: [] }));
  // Nested per project since 2026-08-12: stackDataDir(projectId, stackId).
  mockStackDataDir.mockImplementation((pid: string, id: string) => `/fake/exportData/${pid}/${id}`);
  // CLI defaults: a clean success writing nothing in particular.
  mockRunCliExport.mockImplementation(() => Promise.resolve({ ok: true }));
  mockGetCliCredential.mockImplementation(() => Promise.resolve({ authtoken: "AUTH_1", email: "a@b.com" }));
  mockReadCounts.mockImplementation(() => ({ contentTypes: 0, globalFields: 0, assets: 0, entries: 0 }));
  mockReadCts.mockImplementation(() => []);
  mockExistsSync.mockImplementation(() => false);
  mockRenameSync.mockImplementation(() => {});
});

describe("v3 export.service", () => {
  it("TC_SRC_038 (positive): startExportJob returns a jobId and getJob tracks it", () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([]);
    const jobId = startExportJob(fileInput());
    expect(typeof jobId).toBe("string");
    expect(jobId.length).toBeGreaterThan(0);
    expect(getJob(jobId)).toBeDefined();
  });

  // Negative — taxonomy #1 (missing input): unknown jobId → undefined.
  it("TC_SRC_038 (negative): getJob for an unknown jobId returns undefined", () => {
    expect(getJob("no-such-job")).toBeUndefined();
  });

  it("TC_SRC_039 (positive): a file export settles to succeeded and persists the graph", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: { assets: 1, entries: 2, globalFields: 0 } });
    mockParseCts.mockReturnValue([{ uid: "a", title: "A", schema: [] }]);

    const jobId = startExportJob(fileInput());
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(job.progress).toBe(100);
    expect(mockSetGraph).toHaveBeenCalledTimes(1);
    expect(mockSetGraph.mock.calls[0][1].counts.contentTypes).toBe(1);
  });

  // Negative — taxonomy #6 (dependency failure): extract throws → job failed, graph not persisted.
  it("TC_SRC_039 (negative): a file extract failure settles to failed and does not persist a graph", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockImplementation(() => {
      throw new Error("corrupt bundle");
    });

    const jobId = startExportJob(fileInput());
    const job = await settle(jobId);

    expect(job.status).toBe("failed");
    expect(job.error).toBeTruthy();
    expect(mockSetGraph).not.toHaveBeenCalled();
  });

  it("TC_SRC_035 (positive): an empty source yields a valid zero-state graph (all counts 0)", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([]);

    const jobId = startExportJob(fileInput());
    await settle(jobId);

    const graph = mockSetGraph.mock.calls[0][1];
    expect(graph.counts).toEqual({
      contentTypes: 0,
      assets: 0,
      entries: 0,
      globalFields: 0,
      references: 0,
    });
  });

  // Negative — taxonomy #3 (boundary contrast): a non-empty source yields non-zero counts.
  it("TC_SRC_035 (negative): a non-empty source yields a non-zero content-type count", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([{ uid: "a", title: "A", schema: [] }]);

    const jobId = startExportJob(fileInput());
    await settle(jobId);

    expect(mockSetGraph.mock.calls[0][1].counts.contentTypes).toBe(1);
  });

  it("(live, positive) a file export logs real per-item names and updates liveCounts as data is discovered", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockParseDetails.mockReturnValue({
      contentTypes: [{ uid: "blog", title: "Blog Post" }],
      globalFields: [{ uid: "seo", title: "SEO" }],
      assetSample: [{ uid: "a1", title: "hero.png" }],
      assetCount: 3,
      entriesByContentType: [
        { ctUid: "blog", ctTitle: "Blog Post", sample: [{ uid: "e1", title: "Welcome Post" }], count: 5 },
      ],
    });

    const jobId = startExportJob(fileInput());
    const job = await settle(jobId);

    const messages = job.logs.map((l) => l.msg).join("\n");
    expect(messages).toContain("Blog Post");
    expect(messages).toContain("SEO");
    expect(messages).toContain("hero.png");
    expect(messages).toContain("Welcome Post");
    expect(messages).toMatch(/and 2 more asset/i); // 3 total, 1 sampled
    expect(messages).toMatch(/and 4 more/i); // 5 entries, 1 sampled

    expect(job.liveCounts).toMatchObject({ contentTypes: 1, globalFields: 1, assets: 3, entries: 5 });
  });

  // Negative — taxonomy #1 (missing/empty): an empty source logs no per-item lines and
  // liveCounts stay at zero, rather than fabricating placeholder items.
  it("(live, negative) an empty file source logs no per-item lines and liveCounts stay zero", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([]);
    mockParseDetails.mockReturnValue(emptyDetails());

    const jobId = startExportJob(fileInput());
    const job = await settle(jobId);

    expect(job.logs.some((l) => l.msg.includes("Exporting asset"))).toBe(false);
    expect(job.liveCounts).toMatchObject({ contentTypes: 0, globalFields: 0, assets: 0, entries: 0 });
  });

  // File mode has the identical scope-gating requirement: a 'specific' scope
  // that excludes assets/entries must zero them out and skip their per-item
  // log lines, even though parseBundleDetails always parses the full bundle.
  it("(scope, positive) a file export in 'specific' scope zeroes counts/logs for unselected modules", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockParseDetails.mockReturnValue({
      contentTypes: [{ uid: "blog", title: "Blog Post" }],
      globalFields: [{ uid: "seo", title: "SEO" }],
      assetSample: [{ uid: "a1", title: "hero.png" }],
      assetCount: 3,
      entriesByContentType: [
        { ctUid: "blog", ctTitle: "Blog Post", sample: [{ uid: "e1", title: "Welcome Post" }], count: 5 },
      ],
    });

    const jobId = startExportJob(
      fileInput({ source: { mode: "file", file: { sourceId: "s1", scope: "specific", selectedModules: ["contentTypes", "globalFields"] } } })
    );
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(job.liveCounts).toMatchObject({ contentTypes: 1, globalFields: 1, assets: 0, entries: 0 });
    const messages = job.logs.map((l) => l.msg).join("\n");
    expect(messages).not.toContain("hero.png");
    expect(messages).not.toContain("Welcome Post");
    expect(mockSetGraph.mock.calls[0][1].counts).toMatchObject({ assets: 0, entries: 0 });
  });

  // Negative — contrast: 'all' scope (the default) still logs and counts every module.
  it("(scope, negative) an 'all' scope file export still logs and counts every module", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockParseDetails.mockReturnValue({
      contentTypes: [{ uid: "blog", title: "Blog Post" }],
      globalFields: [{ uid: "seo", title: "SEO" }],
      assetSample: [{ uid: "a1", title: "hero.png" }],
      assetCount: 3,
      entriesByContentType: [
        { ctUid: "blog", ctTitle: "Blog Post", sample: [{ uid: "e1", title: "Welcome Post" }], count: 5 },
      ],
    });

    const jobId = startExportJob(fileInput());
    const job = await settle(jobId);

    expect(job.liveCounts).toMatchObject({ assets: 3, entries: 5 });
    const messages = job.logs.map((l) => l.msg).join("\n");
    expect(messages).toContain("hero.png");
  });

  // File mode: the uploaded bundle already IS the real data, so the genuine
  // export just repackages it by module selection (no network for the zip
  // itself) and extracts it as a real folder under exportData/,
  // downloading every asset's actual bytes.
  it("(bundle, positive) a file export repackages the real uploaded bundle (filtered by selection) into a real folder", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockParseDetails.mockReturnValue(emptyDetails());
    mockReadFileSync.mockReturnValue(Buffer.from("real-uploaded-zip"));

    const jobId = startExportJob(
      fileInput({
        source: { mode: "file", file: { sourceId: "s1", fileName: "my-stack.zip", scope: "specific", selectedModules: ["contentTypes"] } },
      })
    );
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(mockFilterBundle).toHaveBeenCalledWith(Buffer.from("real-uploaded-zip"), ["contentTypes"]);
    expect(mockWriteUploadedFolder).toHaveBeenCalledWith(Buffer.from("filtered-zip"), expect.stringContaining("my-stack"));
    expect(job.logs.some((l) => l.msg.includes("Export data saved"))).toBe(true);
  });

  // A file whose name carries the source stack's real id (the shape our own
  // stack-mode export produces, e.g. "bltXXXX-export-....zip") should be
  // filed under that same stack id in exportData — not a sanitized
  // copy of the whole filename — so it lands in the SAME folder a live
  // export of that stack would use.
  it("(bundle, positive) a file named after its source stack id is written under that stack's folder", async () => {
    mockGetUploadMeta.mockReturnValue({ modules: {} });
    mockParseCts.mockReturnValue([]);
    mockParseDetails.mockReturnValue(emptyDetails());

    const jobId = startExportJob(
      fileInput({
        source: { mode: "file", file: { sourceId: "s1", fileName: "blt9ca028c6d54b20f5-export-2026-08-03.zip", scope: "all", selectedModules: [] } },
      })
    );
    await settle(jobId);

    expect(mockWriteUploadedFolder).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("blt9ca028c6d54b20f5"));
  });
});

/**
 * Stack mode — exported by the Contentstack CLI, not by our own API calls.
 *
 * Every test here replaces a pre-CLI equivalent; the comment on each names what
 * it used to assert. Two guarantees the old tests protected are worth restating,
 * because losing them silently is exactly the failure this revamp must not
 * reintroduce:
 *
 *   • ALL LOCALES. The old `(locales, positive)` test existed because our exporter
 *     fetched only the master locale and dropped 64% of a three-locale stack's
 *     entries while reporting success. The CLI exports every locale natively, so
 *     the guarantee now lives in the module closure — `entries` pulls `locales`
 *     in — which is what the closure tests below pin.
 *   • BOUNDED CONCURRENCY. The old `(bundle, positive)` concurrency test existed
 *     because dispatching every content type's pagination at once burst past
 *     Contentstack's rate limit. Request pacing is now the CLI's concern; what
 *     remains ours is that we never run two CLI processes at once, pinned here by
 *     asserting a single `runCliExport` call carrying all runs.
 */
describe("v3 export.service — stack mode via the Contentstack CLI", () => {
  /*
    Replaces the pre-CLI `TC_SRC_055 (positive)`, which mocked
    `getContentTypes` to reject. The boundary moved; the guarantee did not — a
    failing export must surface as a failed job rather than crash the process.
    Strengthened: the failing MODULE is now named, which a chained export needs
    to be actionable at all.
  */
  it("TC_SRC_055 (positive): a CLI export failure is surfaced as a failed job, not a crash", async () => {
    mockRunCliExport.mockResolvedValue({
      ok: false,
      failedModule: "content-types",
      error: "CS unreachable",
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("failed");
    expect(job.error).toContain("CS unreachable");
    expect(job.error).toContain("content-types");
  });

  // Negative — contrast: a stack export that succeeds settles to succeeded.
  it("TC_SRC_055 (negative): a successful stack export settles to succeeded", async () => {
    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("succeeded");
    expect(mockSetGraph).toHaveBeenCalledTimes(1);
  });

  /*
    Replaces the pre-CLI `(live, positive)`, which asserted our own synthesised
    "Discovered content type: X" lines from the csManagement onItem callback.

    The requirement the user set for this revamp is that the log shows REAL CLI
    output, so the assertion is now verbatim pass-through: whatever the CLI wrote
    is what the operator reads. Deliberately independent of the CLI's exact
    wording — pinning its phrasing would make the test fail on a CLI upgrade that
    changed nothing that matters.
  */
  it("(live, positive) real CLI output lines reach the job log verbatim", async () => {
    mockRunCliExport.mockImplementation(async (input: any) => {
      input.onLine?.("Starting to export content types", "stdout");
      input.onLine?.("Exported content type: Blog Post", "stdout");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    const messages = job.logs.map((l) => l.msg);
    expect(messages).toContain("Starting to export content types");
    expect(messages).toContain("Exported content type: Blog Post");
  });

  /*
    Negative — taxonomy #1 (empty output): a CLI run that prints nothing must
    produce no per-item lines at all.

    This is the anti-fabrication guard. The pre-CLI exporter generated its own
    progress prose, so it was structurally impossible for the log to be empty;
    now that the log mirrors a real process, anything resembling an item line that
    the CLI did not emit would be invented.
  */
  it("(live, negative) a silent CLI run produces no fabricated per-item lines", async () => {
    mockRunCliExport.mockResolvedValue({ ok: true });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.logs.some((l) => /^(Discovered|Exporting) (content type|asset|entry)/.test(l.msg))).toBe(false);
  });

  /*
    Replaces the pre-CLI `(scope, positive)`, which asserted the selection reached
    `getStackModuleCounts`. It now has to reach the CLI as `--module` runs, and the
    closure is resolved for real (cliModules.util is NOT mocked) so this covers the
    dependency rules end to end rather than trusting a mock's word for them.
  */
  it("(scope, positive) a 'specific' scope exports the resolved module closure, not the raw ticks", async () => {
    await settle(
      startExportJob(stackInput({ scope: "specific", selectedModules: ["contentTypes"] }) as any)
    );

    const modules = runsFromCall();
    // Content types cannot be imported without what they reference.
    expect(modules).toContain("content-types");
    expect(modules).toContain("global-fields");
    expect(modules).toContain("locales");
    expect(modules).toContain("taxonomies");
    expect(modules).toContain("extensions");
  });

  /*
    Negative — contrast: 'whole' scope is ONE run with no `--module` at all, not a
    chain of every module. Enumerating modules for a whole-stack export would drop
    whatever the CLI knows about that our own list does not.
  */
  it("(scope, negative) a 'whole' scope export is a single run with no module filter", async () => {
    await settle(startExportJob(stackInput({ scope: "whole", selectedModules: [] }) as any));

    expect(runsFromCall()).toEqual([undefined]);
  });

  /*
    The all-locales guarantee, relocated. The old test asserted six
    `getAllEntries` calls (2 content types × 3 locales) because our exporter had
    silently exported only the master locale. The CLI handles locales itself, so
    what we must guarantee is that selecting entries never produces an export
    missing the locales that define them.
  */
  it("(closure, positive) selecting entries pulls in locales, content types, assets and environments", async () => {
    await settle(
      startExportJob(stackInput({ scope: "specific", selectedModules: ["entries"] }) as any)
    );

    const modules = runsFromCall();
    for (const needed of ["entries", "content-types", "locales", "assets", "environments"]) {
      expect(modules, `an entries export without ${needed} cannot be imported`).toContain(needed);
    }
  });

  /*
    Negative — taxonomy #3 (boundary): the closure must not over-reach either. A
    content-types-only export that silently dragged in entries would turn a
    schema-only migration into a full content export — minutes of asset downloads
    the operator explicitly declined.
  */
  it("(closure, negative) selecting content types alone never pulls in entries or assets", async () => {
    await settle(
      startExportJob(stackInput({ scope: "specific", selectedModules: ["contentTypes"] }) as any)
    );

    const modules = runsFromCall();
    expect(modules).not.toContain("entries");
    expect(modules).not.toContain("assets");
  });

  /*
    Replaces the pre-CLI `(bundle, positive)`, which asserted our own
    `writeStackBundleFolder` call. The CLI writes the folder now, so what we own is
    WHERE it writes and how it lands: into a temp sibling first, then renamed into
    place, and stamped with `exportedAt` before the rename (Impact 2, Impact 8).
  */
  it("(folder, positive) the CLI writes to a temp folder that is stamped and renamed into place", async () => {
    await settle(startExportJob(stackInput() as any));

    const dataDir = (mockRunCliExport.mock.calls[0][0] as any).dataDir;
    // Nested under the project, so two projects exporting one stack cannot
    // overwrite each other's export.
    expect(mockStackDataDir).toHaveBeenCalledWith("P1", "blt1");
    // Never straight into the destination — a crash mid-export would otherwise
    // leave a half-written folder that looks like a complete export.
    expect(dataDir).not.toBe("/fake/exportData/P1/blt1");
    expect(mockStampExportedAt).toHaveBeenCalledWith(dataDir, expect.any(String));
    expect(mockRenameSync).toHaveBeenCalledWith(dataDir, "/fake/exportData/P1/blt1");
  });

  /*
    Negative — taxonomy #6 (dependency failure): a failed CLI run must leave the
    PREVIOUS export untouched.

    This is why the temp folder exists. Exporting straight into the destination
    would destroy a good export on any failure, and because every later step reads
    that folder, the operator would lose the data the failed run was supposed to
    replace.
  */
  it("(folder, negative) a failed CLI export never renames anything into the destination", async () => {
    mockRunCliExport.mockResolvedValue({ ok: false, error: "boom" });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("failed");
    expect(mockRenameSync).not.toHaveBeenCalledWith(expect.anything(), "/fake/exportData/P1/blt1");
    expect(mockStampExportedAt).not.toHaveBeenCalled();
  });

  /*
    Progress must track real completed work. The pre-CLI version advanced through
    hardcoded percentages as its own phases finished; with a chained CLI export the
    only honest signal is a run actually finishing.
  */
  it("(progress, positive) progress advances as each CLI run completes and ends at 100", async () => {
    const seen: number[] = [];
    mockRunCliExport.mockImplementation(async (input: any) => {
      const total = input.runs.length;
      input.runs.forEach((r: any, i: number) => {
        input.onRunComplete?.(r.module, i, total);
        seen.push(getJob(jobId)!.progress);
      });
      return { ok: true };
    });

    const jobId = startExportJob(
      stackInput({ scope: "specific", selectedModules: ["contentTypes"] }) as any
    );
    const job = await settle(jobId);

    expect(job.progress).toBe(100);
    // Monotonically increasing — never jumping backwards as modules finish.
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.length).toBeGreaterThan(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a failed export must NOT report 100%.

    A progress bar that fills to completion on a failed run is actively
    misleading — it is the one visual the operator trusts to know whether the
    export finished.
  */
  it("(progress, negative) a failed export never reports 100% progress", async () => {
    mockRunCliExport.mockResolvedValue({ ok: false, error: "boom" });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("failed");
    expect(job.progress).toBeLessThan(100);
  });

  /*
    The credential is injected into the CLI's own config store BEFORE the spawn,
    never passed as an argument — that is what keeps it out of argv, out of a
    process listing and out of the log the operator reads (Impact 4). The region is
    verified in the same step (Impact 4b / R-9).
  */
  it("(auth, positive) the region is applied and the credential injected before the CLI runs", async () => {
    await settle(startExportJob(stackInput() as any));

    expect(mockApplyCliRegion).toHaveBeenCalledWith("NA");
    expect(mockApplyCliAuth).toHaveBeenCalledWith(expect.objectContaining({ authtoken: "AUTH_1" }));
    expect(mockGetCliCredential).toHaveBeenCalledWith("NA", "u1", false);
    // Ordering is the point: a spawn before injection would authenticate with
    // whatever a previous export left behind.
    expect(mockApplyCliAuth.mock.invocationCallOrder[0]).toBeLessThan(
      mockRunCliExport.mock.invocationCallOrder[0]
    );
  });

  /*
    Negative — taxonomy #5 (permission/credential denial): no stored credential
    must fail BEFORE spawning anything.

    Spawning regardless would have the CLI fall back to whatever token its shared
    config still held from a previous export — succeeding as the wrong user rather
    than failing cleanly.
  */
  it("(auth, negative) a missing credential fails the job without ever spawning the CLI", async () => {
    mockGetCliCredential.mockResolvedValue(null);

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/credential|sign in|log in/i);
    expect(mockRunCliExport).not.toHaveBeenCalled();
  });

  /*
    The counts and the graph now come from the folder the CLI wrote, not from our
    own API calls (Impact 6, Q-1). Numbers here are the real ones measured from a
    genuine CLI export of the demo stack.
  */
  it("(counts, positive) live counts and the persisted graph come from the exported folder", async () => {
    mockReadCounts.mockReturnValue({ contentTypes: 23, globalFields: 14, assets: 80, entries: 124 });
    mockReadCts.mockReturnValue([{ uid: "blog", title: "Blog Post", schema: [] }]);

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.liveCounts).toMatchObject({ contentTypes: 23, globalFields: 14, assets: 80, entries: 124 });
    expect(mockSetGraph.mock.calls[0][1].counts).toMatchObject({ assets: 80, entries: 124 });
  });

  /*
    Negative — the CLI replaced our Management API export entirely. If any of these
    calls still fired we would be paying for the work twice and, worse, reporting
    counts from a source other than the folder that gets imported.

    Narrowed 2026-08-12 to the functions that still EXIST. `getContentTypes` and
    `writeStackBundleFolder` were asserted here too until they were deleted — at which
    point those two assertions could no longer fail, because vitest fabricates a mock
    for a missing export and "was not called" is then true by construction. The
    guarantee for the deleted pair is now structural: there is no function to call.
  */
  it("(counts, negative) a stack export makes no Management API calls of its own", async () => {
    await settle(startExportJob(stackInput() as any));

    expect(mockGetCounts).not.toHaveBeenCalled();
    expect(mockGetAllAssets).not.toHaveBeenCalled();
    expect(mockGetAllEntries).not.toHaveBeenCalled();
  });

  /*
    Replaces the pre-CLI `(bundle, negative)` about failed asset downloads: the CLI
    reports its own asset problems on stderr, and a partial-asset warning must not
    fail an otherwise good export.
  */
  it("(stderr, positive) a CLI warning on stderr is surfaced without failing the job", async () => {
    mockRunCliExport.mockImplementation(async (input: any) => {
      input.onLine?.("warning: 1 asset could not be downloaded", "stderr");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("succeeded");
    expect(job.logs.some((l) => l.msg.includes("1 asset could not be downloaded"))).toBe(true);
  });

  /*
    Negative — the REVERSED assertion, documented in this file's header.

    Pre-CLI this asserted a disk-write failure was logged but the job still
    succeeded, because the graph came from separate API calls. Disk is now the only
    source of truth for the graph, the counts, Audit and Content mapping — so
    reporting success after a failed finalise would hand the operator a project
    whose next step silently reads a PREVIOUS export.
  */
  it("(stderr, negative) a failure to finalise the export folder fails the job", async () => {
    mockRenameSync.mockImplementation(() => {
      throw new Error("disk full");
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.status).toBe("failed");
    expect(job.error).toContain("disk full");
    expect(mockSetGraph).not.toHaveBeenCalled();
  });

  /*
    The bounded-concurrency guarantee, relocated. Request pacing is the CLI's
    concern now; ours is that a chained export is ONE serialised call rather than a
    process per module racing on one shared CLI config store.
  */
  it("(serial, positive) a chained export is a single runCliExport call carrying every run", async () => {
    await settle(
      startExportJob(stackInput({ scope: "specific", selectedModules: ["entries"] }) as any)
    );

    expect(mockRunCliExport).toHaveBeenCalledTimes(1);
    expect(runsFromCall().length).toBeGreaterThan(1);
  });

  /*
    ── The log cap (plan Q-4 / R-4) ──────────────────────────────────────────

    Real CLI output replaced our own sampled lines, so `job.logs` is now fed by a
    process that can print thousands of lines for a large stack. The job registry
    lives in memory for the life of the server, so an uncapped array is an
    unbounded leak — and the status endpoint serialises the whole thing on every
    poll, so it degrades the UI long before it exhausts memory.
  */
  it("(cap, positive) a chatty CLI export keeps only the most recent lines and counts what it dropped", async () => {
    vi.stubEnv("V3_MAX_LOG_LINES", "50");
    mockRunCliExport.mockImplementation(async (input: any) => {
      for (let i = 0; i < 500; i++) input.onLine?.(`line ${i}`, "stdout");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.logs.length).toBe(50);
    expect(job.droppedLogs).toBeGreaterThan(0);
  });

  // Negative — taxonomy #3 (boundary): an export under the cap must lose nothing.
  it("(cap, negative) an export under the cap keeps every line and reports nothing dropped", async () => {
    vi.stubEnv("V3_MAX_LOG_LINES", "50");
    mockRunCliExport.mockImplementation(async (input: any) => {
      input.onLine?.("only line", "stdout");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.logs.length).toBeLessThan(50);
    expect(job.droppedLogs).toBe(0);
    expect(job.logs.some((l) => l.msg === "only line")).toBe(true);
  });

  /*
    The cap must drop the OLDEST lines, never the newest. The end of the log is
    where the outcome lives — the final summary on success, and the failing
    module's error on failure. A cap that kept the head would throw away the only
    part worth reading.
  */
  it("(cap, positive) the newest lines survive the cap, including the outcome", async () => {
    vi.stubEnv("V3_MAX_LOG_LINES", "20");
    mockRunCliExport.mockImplementation(async (input: any) => {
      for (let i = 0; i < 200; i++) input.onLine?.(`line ${i}`, "stdout");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    /*
      The length assertion is what stops this test being hollow. Without it, both
      "some(line 199)" and "some(SUCCESS)" are trivially true whenever NO cap
      applied — so the test passed against an uncapped implementation. Pinning the
      length first proves the cap really ran, and only then does surviving content
      mean anything.
    */
    expect(job.logs.length).toBe(20);
    expect(job.logs.some((l) => l.msg === "line 199")).toBe(true);
    expect(job.logs.some((l) => l.level === "SUCCESS")).toBe(true);
  });

  // Negative — the paired assertion: the oldest lines are genuinely gone, not
  // merely pushed further down an array that kept growing.
  it("(cap, negative) the oldest lines are genuinely discarded once the cap is hit", async () => {
    vi.stubEnv("V3_MAX_LOG_LINES", "20");
    mockRunCliExport.mockImplementation(async (input: any) => {
      for (let i = 0; i < 200; i++) input.onLine?.(`line ${i}`, "stdout");
      return { ok: true };
    });

    const job = await settle(startExportJob(stackInput() as any));

    expect(job.logs.some((l) => l.msg === "line 0")).toBe(false);
    expect(job.logs.some((l) => l.msg === "Starting export…")).toBe(false);
  });

  /*
    ── The stage label ───────────────────────────────────────────────────────

    The UI's stage caption used to be derived from the progress PERCENTAGE against
    a hardcoded table of the old pipeline's phase boundaries. Those boundaries no
    longer exist, so the caption has to come from the job itself — it is the only
    thing that knows which module the CLI is actually working on.
  */
  it("(stage, positive) the stage names the module being exported and advances with the runs", async () => {
    const stages: string[] = [];
    mockRunCliExport.mockImplementation(async (input: any) => {
      stages.push(getJob(jobId)!.stage ?? "");
      input.runs.forEach((r: any, i: number) => {
        input.onRunComplete?.(r.module, i, input.runs.length);
        stages.push(getJob(jobId)!.stage ?? "");
      });
      return { ok: true };
    });

    const jobId = startExportJob(
      stackInput({ scope: "specific", selectedModules: ["contentTypes"] }) as any
    );
    await settle(jobId);

    // The first run's module is announced BEFORE the CLI starts on it, not after.
    expect(stages[0]).toMatch(/content types/i);
    // And the caption moves on as runs complete rather than staying frozen.
    expect(new Set(stages).size).toBeGreaterThan(1);
  });

  /*
    ── Per-module progress from real CLI output (Phase 2) ─────────────────────

    THE defect this closes: a whole-stack export is ONE run, so `onRunComplete`
    fired once and the bar jumped 10 → 75 and sat there for the entire export,
    with a single static caption. The CLI announces each module as it starts
    (`Exporting module: 'assets'...`, measured from a real export's info.log), and
    that is what now drives both.
  */
  it("(announce, positive) a whole-stack export's progress and caption advance per announced module", async () => {
    const seen: Array<{ pct: number; stage?: string }> = [];
    mockRunCliExport.mockImplementation(async (input: any) => {
      for (const m of ["stack", "assets", "locales", "environments", "content-types"]) {
        input.onLine?.(`Exporting module: '${m}'...`, "stdout", "INFO");
        const j = getJob(jobId)!;
        seen.push({ pct: j.progress, stage: j.stage });
      }
      return { ok: true };
    });

    const jobId = startExportJob(stackInput({ scope: "whole", selectedModules: [] }) as any);
    await settle(jobId);

    // The caption follows the CLI, module by module.
    expect(seen.map((s) => s.stage)).toEqual([
      "Exporting stack",
      "Exporting assets",
      "Exporting locales",
      "Exporting environments",
      "Exporting content types",
    ]);
    // And the bar actually moves during the export rather than sitting at one value.
    expect(new Set(seen.map((s) => s.pct)).size).toBeGreaterThan(1);
    expect(seen.map((s) => s.pct)).toEqual([...seen.map((s) => s.pct)].sort((a, b) => a - b));
  });

  /*
    Negative — taxonomy #2 (invalid shape): ordinary CLI chatter must move neither
    the bar nor the caption.

    A loose match here would be worse than no per-module progress: the bar would run
    ahead of the work and promise a completion that has not happened.
  */
  it("(announce, negative) ordinary CLI output moves neither progress nor the caption", async () => {
    let before: { pct: number; stage?: string } | undefined;
    let after: { pct: number; stage?: string } | undefined;
    mockRunCliExport.mockImplementation(async (input: any) => {
      before = { pct: getJob(jobId)!.progress, stage: getJob(jobId)!.stage };
      input.onLine?.("Exporting stack settings...", "stdout", "INFO");
      input.onLine?.("Exported stack settings successfully!", "stdout", "SUCCESS");
      input.onLine?.("Batch No. 1 of assets folders is complete", "stdout", "SUCCESS");
      input.onLine?.("You are not using the most recent CLI release.", "stdout", undefined);
      after = { pct: getJob(jobId)!.progress, stage: getJob(jobId)!.stage };
      return { ok: true };
    });

    const jobId = startExportJob(stackInput({ scope: "whole", selectedModules: [] }) as any);
    await settle(jobId);

    expect(after).toEqual(before);
  });

  /*
    Negative — a whole-stack export has no single module, so the stage must not
    name one. Claiming "Exporting entries" while the CLI exports everything is the
    exact defect this replaces: a caption asserting something the run isn't doing.
  */
  it("(stage, negative) a whole-stack export's stage never names a specific module", async () => {
    let seen = "";
    mockRunCliExport.mockImplementation(async (input: any) => {
      seen = getJob(jobId)!.stage ?? "";
      return { ok: true };
    });

    const jobId = startExportJob(stackInput({ scope: "whole", selectedModules: [] }) as any);
    await settle(jobId);

    expect(seen).toBeTruthy();
    expect(seen).not.toMatch(/content types|entries|assets|global fields/i);
  });

  /*
    Negative — taxonomy #1 (empty selection): a 'specific' scope with nothing
    ticked must refuse rather than export.

    Falling back to a whole-stack export would export everything on the strength
    of what is almost certainly a UI bug — the opposite of what the operator asked
    for, and expensive.
  */
  it("(serial, negative) a 'specific' scope with no modules selected refuses to export", async () => {
    const job = await settle(
      startExportJob(stackInput({ scope: "specific", selectedModules: [] }) as any)
    );

    expect(job.status).toBe("failed");
    expect(job.error).toMatch(/no modules|nothing selected/i);
    expect(mockRunCliExport).not.toHaveBeenCalled();
  });
});
