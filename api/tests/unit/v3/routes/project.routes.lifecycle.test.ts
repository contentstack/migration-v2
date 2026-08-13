import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * TDD — cs-project-lifecycle, Phase 1 tranche 1c: the HTTP surface.
 *
 * Covers TC_PL_001–007 (API-1's contract), TC_PL_008–012 (authorization and scope),
 * TC_PL_062–070 (deletion observability), TC_PL_083 + TC_PL_090 (the create rule at
 * the HTTP boundary) and TC_PL_084–087 + TC_PL_104–107 (validation precedence and
 * create observability).
 *
 * Against `feature.md` FR-1.1, FR-1.5, FR-1.6, FR-1.8, FR-3.4, FR-3.6, FR-3.7,
 * NFR-2 and NFR-6.
 *
 * The store and the logger are mocked; the routes, the real auth guard and the v3
 * error middleware all run for real — the same split the neighbouring
 * `project.routes.test.ts` uses, so the guard being exercised is the real one.
 */
const { mockList, mockCreate, mockGetV3Project, mockDelete, mockLog } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockGetV3Project: vi.fn(),
  mockDelete: vi.fn(),
  mockLog: vi.fn(),
}));

vi.mock("../../../../v3/models/project.store.js", () => ({
  listV3Projects: mockList,
  createV3Project: mockCreate,
  getV3Project: mockGetV3Project,
  deleteV3Project: mockDelete,
  upsertV3Source: vi.fn(),
  upsertV3Destination: vi.fn(),
  setV3Graph: vi.fn(),
}));

vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: { getUser: vi.fn().mockResolvedValue({}) },
  CsError: class CsError extends Error {},
}));

vi.mock("../../../../v3/utils/logger.util.js", () => ({ v3Log: mockLog }));

const SECRET = "test-secret";

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

/** All log fields flattened to one string, for "must not contain" assertions. */
const loggedText = () => JSON.stringify(mockLog.mock.calls);
const loggedEvents = () => mockLog.mock.calls.map((c) => c[0]);
const payloadFor = (event: string) =>
  mockLog.mock.calls.filter((c) => c[0] === event).map((c) => c[1] ?? {});

const err = (status: number, message = "boom") => {
  const e = new Error(message) as Error & { status?: number };
  e.status = status;
  return e;
};

beforeEach(() => {
  mockList.mockReset().mockResolvedValue([]);
  mockGetV3Project.mockReset().mockResolvedValue(project());
  mockDelete.mockReset().mockResolvedValue({ folderRemoved: true, bytesReclaimed: 1024 });
  mockCreate
    .mockReset()
    .mockImplementation(async (_scope: any, input: any, meta: any) =>
      project({ id: meta.id, name: input.name, description: input.description })
    );
  mockLog.mockReset();
});

// ───────────────────────── API-1: the contract ─────────────────────────

