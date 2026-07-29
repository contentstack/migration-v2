import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import AdmZip from "adm-zip";

/**
 * TDD — v3 source routes (HTTP/route behavior via supertest).
 * Backs TC_SRC_041 (invalid bundle → 400), TC_SRC_042 (oversize → 413),
 * TC_SRC_045 (graph → 200), TC_SRC_046 (graph before ready → 404).
 * feature.md FR-3.8/3.9, FR-5.6, EC-3/EC-4. Data layer mocked; routes/multer/
 * error-middleware/parseBundle run real. Auth is tested separately (TC_SRC_048),
 * so these mount the source router without the auth guard.
 */
const { mockGetV3Project } = vi.hoisted(() => ({ mockGetV3Project: vi.fn() }));
vi.mock("../../../../v3/models/project.store.js", () => ({
  getV3Project: mockGetV3Project,
  upsertV3Source: vi.fn(),
  setV3Graph: vi.fn(),
}));

const makeApp = async (uploadLimit?: number) => {
  vi.resetModules();
  if (uploadLimit != null) vi.stubEnv("V3_UPLOAD_LIMIT", String(uploadLimit));
  const routes = (await import("../../../../v3/routes/source.routes.js")).default;
  const { v3ErrorMiddleware } = await import(
    "../../../../v3/middlewares/error.middleware.js"
  );
  const app = express();
  app.use(express.json());
  app.use("/source", routes);
  app.use(v3ErrorMiddleware);
  return app;
};

beforeEach(() => {
  mockGetV3Project.mockReset();
  vi.unstubAllEnvs();
});

describe("v3 source routes — HTTP behavior", () => {
  it("TC_SRC_041 (positive): a non-zip upload is rejected 400 with the invalid-archive message", async () => {
    const app = await makeApp();
    const res = await request(app)
      .post("/source/upload")
      .attach("file", Buffer.from("this is not a zip"), "junk.zip");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Not a valid .zip archive.");
  });

  // Negative — taxonomy #2 (invalid shape): a real zip that isn't a CS export → 400, distinct message.
  it("TC_SRC_041 (negative): a zip without a CS export layout is rejected 400 as not a CS export", async () => {
    const app = await makeApp();
    const zip = new AdmZip();
    zip.addFile("readme.txt", Buffer.from("hello"));
    const res = await request(app)
      .post("/source/upload")
      .attach("file", zip.toBuffer(), "notexport.zip");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Not a Contentstack export bundle/);
  });

  it("TC_SRC_042 (positive): a file over the size limit is rejected 413", async () => {
    const app = await makeApp(10); // 10-byte limit
    const res = await request(app)
      .post("/source/upload")
      .attach("file", Buffer.alloc(200, 1), "big.zip");
    expect(res.status).toBe(413);
    expect(res.body.error.message).toMatch(/exceeds the 100 MB limit/i);
  });

  // Negative — taxonomy #3 (boundary): under the limit the size gate does not fire (reaches validation → 400, not 413).
  it("TC_SRC_042 (negative): a file under the size limit passes the size gate (not 413)", async () => {
    const app = await makeApp(10_000);
    const res = await request(app)
      .post("/source/upload")
      .attach("file", Buffer.from("still not a zip"), "small.zip");
    expect(res.status).toBe(400); // rejected for content, not size
    expect(res.status).not.toBe(413);
  });

  it("TC_SRC_045 (positive): the graph endpoint returns the persisted graph with 200", async () => {
    mockGetV3Project.mockResolvedValue({
      source: {
        graph: {
          counts: { contentTypes: 2, assets: 0, entries: 0, globalFields: 0, references: 1 },
          nodes: [{ uid: "a" }, { uid: "b" }],
          edges: [{ from: "a", to: "b" }],
        },
      },
    });
    const app = await makeApp();
    const res = await request(app).get("/source/P1/graph");
    expect(res.status).toBe(200);
    expect(res.body.counts.contentTypes).toBe(2);
    expect(res.body.edges).toHaveLength(1);
  });

  // Negative — taxonomy #1 (missing): a project with a source but no graph yet → 404.
  it("TC_SRC_045 (negative): a project with no graph yet returns 404", async () => {
    mockGetV3Project.mockResolvedValue({ source: { mode: "stack" } });
    const app = await makeApp();
    const res = await request(app).get("/source/P1/graph");
    expect(res.status).toBe(404);
  });

  it("TC_SRC_046 (positive): the graph endpoint returns 404 before any export has produced a graph", async () => {
    mockGetV3Project.mockResolvedValue(undefined);
    const app = await makeApp();
    const res = await request(app).get("/source/PX/graph");
    expect(res.status).toBe(404);
    expect(res.body.message ?? res.body.error?.message).toMatch(/no content graph|run an export/i);
  });

  // Negative — contrast: once a graph exists, the same endpoint returns 200.
  it("TC_SRC_046 (negative): with a graph present the endpoint returns 200", async () => {
    mockGetV3Project.mockResolvedValue({
      source: { graph: { counts: { contentTypes: 0, assets: 0, entries: 0, globalFields: 0, references: 0 }, nodes: [], edges: [] } },
    });
    const app = await makeApp();
    const res = await request(app).get("/source/P1/graph");
    expect(res.status).toBe(200);
  });
});
