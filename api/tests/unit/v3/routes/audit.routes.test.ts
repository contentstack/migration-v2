import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * TDD — cs-audit-report, Phase 1 tranche 2c: the five audit endpoints.
 *
 * Backs TC_AR_163–176 (feature.md NFR-6, EC-10, EC-16; trd.md API-1…API-5, TR-11,
 * TR-12, TR-13, TRR-4).
 *
 * The routes, the auth guard and the v3 error middleware all run for real; the
 * services and the store are mocked, because those are separately covered and this
 * file is about the HTTP contract — status codes, wire shapes, and the scoping and
 * path-safety rules that only exist at this boundary.
 */
const {
  mockStartScan,
  mockGetJob,
  mockReadCached,
  mockRunChecks,
  mockGetProject,
  mockGetDecisions,
  mockSetDecisions,
  mockResolveExclusions,
  mockDeriveImpact,
  mockStackDataDir,
} = vi.hoisted(() => ({
  mockStartScan: vi.fn(),
  mockGetJob: vi.fn(),
  mockReadCached: vi.fn(),
  mockRunChecks: vi.fn(),
  mockGetProject: vi.fn(),
  mockGetDecisions: vi.fn(),
  mockSetDecisions: vi.fn(),
  mockResolveExclusions: vi.fn(),
  mockDeriveImpact: vi.fn(),
  mockStackDataDir: vi.fn(),
}));

vi.mock("../../../../v3/services/auditScan.service.js", () => ({
  startAuditScan: mockStartScan,
  getAuditJob: mockGetJob,
  readCachedFindings: mockReadCached,
}));
vi.mock("../../../../v3/services/auditChecks.service.js", () => ({
  runAuditChecks: mockRunChecks,
}));
vi.mock("../../../../v3/services/auditDecisions.service.js", () => ({
  resolveExclusions: mockResolveExclusions,
  deriveImpact: mockDeriveImpact,
  EXCLUDABLE_CATEGORIES: ["unpublishedEntries", "unusedAssets"],
}));
vi.mock("../../../../v3/models/project.store.js", () => ({
  getV3Project: mockGetProject,
  getV3AuditDecisions: mockGetDecisions,
  setV3AuditDecisions: mockSetDecisions,
  upsertV3Source: vi.fn(),
  upsertV3Destination: vi.fn(),
  setV3Graph: vi.fn(),
  setV3DestinationToken: vi.fn(),
  listV3Projects: vi.fn(),
  createV3Project: vi.fn(),
}));
vi.mock("../../../../v3/utils/migrationData.util.js", () => ({
  stackDataDir: mockStackDataDir,
  migrationDataDir: vi.fn(() => "/fake/exportData"),
}));