describe("cs-project-lifecycle — DELETE /v3/project/:projectId", () => {
  it("TC_PL_001 (positive): returns 200 with the deleted flag and the project id", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, id: "P1" });
  });

  /*
    Negative — taxonomy #1 (missing input): a project the scoped read cannot resolve.
    404 rather than a 200-with-nothing-deleted, so the caller is never told a deletion
    happened that did not.
  */
  it("TC_PL_001 (negative): returns 404 when the scoped read finds no project", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(undefined);

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("TC_PL_002 (positive): echoes back the id that was actually deleted", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ id: "P-specific" }));

    const res = await request(app).delete("/v3/project/P-specific").set("app_token", token(SESSION));

    expect(res.body.id).toBe("P-specific");
  });

  /*
    Negative — taxonomy #2 (invalid shape): the response must not leak the project's
    name or description. The body is an acknowledgement, and this endpoint is the last
    place customer content should appear (NFR-2, and the same rule the create endpoint
    already follows for its logs).
  */
  it("TC_PL_002 (negative): returns no project name or description in the body", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ name: "Acme Production", description: "secret" }));

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(JSON.stringify(res.body)).not.toContain("Acme Production");
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("TC_PL_003 (positive): returns 404 for an id that does not exist", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(undefined);

    expect((await request(app).delete("/v3/project/nope").set("app_token", token(SESSION))).status).toBe(404);
  });

  // Negative — taxonomy #1: and it must not attempt the delete at all.
  it("TC_PL_003 (negative): does not call the store's delete for a non-existent id", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(undefined);

    await request(app).delete("/v3/project/nope").set("app_token", token(SESSION));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("TC_PL_004 (positive): returns 404 when the project is already deleted", async () => {
    const app = await makeGuardedApp();
    // The scoped read already filters deleted projects, so it resolves to nothing.
    mockGetV3Project.mockResolvedValue(undefined);

    expect((await request(app).delete("/v3/project/P1").set("app_token", token(SESSION))).status).toBe(404);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a store-level 404 raised DURING the
    delete must surface as 404 too, not 500. The record can be deleted between the
    scoped read and the delete call, and that race is a "gone", not a server fault.
  */
  it("TC_PL_004 (negative): maps a store 404 raised during the delete to a 404 response", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(err(404, "Project P1 does not exist"));

    expect((await request(app).delete("/v3/project/P1").set("app_token", token(SESSION))).status).toBe(404);
  });

  it("TC_PL_005 (positive): is not idempotent — the second delete returns 404", async () => {
    const app = await makeGuardedApp();

    const first = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));
    mockGetV3Project.mockResolvedValue(undefined); // the project is gone now
    const second = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect([first.status, second.status]).toEqual([200, 404]);
  });

  /*
    Negative — taxonomy #4: the second call must not report a deletion it did not
    perform. A 200 there would be a false confirmation the operator could act on.
  */
  it("TC_PL_005 (negative): the second delete does not report deleted: true", async () => {
    const app = await makeGuardedApp();
    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));
    mockGetV3Project.mockResolvedValue(undefined);

    const second = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(second.body.deleted).not.toBe(true);
  });

  it("TC_PL_006 (positive): returns 500 when the record write fails", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO: write failed"));

    expect((await request(app).delete("/v3/project/P1").set("app_token", token(SESSION))).status).toBe(500);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the 500 body must not carry the raw
    error text. Store errors quote the project id and can quote a path; the response
    gets a classification, not internals (NFR-2).
  */
  it("TC_PL_006 (negative): does not leak the raw store error text in the 500 body", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO writing /Users/someone/exportData/P1"));

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(JSON.stringify(res.body)).not.toContain("/Users/someone");
  });

  /*
    A folder-removal failure is NOT a failed delete. The record is already marked by
    then, so the project is gone from the operator's view; only the disk reclaim did
    not happen, and that is reported through the log rather than as an error.
  */
  it("TC_PL_007 (positive): returns 200 when the record was marked but the folder could not be removed", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: false, bytesReclaimed: 0 });

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
  });

  /*
    Negative — taxonomy #6: distinguishes the two failure kinds. A folder failure is
    200; a record-write failure is 500. Collapsing them either way misreports one.
  */
  it("TC_PL_007 (negative): still returns 500 when it is the record write that failed", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO: write failed"));

    expect((await request(app).delete("/v3/project/P1").set("app_token", token(SESSION))).status).toBe(500);
  });
});

// ───────────────────────── authorization and scope ─────────────────────────

