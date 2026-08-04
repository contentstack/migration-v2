import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * TDD — v3 project routes: the list and create endpoints (trd.md API-1, API-2).
 *
 * Backs TC_PD_081 (server-side name validation), TC_PD_105 / TC_PD_106 (both
 * endpoints require a session), TC_PD_107 (region and owner come from the token,
 * never from the request), TC_PD_108 (the endpoint paths carry no organization
 * segment and the former paths no longer resolve), TC_PD_112 / TC_PD_113 (creation
 * logging includes the project id and excludes customer content).
 *
 * feature.md FR-7.8, FR-9.9, FR-9.13, NFR-3, NFR-9. trd.md TR-5, TR-21.
 *
 * The data layer and the logger are mocked; the routes, the auth middleware and
 * the v3 error middleware all run for real.
 */
const { mockList, mockCreate, mockGetV3Project, mockLog } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockGetV3Project: vi.fn(),
  mockLog: vi.fn(),
}));

vi.mock("../../../../v3/models/project.store.js", () => ({
  listV3Projects: mockList,
  createV3Project: mockCreate,
  getV3Project: mockGetV3Project,
  upsertV3Source: vi.fn(),
  upsertV3Destination: vi.fn(),
  setV3Graph: vi.fn(),
}));

vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: { getUser: vi.fn().mockResolvedValue({}) },
  CsError: class CsError extends Error {},
}));

vi.mock("../../../../v3/utils/logger.util.js", () => ({
  v3Log: mockLog,
}));

const SECRET = "test-secret";

/** The whole /v3 router, so the real auth guard is in the chain. */
const makeGuardedApp = async () => {
  vi.resetModules();
  vi.stubEnv("APP_TOKEN_KEY", SECRET);
  const v3 = (await import("../../../../v3/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/v3", v3);
  return app;
};

const token = (payload: Record<string, unknown>) => jwt.sign(payload, SECRET);
const SESSION = { user_id: "U1", region: "NA" };

const project = (over: Record<string, unknown> = {}) => ({
  id: "P1",
  name: "Marketing stack sync",
  region: "NA",
  owner: "U1",
  isDeleted: false,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  mockList.mockReset().mockResolvedValue([]);
  mockCreate.mockReset().mockImplementation(async (_scope: any, input: any, meta: any) =>
    project({ id: meta.id, name: input.name, description: input.description })
  );
  mockLog.mockReset();
});

describe("v3 project routes — authentication", () => {
  it("TC_PD_105 (positive): the list endpoint rejects a request with no session token", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).get("/v3/project");

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty("projects");
    expect(mockList).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #5 (permission denial): an invalid signature is refused
  // too, so the guard verifies the token rather than merely checking presence.
  it("TC_PD_105 (negative): the list endpoint rejects a token signed with the wrong secret", async () => {
    const app = await makeGuardedApp();
    const forged = jwt.sign(SESSION, "not-the-secret");

    const res = await request(app).get("/v3/project").set("app_token", forged);

    expect(res.status).toBe(401);
    expect(mockList).not.toHaveBeenCalled();
  });

  it("TC_PD_106 (positive): the create endpoint rejects a request with no session token", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).post("/v3/project").send({ name: "EU region migration" });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #5 (permission denial): same for a forged token — no
  // project is created.
  it("TC_PD_106 (negative): the create endpoint rejects a token signed with the wrong secret", async () => {
    const app = await makeGuardedApp();
    const forged = jwt.sign(SESSION, "not-the-secret");

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", forged)
      .send({ name: "EU region migration" });

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("v3 project routes — list", () => {
  it("TC_PD_107 (positive): the region and owner used for scoping come from the token", async () => {
    const app = await makeGuardedApp();

    await request(app).get("/v3/project").set("app_token", token(SESSION));

    expect(mockList).toHaveBeenCalledWith({ region: "NA", owner: "U1" });
  });

  // Negative — taxonomy #4 (forbidden state): a region and user id supplied in the
  // query string are ignored. Honouring them would let any caller read any other
  // user's projects (NFR-3).
  it("TC_PD_107 (negative): a region and user id supplied in the query string are ignored", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .get("/v3/project?region=EU&owner=U2&user_id=U2")
      .set("app_token", token(SESSION));

    expect(mockList).toHaveBeenCalledWith({ region: "NA", owner: "U1" });
  });
});

describe("v3 project routes — create validation", () => {
  it("TC_PD_081 (positive): the server rejects a 201-character name even though the client would have blocked it", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(201) });

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #3 (boundary): exactly 200 characters is inside the
  // limit and must be accepted, so the rejection above is the boundary and not a
  // blanket refusal of long names.
  it("TC_PD_081 (negative): the server accepts a name of exactly 200 characters", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(200) });

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});

describe("v3 project routes — create logging", () => {
  it("TC_PD_112 (positive): a successful creation is logged with the new project id", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "EU region migration", description: "Confidential customer note" });

    expect(res.status).toBe(201);
    const logged = mockLog.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).toContain(res.body.project.id);
  });

  // Negative — taxonomy #6 (dependency failure): when the store rejects, the
  // endpoint surfaces a server error rather than a created response. Asserting
  // the specific status keeps this from passing vacuously the way a bare
  // "nothing was logged" assertion would.
  it("TC_PD_112 (negative): a store failure yields a 500 and no created project in the response", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValueOnce(new Error("store unavailable"));

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "EU region migration" });

    expect(res.status).toBe(500);
    expect(res.body).not.toHaveProperty("project");
  });

  it("TC_PD_113 (positive): the project name and description never appear in the logs", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "EU region migration", description: "Confidential customer note" });

    // Assert something WAS logged first — otherwise "the name is absent" is
    // trivially true against an implementation that logs nothing at all.
    expect(mockLog).toHaveBeenCalled();
    const logged = mockLog.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).not.toContain("EU region migration");
    expect(logged).not.toContain("Confidential customer note");
  });

  // Negative — taxonomy #4 (forbidden state): the exclusion must be specific to
  // customer content, not achieved by logging nothing at all — the ids still
  // have to be there (contrast with the positive above).
  it("TC_PD_113 (negative): excluding customer content does not mean logging nothing", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "EU region migration", description: "Confidential customer note" });

    expect(mockLog).toHaveBeenCalled();
    const logged = mockLog.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(logged).toContain(res.body.project.id);
  });
});

describe("v3 project routes — endpoint paths", () => {
  it("TC_PD_108 (positive): the project endpoints resolve at their organization-free paths", async () => {
    const app = await makeGuardedApp();
    const auth = token(SESSION);

    const list = await request(app).get("/v3/project").set("app_token", auth);
    const create = await request(app)
      .post("/v3/project")
      .set("app_token", auth)
      .send({ name: "EU region migration" });

    expect(list.status).toBe(200);
    expect(create.status).toBe(201);
  });

  // Negative — taxonomy #4 (forbidden state): the FORMER organization-scoped paths
  // must no longer resolve. A stale mount left behind would keep answering them,
  // and nothing else in the suite would notice (FR-9.13).
  it("TC_PD_108 (negative): the former organization-scoped paths no longer resolve", async () => {
    const app = await makeGuardedApp();
    const auth = token(SESSION);

    for (const path of [
      "/v3/org/O1/project",
      "/v3/org/O1/project/P1/source",
      "/v3/org/O1/project/P1/destination",
    ]) {
      const res = await request(app).get(path).set("app_token", auth);
      expect(res.status).toBe(404);
    }
  });
});