/** The whole /v3 router, so the real auth guard is in the chain. */
const makeGuardedApp = async () => {
  vi.resetModules();
  const v3 = (await import("../../../../v3/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/v3", v3);
  return app;
};

/** The audit router without the auth guard, for contract tests. */
const makeOpenApp = async () => {
  vi.resetModules();
  const auditRoutes = (await import("../../../../v3/routes/audit.routes.js")).default;
  const { v3ErrorMiddleware } = await import(
    "../../../../v3/middlewares/error.middleware.js"
  );
  const app = express();
  app.use(express.json());
  // The real mount injects the token payload; here it is supplied per request.
  app.use("/project/:projectId/audit", auditRoutes);
  app.use(v3ErrorMiddleware);
  return app;
};

const TOKEN_PAYLOAD = { region: "NA", user_id: "u1", is_sso: false };

const PROJECT = {
  id: "P1",
  name: "Marketing stack sync",
  region: "NA",
  owner: "u1",
  isDeleted: false,
  source: {
    mode: "stack",
    stack: { stackApiKey: "blt-src", branch: "main" },
    lastExport: { jobId: "j1", status: "succeeded" },
  },
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const FINDINGS = {
  cacheKey: "2026-08-05T09:20:27.553Z",
  checks: [
    { id: "unusedAssets", label: "Unused assets — referenced by any entry?", state: "done", count: 4, items: [{ key: "asset:a1", category: "unusedAssets", type: "Asset", title: "orphan.png", uid: "a1", status: "Unused" }] },
    { id: "unpublishedEntries", label: "Unpublished entries — has publish details?", state: "done", count: 6, items: [{ key: "entry:blog:e1:en", category: "unpublishedEntries", type: "Entry", title: "Draft", uid: "e1", contentType: "blog", locale: "en", status: "Never published" }] },
    { id: "emptyContentTypes", label: "Empty content types — any entries at all?", state: "notPresent", items: [] },
    { id: "unusedGlobalFields", label: "Unused global fields — referenced by a schema?", state: "done", count: 1, items: [{ key: "globalField:gf1", category: "unusedGlobalFields", type: "Global field", title: "gf1", uid: "gf1", status: "Unreferenced" }] },
  ],
  totals: { contentTypes: 4, globalFields: 2, assets: 10, entryRecords: 20, denominator: 36 },
  modules: { contentTypes: true, globalFields: true, assets: true, entries: true },
  variantsInspected: false,
};

const DECISIONS = { categories: { unusedAssets: "exclude" }, itemOverrides: {} };

beforeEach(() => {
  [
    mockStartScan, mockGetJob, mockReadCached, mockRunChecks, mockGetProject,
    mockGetDecisions, mockSetDecisions, mockResolveExclusions, mockDeriveImpact,
    mockStackDataDir,
  ].forEach((m) => m.mockReset());

  mockGetProject.mockResolvedValue(PROJECT);
  // Nested per project since 2026-08-12: stackDataDir(projectId, stackId).
  mockStackDataDir.mockImplementation((pid: string, id: string) => `/fake/exportData/${pid}/${id}`);
  mockReadCached.mockReturnValue(FINDINGS);
  mockGetDecisions.mockResolvedValue(DECISIONS);
  mockSetDecisions.mockResolvedValue(undefined);
  mockResolveExclusions.mockReturnValue(new Set(["asset:a1"]));
  mockDeriveImpact.mockReturnValue({ denominator: 36, excluded: 1, migrating: 35 });
  mockStartScan.mockReturnValue("job-1");
  mockGetJob.mockReturnValue({
    jobId: "job-1",
    projectId: "P1",
    status: "running",
    checks: [
      { id: "unusedAssets", state: "done" },
      { id: "unpublishedEntries", state: "checking" },
      { id: "emptyContentTypes", state: "queued" },
      { id: "unusedGlobalFields", state: "queued" },
    ],
    resolvedCount: 1,
  });
});

// ───────────────────────── API-1 / API-2: run and poll ─────────────────────────

describe("v3 audit routes — start a scan (API-1)", () => {
  it("TC_AR_163 (positive): a valid request returns 202 with a job id", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .post("/project/P1/audit/run")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ jobId: "job-1" });
  });

  /*
    Negative — taxonomy #5 (permission denial): the project is outside the caller's
    scope, so the scoped read returns undefined. The response must be 404 —
    indistinguishable from a project that does not exist (EC-16), because answering
    "forbidden" would confirm the id is real.
  */
  it("TC_AR_164 (negative): a project outside the caller's scope returns 404 and starts no scan", async () => {
    const app = await makeOpenApp();
    mockGetProject.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/project/P1/audit/run")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(404);
    expect(mockStartScan).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #6 (dependency failure): the project exists but has no
    source stack recorded, so no export directory can be derived. It must fail
    before any scan begins rather than scanning a path built from nothing.

    Asserts **409** specifically, not merely "an error". API-1 defines 409 as
    "export directory unreadable", and no export at all is the strongest form of
    that; it is also what lets the client render the EC-1 error state rather than a
    generic failure. A `toBeGreaterThanOrEqual(400)` here would pass against the
    unimplemented stub's 500 — a vacuous assertion that proves nothing.
  */
  it("TC_AR_165 (negative): a project with no recorded source stack is rejected 409 without starting a scan", async () => {
    const app = await makeOpenApp();
    mockGetProject.mockResolvedValue({ ...PROJECT, source: undefined });

    const res = await request(app)
      .post("/project/P1/audit/run")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(409);
    expect(mockStartScan).not.toHaveBeenCalled();
    expect(mockStackDataDir).not.toHaveBeenCalled();
  });

  it("TC_AR_166 (positive): polling a running job returns its per-check states and resolved count", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit/run/job-1")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("running");
    expect(res.body.resolvedCount).toBe(1);
    expect(res.body.checks).toHaveLength(4);
    expect(res.body.checks[1]).toEqual({ id: "unpublishedEntries", state: "checking" });
  });

  /*
    Negative — taxonomy #1 (missing input): an unknown job id, which is every id
    after an api restart because the registry is in-memory (TRR-1). 404 tells the
    client to start a new scan; a 500 would strand the panel.
  */
  it("TC_AR_166 (negative): polling an unknown job id returns 404 rather than an error", async () => {
    const app = await makeOpenApp();
    mockGetJob.mockReturnValue(undefined);

    const res = await request(app)
      .get("/project/P1/audit/run/no-such-job")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(404);
  });
});