describe("cs-project-lifecycle — DELETE authorization", () => {
  it("TC_PL_008 (positive): rejects a delete with no session token", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).delete("/v3/project/P1");

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #5 contrast: a valid token reaches the handler.
  it("TC_PL_008 (negative): a valid session token reaches the handler", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("TC_PL_009 (positive): rejects a token signed with the wrong secret", async () => {
    const app = await makeGuardedApp();
    const forged = jwt.sign(SESSION, "not-the-secret");

    const res = await request(app).delete("/v3/project/P1").set("app_token", forged);

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #5 (permission/scope).

    ⚠️ CORRECTED assertion. This originally expected 401 for a well-signed token
    carrying no user or region. That is not what any of the three documents specify: the
    guard verifies the SIGNATURE, and the scope is then built from the decoded payload,
    so a claim-less token yields an empty scope. Asserting 401 would have demanded a new
    auth rule this feature never agreed, and the real behaviour is already safe — an
    empty scope matches no record, because `inScope` compares region and owner by exact
    equality.

    So the assertion states the property that IS specified and is the one that matters:
    a claim-less token cannot reach any project. Recorded rather than quietly relaxed.
  */
  it("TC_PL_009 (negative): a well-signed token with no claims can reach no project", async () => {
    const app = await makeGuardedApp();
    // An empty scope resolves nothing, so the handler 404s before any delete.
    mockGetV3Project.mockResolvedValue(undefined);

    const res = await request(app).delete("/v3/project/P1").set("app_token", token({}));

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockGetV3Project).toHaveBeenCalledWith("P1", { region: "", owner: "" });
  });

  it("TC_PL_010 (positive): returns 404 for a project outside the caller's scope", async () => {
    const app = await makeGuardedApp();
    // The scoped read is what enforces this: out of scope resolves to nothing.
    mockGetV3Project.mockResolvedValue(undefined);

    const res = await request(app).delete("/v3/project/P-other").set("app_token", token(SESSION));

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #5: the scope handed to the read comes from the TOKEN. Asserting
    the argument is what proves the 404 above is a scope decision rather than a
    coincidence of the mock returning undefined.
  */
  it("TC_PL_010 (negative): resolves the project through the token's own scope", async () => {
    const app = await makeGuardedApp();

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(mockGetV3Project).toHaveBeenCalledWith("P1", expect.objectContaining({ region: "NA", owner: "U1" }));
  });

  /*
    The response for "does not exist" and "belongs to someone else" must be
    indistinguishable, or the endpoint becomes a probe for other operators' project ids.
  */
  it("TC_PL_011 (positive): returns identical responses for an unknown id and an out-of-scope project", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(undefined);

    const unknown = await request(app).delete("/v3/project/does-not-exist").set("app_token", token(SESSION));
    const foreign = await request(app).delete("/v3/project/someone-elses").set("app_token", token(SESSION));

    expect(unknown.status).toBe(foreign.status);
    expect(unknown.body).toEqual(foreign.body);
  });

  /*
    Negative — taxonomy #5: neither response may name the project or hint that it
    exists. "Not found" and "not yours" have to read the same.
  */
  it("TC_PL_011 (negative): neither response reveals that the project exists", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(undefined);

    const res = await request(app).delete("/v3/project/someone-elses").set("app_token", token(SESSION));

    const body = JSON.stringify(res.body).toLowerCase();
    expect(body).not.toContain("forbidden");
    expect(body).not.toContain("not yours");
    expect(body).not.toContain("permission");
  });

  it("TC_PL_012 (positive): ignores a region and owner supplied in the query string", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .delete("/v3/project/P1?region=EU&owner=someone-else")
      .set("app_token", token(SESSION));

    expect(mockGetV3Project).toHaveBeenCalledWith("P1", expect.objectContaining({ region: "NA", owner: "U1" }));
  });

  /*
    Negative — taxonomy #5: a body cannot override the scope either. Asserted
    separately because a handler reading `req.body` would pass the query-string test
    while still being overridable.
  */
  it("TC_PL_012 (negative): ignores a region and owner supplied in the request body", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .delete("/v3/project/P1")
      .set("app_token", token(SESSION))
      .send({ region: "EU", owner: "someone-else" });

    expect(mockGetV3Project).toHaveBeenCalledWith("P1", expect.objectContaining({ region: "NA", owner: "U1" }));
  });
});

// ───────────────────────── deletion observability ─────────────────────────

