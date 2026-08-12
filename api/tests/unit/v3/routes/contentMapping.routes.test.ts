import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1b: the persist endpoint.
 *
 * Backs TC_CTS_124–130, TC_CTS_133–135, TC_CTS_151–153
 * (feature.md FR-9.3, FR-9.4, FR-9.9, NFR-3, NFR-4, NFR-9, EC-6, EC-7;
 * trd.md API-2, TR-21, TR-24, TR-25).
 *
 * The routes, the auth guard and the v3 error middleware all run for real; the
 * services and the store are mocked, because those are covered separately and
 * this file is about the HTTP contract — status codes, validation, scoping, and
 * the two rules that only exist at this boundary: no credential in a response,
 * and no credential in a log line.
 */
const {
  mockGetProject,
  mockSetSelection,
  mockGetSelection,
  mockBuildInventory,
  mockStackDataDir,
  mockDecryptSecret,
} = vi.hoisted(() => ({
  mockGetProject: vi.fn(),
  mockSetSelection: vi.fn(),
  mockGetSelection: vi.fn(),
  mockBuildInventory: vi.fn(),
  mockStackDataDir: vi.fn(),
  mockDecryptSecret: vi.fn(),
}));

vi.mock("../../../../v3/services/contentTypeInventory.service.js", () => ({
  buildContentTypeInventory: mockBuildInventory,
}));
vi.mock("../../../../v3/models/project.store.js", () => ({
  getV3Project: mockGetProject,
  setV3ContentTypeSelection: mockSetSelection,
  getV3ContentTypeSelection: mockGetSelection,
  getV3DestinationToken: vi.fn(async () => ({ uid: "mt", secretEncrypted: "enc:a:b:c" })),
  getV3AuditDecisions: vi.fn(),
  setV3AuditDecisions: vi.fn(),
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
vi.mock("../../../../v3/utils/secret.util.js", () => ({
  decryptSecret: mockDecryptSecret,
  encryptSecret: vi.fn(),
  assertSecretEncryptionConfigured: vi.fn(),
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

/** The content-mapping router without the auth guard, for contract tests. */
const makeOpenApp = async () => {
  vi.resetModules();
  const routes = (await import("../../../../v3/routes/contentMapping.routes.js")).default;
  const { v3ErrorMiddleware } = await import(
    "../../../../v3/middlewares/error.middleware.js"
  );
  const app = express();
  app.use(express.json());
  app.use("/project/:projectId/content-mapping", routes);
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
    stack: { stackApiKey: "blt-src-secret-key", branch: "main" },
    lastExport: { jobId: "j1", status: "succeeded" },
  },
  destination: { stackApiKey: "blt-dest", region: "NA", branch: "main" },
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const INVENTORY = {
  contentTypes: [
    { uid: "blog_article", title: "Blog Article", references: ["person"], existsInDestination: false },
    { uid: "landing_page", title: "Landing Page", references: [], existsInDestination: true },
    { uid: "person", title: "Person", references: [], existsInDestination: false },
  ],
  destinationRead: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProject.mockResolvedValue(PROJECT);
  mockBuildInventory.mockResolvedValue(INVENTORY);
  mockSetSelection.mockResolvedValue(undefined);
  mockGetSelection.mockResolvedValue(undefined);
  // Nested per project since 2026-08-12: stackDataDir(projectId, stackId).
  mockStackDataDir.mockReturnValue("/fake/exportData/P1/blt-src-secret-key");
  mockDecryptSecret.mockReturnValue("cs_plain_token");
});

const put = async (body: unknown, projectId = "P1") => {
  const app = await makeOpenApp();
  return request(app).put(`/project/${projectId}/content-mapping/selection`).send(body as any);
};

// ───────────────────────── API-2: accepting a selection ─────────────────────────

describe("v3 content mapping — persisting a selection", () => {
  it("TC_CTS_124 (positive): stores a valid selection and returns what was stored", async () => {
    mockGetSelection.mockResolvedValue({
      contentTypes: { blog_article: {}, landing_page: { conflictMode: "merge" } },
      updatedAt: "2026-08-10T00:00:00.000Z",
    });

    const res = await put({
      contentTypes: { blog_article: {}, landing_page: { conflictMode: "merge" } },
    });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.selection.contentTypes).sort()).toEqual([
      "blog_article",
      "landing_page",
    ]);
    expect(mockSetSelection).toHaveBeenCalledTimes(1);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a payload with no `contentTypes` map
    at all must be rejected rather than defaulted to empty. Defaulting would let
    a malformed request silently wipe a saved selection.
  */
  it("TC_CTS_124 (negative): rejects a payload with no contentTypes map and writes nothing", async () => {
    const res = await put({ somethingElse: true });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  it("TC_CTS_125 (positive): rejects a uid absent from the current inventory", async () => {
    const res = await put({ contentTypes: { not_in_export: {} } });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #3 (boundary): rejection must be all-or-nothing. A
    payload mixing one valid and one invalid uid must store NEITHER — a partial
    write would leave the operator with a selection they never chose and no
    error explaining the difference.
  */
  it("TC_CTS_125 (negative): stores no part of a payload that mixes a valid and an invalid uid", async () => {
    const res = await put({ contentTypes: { blog_article: {}, not_in_export: {} } });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  it("TC_CTS_126 (positive): rejects a conflict mode outside source, dest and merge", async () => {
    const res = await put({ contentTypes: { landing_page: { conflictMode: "overwrite" } } });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #3 (boundary): each of the three permitted values must be
    accepted. Without this, TC_CTS_126's positive is satisfied by a validator
    that rejects every mode, which would make the conflict control unusable.
  */
  it("TC_CTS_126 (negative): accepts each of the three permitted conflict modes", async () => {
    for (const mode of ["source", "dest", "merge"]) {
      vi.clearAllMocks();
      mockGetProject.mockResolvedValue(PROJECT);
      mockBuildInventory.mockResolvedValue(INVENTORY);
      mockSetSelection.mockResolvedValue(undefined);
      mockStackDataDir.mockReturnValue("/fake/dir");

      const res = await put({ contentTypes: { landing_page: { conflictMode: mode } } });

      expect(res.status, `mode ${mode} should be accepted`).toBe(200);
    }
  });

  it("TC_CTS_127 (positive): rejects a conflict mode on a content type absent from the destination", async () => {
    const res = await put({ contentTypes: { blog_article: { conflictMode: "merge" } } });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #6 (dependency failure): when the destination could not be
    read, NO content type is known to conflict, so a submitted mode cannot be
    validated and must be refused rather than trusted. Accepting it would record
    an intent to overwrite a destination schema the server never confirmed exists.
  */
  it("TC_CTS_127 (negative): rejects a conflict mode when the destination could not be read", async () => {
    mockBuildInventory.mockResolvedValue({
      contentTypes: INVENTORY.contentTypes.map((c) => ({ ...c, existsInDestination: false })),
      destinationRead: false,
      destinationReadFailure: "network",
    });

    const res = await put({ contentTypes: { landing_page: { conflictMode: "merge" } } });

    expect(res.status).toBe(400);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  it("TC_CTS_128 (positive): ignores an unexpected top-level key rather than storing it", async () => {
    await put({ contentTypes: { blog_article: {} }, injected: "value", updatedAt: "1999-01-01" });

    const stored = mockSetSelection.mock.calls[0]?.[1];
    expect(stored).toBeDefined();
    expect(stored.injected).toBeUndefined();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the same rule one level down. A per
    content type entry carrying an unexpected key must not reach the record
    either, or the shape DM-2 promises to interfaces 2 and 3 stops being a
    contract.
  */
  it("TC_CTS_128 (negative): strips an unexpected key from inside a content type entry", async () => {
    await put({ contentTypes: { blog_article: { smuggled: "x" } } });

    const stored = mockSetSelection.mock.calls[0]?.[1];
    expect(stored.contentTypes.blog_article.smuggled).toBeUndefined();
  });

  it("TC_CTS_129 (positive): rejects a selection for an unknown project without creating one", async () => {
    mockGetProject.mockResolvedValue(undefined);

    const res = await put({ contentTypes: { blog_article: {} } }, "GHOST");

    expect(res.status).toBe(404);
    expect(mockSetSelection).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #5 (permission denial): a project outside the caller's
    scope must be refused identically to an unknown one. A distinguishable
    response would confirm the project exists to a caller who should not know
    (NFR-4).
  */
  it("TC_CTS_129 (negative): refuses an out-of-scope project the same way as an unknown one", async () => {
    mockGetProject.mockResolvedValue(undefined);
    const unknown = await put({ contentTypes: { blog_article: {} } }, "GHOST");

    mockGetProject.mockResolvedValue(undefined);
    const outOfScope = await put({ contentTypes: { blog_article: {} } }, "P1");

    expect(outOfScope.status).toBe(unknown.status);
    expect(outOfScope.body).toEqual(unknown.body);
  });

  it("TC_CTS_130 (positive): refuses an unauthenticated persist and writes nothing", async () => {
    const app = await makeGuardedApp();
    const token = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    const res = await request(app)
      .put("/v3/project/P1/content-mapping/selection")
      .send({ contentTypes: { blog_article: {} } });

    expect(res.status).toBe(401);
    expect(mockSetSelection).not.toHaveBeenCalled();

    /*
      Anchored on an authenticated control. The guard 401s every path including
      ones that do not exist, so "401 without a session" passes before the route
      is even written. Proving the route is MOUNTED as well as guarded needs the
      authenticated case to get past the guard.
    */
    const authed = await request(app)
      .put("/v3/project/P1/content-mapping/selection")
      .set("app_token", token)
      .send({ contentTypes: { blog_article: {} } });
    expect(authed.status).not.toBe(401);
    expect(authed.status).not.toBe(404);
  });

  /*
    Negative — taxonomy #5 (permission denial): the read endpoint is guarded too.
    Guarding only the write would leave the inventory — which names every content
    type in a customer's stack — readable without a session.
  */
  it("TC_CTS_130 (negative): refuses an unauthenticated inventory read as well", async () => {
    const app = await makeGuardedApp();
    const token = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    const res = await request(app).get("/v3/project/P1/content-mapping/inventory");

    expect(res.status).toBe(401);
    expect(mockBuildInventory).not.toHaveBeenCalled();

    // Anchored, as above: the read route must exist and be reachable with a session.
    const authed = await request(app)
      .get("/v3/project/P1/content-mapping/inventory")
      .set("app_token", token);
    expect(authed.status).not.toBe(401);
    expect(authed.status).not.toBe(404);
  });
});

// ───────────────────────── credentials and logging ─────────────────────────

describe("v3 content mapping — credentials and logging", () => {
  it("TC_CTS_133 (positive): never includes the destination token in a successful response", async () => {
    const app = await makeOpenApp();

    const res = await request(app).get("/project/P1/content-mapping/inventory");

    expect(JSON.stringify(res.body)).not.toContain("cs_plain_token");
    expect(JSON.stringify(res.body)).not.toContain("enc:a:b:c");
  });

  /*
    Negative — taxonomy #6 (dependency failure): the failure path is where
    credentials usually leak, because error handlers stringify whatever they were
    given. A destination read that fails must not put the token into the body.
  */
  it("TC_CTS_133 (negative): never includes the destination token in a degraded response", async () => {
    mockBuildInventory.mockResolvedValue({
      contentTypes: [],
      destinationRead: false,
      destinationReadFailure: "unauthorized",
    });
    const app = await makeOpenApp();

    const res = await request(app).get("/project/P1/content-mapping/inventory");

    expect(JSON.stringify(res.body)).not.toContain("cs_plain_token");
  });

  it("TC_CTS_134 (positive): never logs the source stack api key or the export path", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuildInventory.mockRejectedValue(new Error("boom"));
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    const logged = [...spy.mock.calls, ...errSpy.mock.calls].flat().map(String).join(" ");
    expect(logged).not.toContain("blt-src-secret-key");
    spy.mockRestore();
    errSpy.mockRestore();
  });

  /*
    Negative — taxonomy #6 (dependency failure): a raw error string must not be
    logged in place of a fixed classification either. NFR-9 requires a
    classification precisely so that log output has a bounded vocabulary rather
    than whatever an upstream library chose to put in a message.
  */
  it("TC_CTS_134 (negative): logs a fixed failure classification rather than the raw error text", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockBuildInventory.mockResolvedValue({
      contentTypes: [],
      destinationRead: false,
      destinationReadFailure: "unauthorized",
    });
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    const logged = [...spy.mock.calls, ...errSpy.mock.calls].flat().map(String).join(" ");
    expect(logged).toContain("unauthorized");
  });

  it("TC_CTS_151 (positive): logs the content type count and destination outcome on a successful read", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("P1");
    expect(logged).toMatch(/contentTypes[":= ]*3/);
    spy.mockRestore();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the log line must not carry the
    content type NAMES. Titles are customer content; a count answers the
    operational question ("are inventories being built, how big are they")
    without putting a stack's model names into log storage.
  */
  it("TC_CTS_151 (negative): does not log the content type titles or uids", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("Blog Article");
    spy.mockRestore();
  });

  it("TC_CTS_152 (positive): logs a fixed classification when the destination read fails", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockBuildInventory.mockResolvedValue({
      contentTypes: [],
      destinationRead: false,
      destinationReadFailure: "network",
    });
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    expect(spy.mock.calls.flat().map(String).join(" ")).toContain("network");
    spy.mockRestore();
  });

  /*
    Negative — taxonomy #4 (forbidden state): a successful read must not emit a
    failure classification. A log that reports "network" on every request makes
    the field useless for spotting the real failures.
  */
  it("TC_CTS_152 (negative): logs no failure classification when the destination read succeeds", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await makeOpenApp();

    await request(app).get("/project/P1/content-mapping/inventory");

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toMatch(/network|unauthorized|not_found|unexpected/);
    spy.mockRestore();
  });

  it("TC_CTS_153 (positive): logs the selected count and the conflicting count on a persist", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await makeOpenApp();

    await request(app)
      .put("/project/P1/content-mapping/selection")
      .send({ contentTypes: { blog_article: {}, landing_page: { conflictMode: "merge" } } });

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).toMatch(/selected["':= ]*2/);
    expect(logged).toMatch(/conflict[A-Za-z]*["':= ]*1/);
    spy.mockRestore();
  });

  /*
    Negative — taxonomy #2 (invalid shape): the chosen conflict MODES must not be
    logged. Whether to record them is an open product decision (prd.md PQ-2 /
    trd.md TQ-6) about capturing user choices, so the default must be not to —
    a log added by accident is far harder to remove than one added deliberately.
  */
  it("TC_CTS_153 (negative): does not log which conflict mode the operator chose", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const app = await makeOpenApp();

    await request(app)
      .put("/project/P1/content-mapping/selection")
      .send({ contentTypes: { landing_page: { conflictMode: "merge" } } });

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("merge");
    spy.mockRestore();
  });
});

// ───────────────────────── API-1: reading the inventory ─────────────────────────

describe("v3 content mapping — reading the inventory", () => {
  const get = async (projectId = "P1", query = "") => {
    const app = await makeOpenApp();
    return request(app).get(`/project/${projectId}/content-mapping/inventory${query}`);
  };

  it("TC_CTS_114 (positive): returns the inventory, the reference graph and the destination indicator", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.contentTypes).toHaveLength(3);
    expect(res.body.contentTypes[0]).toMatchObject({
      uid: "blog_article",
      title: "Blog Article",
      references: ["person"],
    });
    expect(res.body.destinationRead).toBe(true);
  });

  /*
    Negative — taxonomy #1 (missing input): a project that has never saved a
    selection must return the inventory WITHOUT a selection field rather than an
    empty one. FR-9.5 hydrates from this response, and "never saved" must stay
    distinguishable from "saved, then emptied" (see TC_CTS_103 negative).
  */
  it("TC_CTS_114 (negative): omits the selection entirely when the project has never saved one", async () => {
    mockGetSelection.mockResolvedValue(undefined);

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.selection).toBeUndefined();
  });

  it("TC_CTS_115 (positive): returns every content type in one response with no paging", async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      uid: `ct_${i}`,
      title: `CT ${i}`,
      references: [],
      existsInDestination: false,
    }));
    mockBuildInventory.mockResolvedValue({ contentTypes: many, destinationRead: true });

    const res = await get();

    expect(res.body.contentTypes).toHaveLength(120);
  });

  /*
    Negative — taxonomy #2 (invalid shape): paging and search parameters must have
    NO effect. trd.md TC-1 puts filtering on the client; if the server quietly
    honoured a `limit`, the client's select-all would silently operate on a
    subset and FR-4.3 would break in a way nothing else would catch.
  */
  it("TC_CTS_115 (negative): ignores limit, skip and search query parameters", async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      uid: `ct_${i}`,
      title: `CT ${i}`,
      references: [],
      existsInDestination: false,
    }));
    mockBuildInventory.mockResolvedValue({ contentTypes: many, destinationRead: true });

    const res = await get("P1", "?limit=10&skip=5&q=ct_1");

    expect(res.body.contentTypes).toHaveLength(120);
  });

  it("TC_CTS_116 (positive): returns not found for a project that does not exist", async () => {
    mockGetProject.mockResolvedValue(undefined);

    const res = await get("GHOST");

    expect(res.status).toBe(404);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a missing project must not reach the
    filesystem at all. Building an export path from an unresolved project is how
    a path-traversal bug gets in — the project must be resolved first, always.
  */
  it("TC_CTS_116 (negative): does not touch the export directory for an unknown project", async () => {
    mockGetProject.mockResolvedValue(undefined);

    await get("GHOST");

    expect(mockStackDataDir).not.toHaveBeenCalled();
    expect(mockBuildInventory).not.toHaveBeenCalled();
  });

  it("TC_CTS_117 (positive): responds identically for an out-of-scope project and an unknown one", async () => {
    mockGetProject.mockResolvedValue(undefined);
    const unknown = await get("GHOST");
    mockGetProject.mockResolvedValue(undefined);
    const outOfScope = await get("P1");

    expect(outOfScope.status).toBe(unknown.status);
    expect(outOfScope.body).toEqual(unknown.body);
  });

  /*
    Negative — taxonomy #5 (permission denial): the scoped read must actually be
    scoped. `getV3Project` has to receive the caller's scope, not just the
    project id — a lookup by id alone would return another caller's project and
    make TC_CTS_117's positive unreachable in practice.
  */
  it("TC_CTS_117 (negative): resolves the project through a scoped lookup rather than by id alone", async () => {
    await get();

    // `getV3Project(projectId, scope)` — this store's existing argument order.
    expect(mockGetProject).toHaveBeenCalledWith(
      "P1",
      expect.objectContaining({ region: expect.any(String) })
    );
  });

  it("TC_CTS_118 (positive): returns a classified error when the export directory is missing", async () => {
    mockBuildInventory.mockRejectedValue(
      Object.assign(new Error("no export"), { code: "export_unreadable" })
    );

    const res = await get();

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("export_unreadable");
  });

  /*
    Negative — taxonomy #6 (dependency failure): a missing export must NOT come
    back as a 200 with an empty list. EC-1 and EC-3 are different states with
    different copy, and collapsing them tells an operator whose export failed
    that their stack has no content types.
  */
  it("TC_CTS_118 (negative): does not report a missing export as an empty successful inventory", async () => {
    mockBuildInventory.mockRejectedValue(
      Object.assign(new Error("no export"), { code: "export_unreadable" })
    );

    const res = await get();

    expect(res.status).not.toBe(200);
    expect(res.body.contentTypes).toBeUndefined();
  });

  it("TC_CTS_119 (positive): returns a classified error when the content type data is malformed", async () => {
    mockBuildInventory.mockRejectedValue(
      Object.assign(new SyntaxError("Unexpected token"), { code: "export_unreadable" })
    );

    const res = await get();

    expect(res.body.error).toBe("export_unreadable");
  });

  /*
    Negative — taxonomy #6 (dependency failure): the raw parser message must not
    reach the client. It carries a byte offset into a customer's export and adds
    nothing an operator can act on (NFR-3's spirit, NFR-9's classification rule).
  */
  it("TC_CTS_119 (negative): does not leak the raw parser message to the client", async () => {
    mockBuildInventory.mockRejectedValue(
      Object.assign(new SyntaxError("Unexpected token } in JSON at position 4821"), {
        code: "export_unreadable",
      })
    );

    const res = await get();

    expect(JSON.stringify(res.body)).not.toContain("position 4821");
  });

  it("TC_CTS_120 (positive): returns 200 with an empty inventory for an export containing no content types", async () => {
    mockBuildInventory.mockResolvedValue({ contentTypes: [], destinationRead: true });

    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.contentTypes).toEqual([]);
  });

  /*
    Negative — taxonomy #3 (boundary): an empty export is a success, so it must
    carry no error field at all. A response that is 200 AND carries an error is
    the ambiguous middle state that leaves the client guessing which branch to
    render.
  */
  it("TC_CTS_120 (negative): carries no error field on an empty but valid export", async () => {
    mockBuildInventory.mockResolvedValue({ contentTypes: [], destinationRead: true });

    const res = await get();

    expect(res.body.error).toBeUndefined();
  });

  it("TC_CTS_121 (positive): never returns the destination token in the inventory response", async () => {
    const res = await get();

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("cs_plain_token");
    expect(body).not.toContain("secretEncrypted");
  });

  /*
    Negative — taxonomy #5 (permission denial): the response must not carry the
    source stack api key either. It identifies the customer's stack and is the
    one value that turns an export path into a credential-adjacent string
    (trd.md §12).
  */
  it("TC_CTS_121 (negative): never returns the source stack api key or the export path", async () => {
    const res = await get();

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("blt-src-secret-key");
    /*
      ⚠️ Updated with the 2026-08-12 rename of `cmsMigrationData` → `exportData`.
      Left as the old name this assertion would still PASS — against a string that no
      longer appears anywhere in the codebase — quietly turning a leak check into a
      test of nothing. It has to name the directory actually in use.
    */
    expect(body).not.toContain("exportData");
  });

  it("TC_CTS_122 (positive): derives the export directory from the project, ignoring a supplied path", async () => {
    await get("P1", "?exportDir=/etc/passwd");

    // Both segments come from the resolved project, never from the request.
    expect(mockStackDataDir).toHaveBeenCalledWith("P1", "blt-src-secret-key");
  });

  /*
    Negative — taxonomy #2 (invalid shape): a traversal attempt in the parameter
    must never reach the inventory builder. Asserting only that `stackDataDir`
    was called leaves open that the attacker's path was passed alongside it.
  */
  it("TC_CTS_122 (negative): never passes a client-supplied path to the inventory builder", async () => {
    await get("P1", "?exportDir=..%2F..%2Fetc%2Fpasswd");

    const passed = JSON.stringify(mockBuildInventory.mock.calls[0]?.[0] ?? {});
    expect(passed).not.toContain("etc/passwd");
    expect(passed).not.toContain("..");
  });

  it("TC_CTS_123 (positive): builds no inventory for an unauthenticated read", async () => {
    const app = await makeGuardedApp();
    const valid = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);

    const res = await request(app).get("/v3/project/P1/content-mapping/inventory");

    expect(res.status).toBe(401);
    expect(mockBuildInventory).not.toHaveBeenCalled();

    // Anchored: the guard 401s unmounted paths too, so a valid session must be
    // shown to reach the route — otherwise this passes before it is written.
    const authed = await request(app)
      .get("/v3/project/P1/content-mapping/inventory")
      .set("app_token", valid);
    expect(authed.status).toBe(200);
  });

  /*
    Negative — taxonomy #5 (permission denial): a malformed or forged session
    token must be refused too, not merely an absent one. A guard that only checks
    for the header's presence would pass this.
  */
  it("TC_CTS_123 (negative): refuses a forged session token", async () => {
    const app = await makeGuardedApp();
    const forged = jwt.sign(TOKEN_PAYLOAD, "not-the-real-signing-key");

    const res = await request(app)
      .get("/v3/project/P1/content-mapping/inventory")
      .set("app_token", forged);

    expect(res.status).toBe(401);
    expect(mockBuildInventory).not.toHaveBeenCalled();

    // Anchored: a correctly-signed token on the same path must succeed, proving
    // the 401 came from signature verification rather than a missing route.
    const valid = jwt.sign(TOKEN_PAYLOAD, process.env.APP_TOKEN_KEY as string);
    const ok = await request(app)
      .get("/v3/project/P1/content-mapping/inventory")
      .set("app_token", valid);
    expect(ok.status).toBe(200);
  });

  it("TC_CTS_173 (positive): returns the persisted selection alongside the inventory", async () => {
    mockGetSelection.mockResolvedValue({
      contentTypes: { blog_article: {}, landing_page: { conflictMode: "dest" } },
      updatedAt: "2026-08-10T00:00:00.000Z",
    });

    const res = await get();

    expect(res.body.selection.contentTypes.landing_page.conflictMode).toBe("dest");
  });

  /*
    Negative — taxonomy #4 (forbidden state): the returned selection must be the
    STORED one, not a copy of the inventory. A response that echoed every content
    type as selected would make every project look fully selected on revisit —
    silently widening the migration scope.
  */
  it("TC_CTS_173 (negative): does not return every inventory content type as selected", async () => {
    mockGetSelection.mockResolvedValue({
      contentTypes: { blog_article: {} },
      updatedAt: "2026-08-10T00:00:00.000Z",
    });

    const res = await get();

    expect(Object.keys(res.body.selection.contentTypes)).toEqual(["blog_article"]);
  });
});