// ───────────────────────── API-3: read findings ─────────────────────────

describe("v3 audit routes — read findings (API-3)", () => {
  it("TC_AR_167 (positive): cached findings come back with the decisions and the derived impact", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(res.body.findings.totals.denominator).toBe(36);
    expect(res.body.decisions).toEqual(DECISIONS);
    expect(res.body.impact).toEqual({ denominator: 36, excluded: 1, migrating: 35 });
  });

  /*
    Negative — taxonomy #1 (missing input): no cache document for the current
    export. 404 is what tells the client to start a scan, so it is a normal part of
    the flow rather than an error condition (AC-1.4's inverse).
  */
  it("TC_AR_168 (negative): no cached findings returns 404 so the client knows to scan", async () => {
    const app = await makeOpenApp();
    mockReadCached.mockReturnValue(undefined);

    const res = await request(app)
      .get("/project/P1/audit")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(404);
  });

  it("TC_AR_167b (positive): a check that did not run carries no count key on the wire", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit")
      .send({ token_payload: TOKEN_PAYLOAD });

    const notPresent = res.body.findings.checks.find(
      (c: any) => c.id === "emptyContentTypes"
    );
    // TC_AR_049's assertion, at the layer that produces the wire format: the
    // absent key is what makes FR-2.11 impossible to violate in the renderer.
    expect(notPresent.state).toBe("notPresent");
    expect(Object.prototype.hasOwnProperty.call(notPresent, "count")).toBe(false);
  });

  /*
    Negative — taxonomy #5 (information disclosure): the findings response must not
    carry the flagged items themselves. API-3 is the summary; the items come from
    API-4 one page at a time, and shipping all of them here would send tens of
    thousands of rows on a large stack — the exact thing pagination exists to avoid.
  */
  it("TC_AR_167 (negative): the findings summary omits the flagged item inventory", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit")
      .send({ token_payload: TOKEN_PAYLOAD });

    for (const c of res.body.findings.checks) {
      expect(c).not.toHaveProperty("items");
    }
  });
});

// ───────────────────────── API-4: read items ─────────────────────────

describe("v3 audit routes — read items (API-4)", () => {
  it("TC_AR_169 (positive): a page of items comes back with paging metadata and per-filter counts", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit/items?filter=all&page=1&pageSize=50")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toMatchObject({ page: 1 });
    expect(res.body).toHaveProperty("pageCount");
    expect(res.body).toHaveProperty("total");
    // Counts for every pill, computed over the whole set rather than the page, so a
    // pill never shows a count that only describes what is on screen (FR-6.5).
    expect(res.body.counts).toMatchObject({
      all: expect.any(Number),
      entries: expect.any(Number),
      assets: expect.any(Number),
      contentTypes: expect.any(Number),
      globalFields: expect.any(Number),
    });
  });

  it("TC_AR_169b (positive): a category filter narrows the returned items server-side", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit/items?filter=assets")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(res.body.items.every((i: any) => i.category === "unusedAssets")).toBe(true);
  });

  /*
    Negative — taxonomy #3 (boundary): a page number past the last page. A
    client-error status is required rather than an empty 200, because an empty 200
    is indistinguishable from "this filter matches nothing" and the table would show
    its no-results copy for what is really a bad request.
  */
  it("TC_AR_170 (negative): a page beyond the last page is a client error, not an empty success", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit/items?page=999")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(400);
  });

  it("TC_AR_170 (positive): the last valid page returns the remaining rows rather than a client error", async () => {
    const app = await makeOpenApp();

    // The good side of the same boundary TC_AR_170's negative tests: the final page
    // is in range even though it holds fewer than a full page of rows.
    const res = await request(app)
      .get("/project/P1/audit/items?page=1&pageSize=2")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.length).toBeLessThanOrEqual(2);
  });

  /*
    Negative — taxonomy #3 (boundary): an unbounded `pageSize`. Left uncapped, a
    client can ask for every row and defeat pagination — the response-size risk
    recorded as TQ-6.
  */
  it("TC_AR_170b (negative): an excessive pageSize is capped rather than honoured", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .get("/project/P1/audit/items?pageSize=100000")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeLessThanOrEqual(50);
  });
});

// ───────────────────────── API-5: write decisions ─────────────────────────