describe("cs-project-lifecycle — deletion logging", () => {
  it("TC_PL_062 (positive): logs a success event carrying the project id and outcome fields", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: true, bytesReclaimed: 4096 });

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    const [payload] = payloadFor("project.delete.succeeded");
    expect(payload).toMatchObject({ projectId: "P1", folderRemoved: true, bytesReclaimed: 4096 });
    expect(payload).toHaveProperty("durationMs");
  });

  // Negative — taxonomy #6: a failed delete must not log the success event.
  it("TC_PL_062 (negative): logs no success event when the delete fails", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO"));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedEvents()).not.toContain("project.delete.succeeded");
  });

  it("TC_PL_063 (positive): logs exactly one success event per successful delete", async () => {
    const app = await makeGuardedApp();

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(payloadFor("project.delete.succeeded")).toHaveLength(1);
  });

  /*
    Negative — taxonomy #3 (boundary): two deletes produce two lines, not one and not
    three. A single-emission rule that dropped the second would hide half the operator's
    history.
  */
  it("TC_PL_063 (negative): logs one event per delete across two deletes, not a single merged line", async () => {
    const app = await makeGuardedApp();

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));
    await request(app).delete("/v3/project/P2").set("app_token", token(SESSION));

    expect(payloadFor("project.delete.succeeded")).toHaveLength(2);
  });

  it("TC_PL_064 (positive): logs a failure event carrying the project id and a reason", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO"));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    const [payload] = payloadFor("project.delete.failed");
    expect(payload).toMatchObject({ projectId: "P1" });
    expect(payload).toHaveProperty("reason");
  });

  // Negative — taxonomy #6: a successful delete must not log the failure event.
  it("TC_PL_064 (negative): logs no failure event when the delete succeeds", async () => {
    const app = await makeGuardedApp();

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedEvents()).not.toContain("project.delete.failed");
  });

  it("TC_PL_065 (positive): reports only the fixed failure classifications", async () => {
    const app = await makeGuardedApp();
    const allowed = ["not_found", "folder_remove_failed", "internal"];

    mockGetV3Project.mockResolvedValue(undefined);
    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));
    mockGetV3Project.mockResolvedValue(project());
    mockDelete.mockRejectedValue(new Error("EIO"));
    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    const reasons = payloadFor("project.delete.failed").map((p: any) => p.reason);
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) expect(allowed).toContain(r);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the reason must never be the raw error
    message. Store errors quote the project id and can quote a filesystem path, so a
    passthrough would put both into the log the operator shares when reporting a bug.
  */
  it("TC_PL_065 (negative): never uses the raw error message as the reason", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockRejectedValue(new Error("EIO writing /Users/someone/exportData/P1"));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    const reasons = payloadFor("project.delete.failed").map((p: any) => p.reason);
    for (const r of reasons) expect(String(r)).not.toContain("/Users/someone");
  });

  it("TC_PL_066 (positive): reports the bytes reclaimed on the success event", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: true, bytesReclaimed: 167772160 });

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(payloadFor("project.delete.succeeded")[0]).toMatchObject({ bytesReclaimed: 167772160 });
  });

  /*
    Negative — taxonomy #1 (missing value): the field must be a number, never
    undefined or NaN. It is the only quantitative evidence that disk was reclaimed, so
    an unusable value defeats the reason it is logged.
  */
  it("TC_PL_066 (negative): reports a numeric bytes value rather than undefined or NaN", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: true, bytesReclaimed: 0 });

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    const { bytesReclaimed } = payloadFor("project.delete.succeeded")[0] as any;
    expect(typeof bytesReclaimed).toBe("number");
    expect(Number.isNaN(bytesReclaimed)).toBe(false);
  });

  it("TC_PL_067 (positive): reports folderRemoved false and zero bytes when there was no folder", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: false, bytesReclaimed: 0 });

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(payloadFor("project.delete.succeeded")[0]).toMatchObject({ folderRemoved: false, bytesReclaimed: 0 });
  });

  /*
    Negative — the flag must actually vary. Reporting false in both cases would make it
    useless, and would misreport a real reclaim as none.
  */
  it("TC_PL_067 (negative): reports folderRemoved true when a folder was removed", async () => {
    const app = await makeGuardedApp();
    mockDelete.mockResolvedValue({ folderRemoved: true, bytesReclaimed: 10 });

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(payloadFor("project.delete.succeeded")[0]).toMatchObject({ folderRemoved: true });
  });

  it("TC_PL_068 (positive): never logs the project name", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ name: "Acme Production Migration" }));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedText()).not.toContain("Acme Production Migration");
  });

  /*
    Negative — the paired proof that the log is not simply empty. The project id must
    be present, which is what makes the absence of the name meaningful.
  */
  it("TC_PL_068 (negative): does log the project id, so the omission of the name is deliberate", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ id: "P-logged", name: "Acme Production Migration" }));

    await request(app).delete("/v3/project/P-logged").set("app_token", token(SESSION));

    expect(loggedText()).toContain("P-logged");
  });

  it("TC_PL_069 (positive): never logs the project description", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ description: "Customer Q3 rollout notes" }));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedText()).not.toContain("Customer Q3 rollout notes");
  });

  // Negative — taxonomy #6: the description must stay out of the FAILURE line too.
  it("TC_PL_069 (negative): never logs the description on the failure path either", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(project({ description: "Customer Q3 rollout notes" }));
    mockDelete.mockRejectedValue(new Error("EIO"));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedText()).not.toContain("Customer Q3 rollout notes");
  });

  it("TC_PL_070 (positive): never logs the source stack api key", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(
      project({ source: { mode: "stack", stack: { stackApiKey: "blt_secret_key_123" } } })
    );

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedText()).not.toContain("blt_secret_key_123");
  });

  // Negative — taxonomy #6: nor on the failure path.
  it("TC_PL_070 (negative): never logs the stack api key on the failure path either", async () => {
    const app = await makeGuardedApp();
    mockGetV3Project.mockResolvedValue(
      project({ source: { mode: "stack", stack: { stackApiKey: "blt_secret_key_123" } } })
    );
    mockDelete.mockRejectedValue(new Error("EIO"));

    await request(app).delete("/v3/project/P1").set("app_token", token(SESSION));

    expect(loggedText()).not.toContain("blt_secret_key_123");
  });
});

