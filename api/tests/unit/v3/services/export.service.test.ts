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

const { mockParseCts } = vi.hoisted(() => ({ mockParseCts: vi.fn() }));
vi.mock("../../../../v3/services/bundle.service.js", () => ({
  parseBundleContentTypes: mockParseCts,
}));

const { mockSetGraph } = vi.hoisted(() => ({ mockSetGraph: vi.fn() }));
vi.mock("../../../../v3/models/project.store.js", () => ({
  setV3Graph: mockSetGraph,
}));

const { mockGetCts, mockGetCounts } = vi.hoisted(() => ({
  mockGetCts: vi.fn(),
  mockGetCounts: vi.fn(),
}));
vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: { getContentTypes: mockGetCts, getStackModuleCounts: mockGetCounts },
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
  mockGetUploadZipPath.mockReturnValue("/fake/s1.zip");
  mockReadFileSync.mockReturnValue(Buffer.from("zip"));
  mockSetGraph.mockResolvedValue(undefined);
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
});
