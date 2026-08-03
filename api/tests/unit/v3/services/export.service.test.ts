import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TDD — v3 export.service (startExportJob / getJob / async runExport).
 * Backs TC_SRC_038 (start → jobId), TC_SRC_039 (status reflects completion),
 * TC_SRC_055 (failure surfaced, not a crash), TC_SRC_035 (empty source → valid
 * zero-state graph). feature.md FR-5.5, EC-6, EC-7.
 *
 * Collaborators mocked at their boundaries; the pure buildGraph runs real.
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

const { mockWriteStackFolder, mockWriteUploadedFolder } = vi.hoisted(() => ({
  mockWriteStackFolder: vi.fn(() => Promise.resolve({ destDir: "/fake/cmsMigrationData/blt1", failedAssets: [] })),
  mockWriteUploadedFolder: vi.fn(() => Promise.resolve({ destDir: "/fake/cmsMigrationData/export", failedAssets: [] })),
}));
vi.mock("../../../../v3/services/bundleWriter.service.js", () => ({
  writeStackBundleFolder: mockWriteStackFolder,
  writeUploadedBundleFolder: mockWriteUploadedFolder,
}));

const { mockStackDataDir } = vi.hoisted(() => ({
  mockStackDataDir: vi.fn((id: string) => `/fake/cmsMigrationData/${id}`),
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

const { mockGetCts, mockGetCounts, mockGetAllGlobalFields, mockGetAllAssets, mockGetAllEntries } = vi.hoisted(() => ({
  mockGetCts: vi.fn(),
  mockGetCounts: vi.fn(),
  mockGetAllGlobalFields: vi.fn(() => Promise.resolve([])),
  mockGetAllAssets: vi.fn(() => Promise.resolve([])),
  mockGetAllEntries: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: {
    getContentTypes: mockGetCts,
    getStackModuleCounts: mockGetCounts,
    getAllGlobalFields: mockGetAllGlobalFields,
    getAllAssets: mockGetAllAssets,
    getAllEntries: mockGetAllEntries,
  },
}));

const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(() => Buffer.from("zip")),
}));
vi.mock("fs", () => ({
  default: { readFileSync: mockReadFileSync },
  readFileSync: mockReadFileSync,
}));

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
  mockWriteStackFolder.mockImplementation(() => Promise.resolve({ destDir: "/fake/cmsMigrationData/blt1", failedAssets: [] }));
  mockWriteUploadedFolder.mockImplementation(() => Promise.resolve({ destDir: "/fake/cmsMigrationData/export", failedAssets: [] }));
  mockStackDataDir.mockImplementation((id: string) => `/fake/cmsMigrationData/${id}`);
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

  it("TC_SRC_055 (positive): a stack CS failure is surfaced as a failed job, not a crash", async () => {
    mockGetCts.mockRejectedValue(new Error("CS unreachable"));
    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);

    const job = await settle(jobId);
    expect(job.status).toBe("failed");
    expect(job.error).toContain("CS unreachable");
  });

  // Negative — contrast: a stack export that succeeds settles to succeeded, not failed.
  it("TC_SRC_055 (negative): a successful stack export settles to succeeded", async () => {
    mockGetCts.mockResolvedValue([{ uid: "a", title: "A", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 0, assets: 0, entries: 0 });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);

    const job = await settle(jobId);
    expect(job.status).toBe("succeeded");
    expect(mockSetGraph).toHaveBeenCalledTimes(1);
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

  it("(live, positive) a stack export logs real per-item names via the csManagement onItem callback", async () => {
    mockGetCts.mockResolvedValue([{ uid: "a", title: "Blog Post", schema: [] }]);
    mockGetCounts.mockImplementation(async (_tp, _key, _branch, _cts, onItem) => {
      onItem?.({ type: "globalField", name: "SEO" });
      onItem?.({ type: "asset", name: "hero.png" });
      onItem?.({ type: "entry", name: "Welcome Post", ctTitle: "Blog Post" });
      return { contentTypes: 1, globalFields: 1, assets: 1, entries: 1 };
    });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    const messages = job.logs.map((l) => l.msg).join("\n");
    expect(messages).toContain("Blog Post");
    expect(messages).toContain("SEO");
    expect(messages).toContain("hero.png");
    expect(messages).toContain("Welcome Post");
    expect(job.liveCounts).toMatchObject({ contentTypes: 1, globalFields: 1, assets: 1, entries: 1 });
  });

  // Negative — a stack with zero content types logs no item lines and liveCounts stay zero.
  it("(live, negative) a stack with no content types logs no per-item lines", async () => {
    mockGetCts.mockResolvedValue([]);
    mockGetCounts.mockResolvedValue({ contentTypes: 0, globalFields: 0, assets: 0, entries: 0 });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    expect(job.logs.some((l) => l.msg.startsWith("Discovered content type"))).toBe(false);
    expect(job.liveCounts).toMatchObject({ contentTypes: 0, globalFields: 0, assets: 0, entries: 0 });
  });

  // Regression: "Specific module" scope was recorded but never actually
  // enforced — the export always fetched/counted every module regardless of
  // what the user unchecked, so Assets/Entries showed full-stack totals even
  // when excluded. The job runner must compute the effective selection from
  // source.stack.scope/selectedModules and thread it all the way down.
  it("(scope, positive) a stack export in 'specific' scope passes the selection down to getStackModuleCounts", async () => {
    mockGetCts.mockResolvedValue([{ uid: "a", title: "A", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 1, assets: 0, entries: 0 });

    const jobId = startExportJob({
      projectId: "P1",
      source: {
        mode: "stack",
        stack: { stackApiKey: "blt1", branch: "main", scope: "specific", selectedModules: ["contentTypes", "globalFields"] },
      },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(mockGetCounts).toHaveBeenCalledWith(
      expect.anything(),
      "blt1",
      "main",
      expect.anything(),
      expect.anything(),
      ["contentTypes", "globalFields"]
    );
  });

  // Negative — contrast: 'whole' scope (the default) passes no selection
  // (undefined), so getStackModuleCounts fetches and counts every module.
  it("(scope, negative) a 'whole' scope stack export passes no selection (fetches everything)", async () => {
    mockGetCts.mockResolvedValue([{ uid: "a", title: "A", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 1, assets: 5, entries: 2 });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main", scope: "whole", selectedModules: [] } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    await settle(jobId);

    expect(mockGetCounts).toHaveBeenCalledWith(
      expect.anything(),
      "blt1",
      "main",
      expect.anything(),
      expect.anything(),
      undefined
    );
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

  // The actual, genuine export — writing real files to disk, not just a
  // preview. Backs the follow-up to the scope-gating fix: previously nothing
  // ever wrote real stack data anywhere; the job only ever sampled/counted.
  // Now writes a real FOLDER under cmsMigrationData/<stackApiKey> (not a zip
  // in Downloads) — the same location the migration engine's import step
  // reads from — and downloads every asset's actual bytes.
  it("(bundle, positive) a successful stack export fetches ALL real data and saves a real folder under cmsMigrationData", async () => {
    mockGetCts.mockResolvedValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 1, assets: 2, entries: 3 });
    mockGetAllGlobalFields.mockResolvedValue([{ uid: "seo", title: "SEO" }]);
    mockGetAllAssets.mockResolvedValue([{ uid: "a1" }, { uid: "a2" }]);
    mockGetAllEntries.mockResolvedValue([{ uid: "e1" }, { uid: "e2" }, { uid: "e3" }]);

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main", scope: "whole", selectedModules: [] } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(mockGetAllGlobalFields).toHaveBeenCalledWith(expect.anything(), "blt1", "main");
    expect(mockGetAllAssets).toHaveBeenCalledWith(expect.anything(), "blt1", "main");
    expect(mockGetAllEntries).toHaveBeenCalledWith(expect.anything(), "blt1", "main", "blog");
    expect(mockStackDataDir).toHaveBeenCalledWith("blt1");
    expect(mockWriteStackFolder).toHaveBeenCalledWith(
      expect.objectContaining({
        contentTypes: [{ uid: "blog", title: "Blog Post", schema: [] }],
        globalFields: [{ uid: "seo", title: "SEO" }],
        assets: [{ uid: "a1" }, { uid: "a2" }],
        entriesByContentType: [{ ctUid: "blog", entries: [{ uid: "e1" }, { uid: "e2" }, { uid: "e3" }] }],
        destDir: "/fake/cmsMigrationData/blt1",
      })
    );
    expect(job.logs.some((l) => l.msg.includes("Export data saved") && l.msg.includes("/fake/cmsMigrationData/blt1"))).toBe(true);
  });

  // A stack whose assets partly fail to download must still succeed overall
  // — the failure is surfaced as a WARN log, not a job failure.
  it("(bundle, negative) assets that fail to download are logged as a warning, not a job failure", async () => {
    mockGetCts.mockResolvedValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 0, assets: 1, entries: 0 });
    mockWriteStackFolder.mockResolvedValue({ destDir: "/fake/cmsMigrationData/blt1", failedAssets: ["a1"] });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(job.logs.some((l) => l.level === "WARN" && l.msg.includes("1 asset"))).toBe(true);
  });

  // Negative — a 'specific' scope stack export skips fetching unselected
  // modules' full data entirely, not just their counts.
  it("(bundle, negative) a 'specific' scope stack export never fetches full data for unselected modules", async () => {
    mockGetCts.mockResolvedValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 1, assets: 0, entries: 0 });

    const jobId = startExportJob({
      projectId: "P1",
      source: {
        mode: "stack",
        stack: { stackApiKey: "blt1", branch: "main", scope: "specific", selectedModules: ["contentTypes", "globalFields"] },
      },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    await settle(jobId);

    expect(mockGetAllAssets).not.toHaveBeenCalled();
    expect(mockGetAllEntries).not.toHaveBeenCalled();
    expect(mockGetAllGlobalFields).toHaveBeenCalled();
  });

  // A failure while writing the real bundle to disk must not fail the whole
  // job — the graph preview above it is still valid and was already built.
  it("(bundle, negative) a bundle-save failure is logged as an error but does not fail the job", async () => {
    mockGetCts.mockResolvedValue([{ uid: "blog", title: "Blog Post", schema: [] }]);
    mockGetCounts.mockResolvedValue({ contentTypes: 1, globalFields: 0, assets: 0, entries: 0 });
    mockWriteStackFolder.mockImplementation(() => {
      throw new Error("disk full");
    });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);
    const job = await settle(jobId);

    expect(job.status).toBe("succeeded");
    expect(job.logs.some((l) => l.level === "ERROR" && l.msg.includes("disk full"))).toBe(true);
    expect(mockSetGraph).toHaveBeenCalledTimes(1);
  });

  // File mode: the uploaded bundle already IS the real data, so the genuine
  // export just repackages it by module selection (no network for the zip
  // itself) and extracts it as a real folder under cmsMigrationData/,
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
  // filed under that same stack id in cmsMigrationData — not a sanitized
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

  // Regression: a real export against a live stack with many content types
  // hit Contentstack's rate limit — the full-data fetch dispatched EVERY
  // content type's entries pagination simultaneously. Entries must now be
  // fetched with bounded concurrency, not all-at-once, so a real stack with
  // many content types doesn't burst past the rate limit.
  it("(bundle, positive) full-data entries fetches run with bounded concurrency, not all content types at once", async () => {
    const cts = Array.from({ length: 6 }, (_, i) => ({ uid: `ct${i}`, title: `CT ${i}`, schema: [] }));
    mockGetCts.mockResolvedValue(cts);
    mockGetCounts.mockResolvedValue({ contentTypes: 6, globalFields: 0, assets: 0, entries: 0 });

    let inFlight = 0;
    let maxInFlight = 0;
    const pending: Array<() => void> = [];
    mockGetAllEntries.mockImplementation(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise((resolve) => {
        pending.push(() => {
          inFlight--;
          resolve([]);
        });
      });
    });

    const jobId = startExportJob({
      projectId: "P1",
      source: { mode: "stack", stack: { stackApiKey: "blt1", branch: "main" } },
      tokenPayload: { region: "NA", user_id: "u1", is_sso: false },
    } as any);

    // Flush microtasks so every call that WOULD be dispatched immediately has been.
    await new Promise((r) => setTimeout(r, 0));
    expect(maxInFlight).toBeLessThan(6); // not all 6 content types at once
    expect(maxInFlight).toBeGreaterThan(0);
    const initialBatch = pending.length;

    // Draining the pool should let the remaining content types through, one at a time.
    while (pending.length) {
      pending.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }

    const job = await settle(jobId);
    expect(job.status).toBe("succeeded");
    expect(mockGetAllEntries).toHaveBeenCalledTimes(6);
    expect(initialBatch).toBeLessThan(6);
  });
});