// ───────────────────────── create: the rule at the HTTP boundary ─────────────────────────

describe("cs-project-lifecycle — POST /v3/project with a duplicate name", () => {
  it("TC_PL_083 (positive): returns 409 when the store reports a duplicate name", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Migration Test" });

    expect(res.status).toBe(409);
  });

  /*
    Negative — taxonomy #7 (conflict): a unique name must still be created. The rule is
    enforced at the store, so this proves the HTTP layer is not refusing everything.
  */
  it("TC_PL_083 (negative): still creates successfully for a name the store accepts", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Something Unique" });

    /*
      201, not 200. trd.md API-2 records the success status as "Response (200):
      Unchanged" — the INTENT (unchanged) is right but the value is wrong: the create
      endpoint has always returned 201 CREATED, as the neighbouring
      project.routes.test.ts asserts. Following the real unchanged behaviour here and
      reporting the document error, rather than changing an endpoint's status code to
      match a mistake in a spec.
    */
    expect(res.status).toBe(201);
  });

  it("TC_PL_090 (positive): the 409 body reveals nothing about the conflicting project", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Migration Test" });

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/P-other|owner|U2|EU/);
  });

  /*
    Negative — taxonomy #5 (scope): the 409 must not disclose the id of the project it
    collided with. Doing so would let a caller in one scope confirm which ids exist in
    another, which is the leak FR-3.6 exists to prevent.
  */
  it("TC_PL_090 (negative): the 409 body carries no project id at all", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Migration Test" });

    expect(JSON.stringify(res.body)).not.toContain("P1");
  });
});

// ───────────────────────── create: 400 before 409 ─────────────────────────