describe("v3 audit routes — write decisions (API-5)", () => {
  it("TC_AR_171 (positive): a valid decision set is stored and the write is idempotent", async () => {
    const app = await makeOpenApp();
    const body = {
      token_payload: TOKEN_PAYLOAD,
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: { "asset:a1": "include" },
    };

    const first = await request(app).put("/project/P1/audit/decisions").send(body);
    const second = await request(app).put("/project/P1/audit/decisions").send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockSetDecisions).toHaveBeenCalledTimes(2);

    const [, a] = mockSetDecisions.mock.calls[0];
    const [, b] = mockSetDecisions.mock.calls[1];

    /*
      Idempotent in the DECISIONS, which is what the contract claims — a full replace,
      so repeating it stores the same choices rather than merging or accumulating.

      `updatedAt` is deliberately excluded from the comparison. It is stamped by the
      server, so two calls a millisecond apart legitimately differ; comparing whole
      payloads made this assertion pass only when both writes happened to land in the
      same millisecond, and it failed under full-suite load. Asserting the content and
      then asserting the timestamp's OWNERSHIP separately is the sharper claim.
    */
    expect(a.categories).toEqual(b.categories);
    expect(a.itemOverrides).toEqual(b.itemOverrides);
    expect(a.itemOverrides).toEqual({ 'asset:a1': 'include' });
    // Server-owned, present on both, and never taken from the request body.
    expect(typeof a.updatedAt).toBe('string');
    expect(typeof b.updatedAt).toBe('string');
  });

  it("TC_AR_172 (positive): both well-formed key shapes are accepted and stored verbatim", async () => {
    const app = await makeOpenApp();

    const res = await request(app).put("/project/P1/audit/decisions").send({
      token_payload: TOKEN_PAYLOAD,
      categories: {},
      itemOverrides: {
        "entry:blog:blt55e10ab:de": "exclude",
        "asset:blt4973c80edf306cf8": "include",
      },
    });

    expect(res.status).toBe(200);
    const [, stored] = mockSetDecisions.mock.calls[0];
    // Stored exactly as given — these keys are the contract Content mapping will
    // read (FR-7.3, INT-4), so normalising them here would silently break it.
    expect(stored.itemOverrides).toEqual({
      "entry:blog:blt55e10ab:de": "exclude",
      "asset:blt4973c80edf306cf8": "include",
    });
  });

  /*
    Negative — taxonomy #2 (invalid shape): a malformed override key. Rejecting at
    the boundary keeps garbage out of the store, which matters because these keys
    are the contract Content mapping will read (FR-7.3, INT-4).
  */
  it("TC_AR_172 (negative): a malformed override key is rejected 400 and nothing is stored", async () => {
    const app = await makeOpenApp();

    const res = await request(app).put("/project/P1/audit/decisions").send({
      token_payload: TOKEN_PAYLOAD,
      categories: {},
      itemOverrides: { "not-a-valid-key": "exclude" },
    });

    expect(res.status).toBe(400);
    expect(mockSetDecisions).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4 (forbidden state): a category state naming a
    non-excludable category is rejected at the boundary. Content types and global
    fields always migrate (A-4); accepting such a state would store an instruction
    the resolver is required to ignore, which is a lie in the record.
  */
  it("TC_AR_172b (negative): a state for a non-excludable category is rejected and nothing is stored", async () => {
    const app = await makeOpenApp();

    const res = await request(app).put("/project/P1/audit/decisions").send({
      token_payload: TOKEN_PAYLOAD,
      categories: { emptyContentTypes: "exclude" },
      itemOverrides: {},
    });

    expect(res.status).toBe(400);
    expect(mockSetDecisions).not.toHaveBeenCalled();
  });

  it("TC_AR_171b (positive): the token payload is stripped from what is stored", async () => {
    const app = await makeOpenApp();

    await request(app).put("/project/P1/audit/decisions").send({
      token_payload: TOKEN_PAYLOAD,
      categories: { unusedAssets: "exclude" },
      itemOverrides: {},
    });

    const [, stored] = mockSetDecisions.mock.calls[0];
    // The session payload rides in on the body via the auth middleware; it must not
    // be persisted onto the project record.
    expect(stored).not.toHaveProperty("token_payload");
    expect(stored.categories).toEqual({ unusedAssets: "exclude" });
  });
});

// ───────────────────────── security ─────────────────────────

describe("v3 audit routes — authentication and scoping", () => {
  it("TC_AR_173 (positive): with a valid app_token the request passes the guard and reaches the handler", async () => {
    const app = await makeGuardedApp();
    const token = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    const res = await request(app)
      .post("/v3/project/P1/audit/run")
      .set("app_token", token)
      .send({});

    expect(res.status).toBe(202);
    expect(mockStartScan).toHaveBeenCalledOnce();
  });

  /*
    Negative — taxonomy #5 (permission denial): no session. Every one of the five
    endpoints must reject, not just the mutating ones — the findings and items reads
    expose an inventory of a customer's content.
  */
  it("TC_AR_173 (negative): every audit endpoint called without an app_token is rejected 401", async () => {
    const app = await makeGuardedApp();

    const calls = [
      request(app).post("/v3/project/P1/audit/run").send({}),
      request(app).get("/v3/project/P1/audit/run/job-1"),
      request(app).get("/v3/project/P1/audit"),
      request(app).get("/v3/project/P1/audit/items"),
      request(app).put("/v3/project/P1/audit/decisions").send({ categories: {}, itemOverrides: {} }),
    ];

    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
    }
    expect(mockStartScan).not.toHaveBeenCalled();
    expect(mockReadCached).not.toHaveBeenCalled();
    expect(mockSetDecisions).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #5 (permission denial): region and owner supplied in the
    body and the query string must be ignored. Scope comes from the verified token
    only (NFR-6); honouring the request would let any caller enumerate another
    user's projects.
  */
  it("TC_AR_174 (negative): region and owner supplied by the caller are ignored in favour of the token", async () => {
    const app = await makeGuardedApp();
    const token = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    await request(app)
      .get("/v3/project/P1/audit?region=EU&owner=someone-else")
      .set("app_token", token)
      .send({ region: "EU", owner: "someone-else", token_payload: { region: "EU", user_id: "attacker" } });

    const [, scope] = mockGetProject.mock.calls[0];
    expect(scope).toEqual({ region: "NA", owner: "u1" });
  });

  it("TC_AR_175 (positive): the owning user in the owning region reads their own project", async () => {
    const app = await makeGuardedApp();
    const token = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    const res = await request(app).get("/v3/project/P1/audit").set("app_token", token);

    expect(res.status).toBe(200);
    expect(mockGetProject).toHaveBeenCalledWith("P1", { region: "NA", owner: "u1" });
  });

  /*
    Negative — taxonomy #5 (permission denial): another user's project, and a
    project in another region, both read as not found — the same answer a
    non-existent id gets, so nothing is confirmed (EC-16).
  */
  it("TC_AR_175 (negative): another user's project is indistinguishable from one that does not exist", async () => {
    const app = await makeOpenApp();
    mockGetProject.mockResolvedValue(undefined);

    const others = await Promise.all([
      request(app).get("/project/P1/audit").send({ token_payload: TOKEN_PAYLOAD }),
      request(app).get("/project/does-not-exist/audit").send({ token_payload: TOKEN_PAYLOAD }),
    ]);

    expect(others[0].status).toBe(404);
    expect(others[1].status).toBe(404);
    expect(others[0].body).toEqual(others[1].body);
  });

  it("TC_AR_176 (positive): the export directory is derived from the project's stored source, not the URL", async () => {
    const app = await makeOpenApp();

    await request(app)
      .post("/project/P1/audit/run")
      .send({ token_payload: TOKEN_PAYLOAD });

    /*
      The ordering TRR-4's mitigation depends on: the project is resolved first, and
      the path is built from what IT holds — never from the URL segment.

      Strengthened 2026-08-12: the path now carries the resolved project's OWN id as
      well, so a request for one project can no longer land on another project's
      export directory even if both record the same source stack.
    */
    expect(mockStackDataDir).toHaveBeenCalledWith("P1", "blt-src");
    const [{ exportDir }] = mockStartScan.mock.calls[0];
    expect(exportDir).toBe("/fake/exportData/P1/blt-src");
  });

  /*
    Negative — taxonomy #5 (permission denial / path traversal): a traversal-shaped
    project id. This is the first v3 endpoint family to turn a URL segment into a
    filesystem lookup, so the ordering must be proven, not assumed: the id is used
    only as a store key, the scoped read misses, and nothing touches the filesystem.
  */
  it("TC_AR_176 (negative): a traversal-shaped project id is not found and reaches no filesystem call", async () => {
    const app = await makeOpenApp();
    mockGetProject.mockResolvedValue(undefined);

    const res = await request(app)
      .get("/project/..%2F..%2F..%2Fetc%2Fpasswd/audit")
      .send({ token_payload: TOKEN_PAYLOAD });

    expect(res.status).toBe(404);
    expect(mockStackDataDir).not.toHaveBeenCalled();
    expect(mockReadCached).not.toHaveBeenCalled();
  });
});