describe("cs-project-lifecycle — create validation precedence", () => {
  it("TC_PL_084 (positive): returns 400, not 409, for an empty name", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "" });

    expect(res.status).toBe(400);
  });

  /*
    Negative — taxonomy #1 (missing input): the uniqueness check must not even run for
    an invalid name. "You must provide a name" and "that name is taken" are different
    problems, and conflating them would tell the operator to change a name they never
    entered.
  */
  it("TC_PL_084 (negative): does not consult the store at all for an empty name", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "" });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("TC_PL_085 (positive): returns 400, not 409, for a whitespace-only name", async () => {
    const app = await makeGuardedApp();

    const res = await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "   " });

    expect(res.status).toBe(400);
  });

  // Negative — taxonomy #1: and it must not reach the store either.
  it("TC_PL_085 (negative): does not consult the store for a whitespace-only name", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "   " });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("TC_PL_086 (positive): returns 400, not 409, for a 201-character name", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(201) });

    expect(res.status).toBe(400);
  });

  /*
    Negative — taxonomy #3 (boundary): exactly 200 characters is accepted, so the
    length rule is unchanged by this feature and the 400 above is about length rather
    than about the new uniqueness path.
  */
  it("TC_PL_086 (negative): accepts a name of exactly 200 characters", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(200) });

    // 201, not 200 — see the note on TC_PL_083 (negative).
    expect(res.status).toBe(201);
  });

  it("TC_PL_087 (positive): returns 400 for a name with leading whitespace", async () => {
    const app = await makeGuardedApp();

    const res = await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: " Leading" });

    expect(res.status).toBe(400);
  });

  /*
    Negative — taxonomy #3: the pre-existing leading-whitespace rule must survive
    unchanged. A trimming uniqueness check could tempt an implementation to trim on
    input too, which would silently accept a name this endpoint has always rejected.
  */
  it("TC_PL_087 (negative): does not silently trim and accept a leading-whitespace name", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: " Leading" });

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ───────────────────────── create observability ─────────────────────────

describe("cs-project-lifecycle — create rejection logging", () => {
  it("TC_PL_104 (positive): logs a rejection event with reason duplicate_name", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Migration Test" });

    expect(payloadFor("project.create.rejected")[0]).toMatchObject({ reason: "duplicate_name" });
  });

  // Negative — taxonomy #7: a successful create logs no rejection event.
  it("TC_PL_104 (negative): logs no rejection event for a successful create", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "Fine" });

    expect(loggedEvents()).not.toContain("project.create.rejected");
  });

  it("TC_PL_105 (positive): never logs the rejected name", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Acme Production Migration" });

    expect(loggedText()).not.toContain("Acme Production Migration");
  });

  /*
    Negative — the rejected DESCRIPTION must stay out too. It is free-text customer
    content and is the field most likely to be added to a log line "for context".
  */
  it("TC_PL_105 (negative): never logs the rejected description", async () => {
    const app = await makeGuardedApp();
    mockCreate.mockRejectedValue(err(409, "A project with that name already exists."));

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "Dup", description: "Customer rollout secret" });

    expect(loggedText()).not.toContain("Customer rollout secret");
  });

  it("TC_PL_106 (positive): logs reason name_required for an empty name", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "" });

    expect(payloadFor("project.create.rejected")[0]).toMatchObject({ reason: "name_required" });
  });

  /*
    Negative — taxonomy #2 (invalid shape): the reason must distinguish the causes. An
    empty name reported as `duplicate_name` would send the operator looking for a
    conflicting project that does not exist.
  */
  it("TC_PL_106 (negative): does not report an empty name as duplicate_name", async () => {
    const app = await makeGuardedApp();

    await request(app).post("/v3/project").set("app_token", token(SESSION)).send({ name: "" });

    const reasons = payloadFor("project.create.rejected").map((p: any) => p.reason);
    expect(reasons).not.toContain("duplicate_name");
  });

  it("TC_PL_107 (positive): logs reason name_too_long for a 201-character name", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(201) });

    expect(payloadFor("project.create.rejected")[0]).toMatchObject({ reason: "name_too_long" });
  });

  /*
    Negative — taxonomy #3 (boundary): a 200-character name is not a rejection at all,
    so no rejection event may be logged for it.
  */
  it("TC_PL_107 (negative): logs no rejection event for a name of exactly 200 characters", async () => {
    const app = await makeGuardedApp();

    await request(app)
      .post("/v3/project")
      .set("app_token", token(SESSION))
      .send({ name: "x".repeat(200) });

    expect(loggedEvents()).not.toContain("project.create.rejected");
  });
});
