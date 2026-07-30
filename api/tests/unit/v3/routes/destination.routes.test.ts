import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * TDD — v3 destination routes (HTTP/route behavior via supertest).
 * Backs TC_DEST_052 (every Destination endpoint requires a valid app_token).
 * The remaining pairs are supplementary endpoint-contract coverage for the four
 * new endpoints (trd.md API-1…API-5): create-stack, management-token, stack
 * stats, and destination persist/read. feature.md NFR-1, FR-8.2, EC-3, EC-13.
 *
 * Contentstack + the data layer are mocked; the routes, auth middleware and v3
 * error middleware run for real.
 */
const { mockCs, mockGetV3Project, mockUpsertV3Destination } = vi.hoisted(() => ({
  mockCs: {
    createStack: vi.fn(),
    createManagementToken: vi.fn(),
    getStackStats: vi.fn(),
  },
  mockGetV3Project: vi.fn(),
  mockUpsertV3Destination: vi.fn(),
}));

vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: mockCs,
  CsError: class CsError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "CsError";
    }
  },
}));
vi.mock("../../../../v3/models/project.store.js", () => ({
  getV3Project: mockGetV3Project,
  upsertV3Destination: mockUpsertV3Destination,
  upsertV3Source: vi.fn(),
  setV3Graph: vi.fn(),
}));

/** The whole /v3 router, so the real auth guard is in the chain (TC_DEST_052). */
const makeGuardedApp = async () => {
  vi.resetModules();
  const v3 = (await import("../../../../v3/index.js")).default;
  const app = express();
  app.use(express.json());
  app.use("/v3", v3);
  return app;
};

/** Destination routers mounted WITHOUT the auth guard, for contract tests. */
const makeOpenApp = async () => {
  vi.resetModules();
  const destinationRoutes = (await import("../../../../v3/routes/destination.routes.js")).default;
  const projectDestinationRoutes = (
    await import("../../../../v3/routes/projectDestination.routes.js")
  ).default;
  const { v3ErrorMiddleware } = await import(
    "../../../../v3/middlewares/error.middleware.js"
  );
  const app = express();
  app.use(express.json());
  app.use("/destination", destinationRoutes);
  app.use("/org/:orgId/project/:projectId/destination", projectDestinationRoutes);
  app.use(v3ErrorMiddleware);
  return app;
};

const validDestination = () => ({
  region: "NA",
  orgId: "o1",
  stack: { apiKey: "blt1", name: "Production — EU", wasCreated: false },
  importAuth: { method: "authToken" },
  branchMapping: { srcBranch: "main", destBranch: "main" },
  masterLocaleMapping: { srcLocale: "en-us", destLocale: "en-us" },
  additionalLanguageMappings: [],
});

beforeEach(() => {
  Object.values(mockCs).forEach((m) => (m as any).mockReset());
  mockGetV3Project.mockReset();
  mockUpsertV3Destination.mockReset();
});

describe("v3 destination routes — auth", () => {
  it("TC_DEST_052 (positive): a destination endpoint called without an app_token is rejected 401", async () => {
    const app = await makeGuardedApp();
    const res = await request(app)
      .post("/v3/destination/stacks")
      .send({ orgId: "o1", name: "production-eu" });

    expect(res.status).toBe(401);
    expect(mockCs.createStack).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #5 (permission denial, contrast): with a VALID app_token the
  // same call passes the guard and reaches the handler.
  it("TC_DEST_052 (negative): the same call with a valid app_token passes the guard and reaches the handler", async () => {
    const app = await makeGuardedApp();
    mockCs.createStack.mockResolvedValue({ apiKey: "blt-new", name: "production-eu" });
    const token = jwt.sign(
      { region: "NA", user_id: "u1", is_sso: false },
      process.env.APP_TOKEN_KEY as string
    );

    const res = await request(app)
      .post("/v3/destination/stacks")
      .set("app_token", token)
      .send({ orgId: "o1", name: "production-eu" });

    expect(res.status).toBe(201);
    expect(mockCs.createStack).toHaveBeenCalledOnce();
  });
});

describe("v3 destination routes — create stack (API-4)", () => {
  it("(create-stack, positive) a valid request returns 201 with the created stack identity", async () => {
    const app = await makeOpenApp();
    mockCs.createStack.mockResolvedValue({ apiKey: "blt-new", name: "production-eu" });

    const res = await request(app)
      .post("/destination/stacks")
      .send({ orgId: "o1", name: "production-eu", description: "EU marketing" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ apiKey: "blt-new", name: "production-eu" });
  });

  // Negative — taxonomy #1 (missing input): no name → 400 with the required-field
  // message, and Contentstack is never called.
  it("(create-stack, negative) a missing name is rejected 400 without calling Contentstack", async () => {
    const app = await makeOpenApp();

    const res = await request(app).post("/destination/stacks").send({ orgId: "o1" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/'name' is required/);
    expect(mockCs.createStack).not.toHaveBeenCalled();
  });

  it("(create-stack collision, positive) a Contentstack name collision surfaces as 400 with its message", async () => {
    const app = await makeOpenApp();
    const { CsError } = await import("../../../../v3/services/csManagement.service.js");
    mockCs.createStack.mockRejectedValue(
      new (CsError as any)(400, "A stack named 'production-eu' already exists in this organization.")
    );

    const res = await request(app)
      .post("/destination/stacks")
      .send({ orgId: "o1", name: "production-eu" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already exists/);
  });

  // Negative — taxonomy #7 (conflict, contrast): a unique name on the same path
  // succeeds with 201, so the 400 above is the collision and not a blanket failure.
  it("(create-stack collision, negative) a unique name on the same path returns 201", async () => {
    const app = await makeOpenApp();
    mockCs.createStack.mockResolvedValue({ apiKey: "blt-2", name: "production-eu-2" });

    const res = await request(app)
      .post("/destination/stacks")
      .send({ orgId: "o1", name: "production-eu-2" });

    expect(res.status).toBe(201);
  });
});

describe("v3 destination routes — management token (API-3)", () => {
  it("(management-token, positive) a valid request returns 201 with the token uid, name and secret", async () => {
    const app = await makeOpenApp();
    mockCs.createManagementToken.mockResolvedValue({
      uid: "tok1",
      name: "eu-marketing-import",
      secret: "cs-secret",
    });

    const res = await request(app)
      .post("/destination/management-tokens")
      .send({ stackApiKey: "blt1", name: "eu-marketing-import" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ uid: "tok1", name: "eu-marketing-import" });
  });

  // Negative — taxonomy #1 (missing input): no stackApiKey → 400, no Contentstack call.
  it("(management-token, negative) a missing stackApiKey is rejected 400 without minting a token", async () => {
    const app = await makeOpenApp();

    const res = await request(app)
      .post("/destination/management-tokens")
      .send({ name: "eu-marketing-import" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/'stackApiKey' is required/);
    expect(mockCs.createManagementToken).not.toHaveBeenCalled();
  });

  it("(management-token collision, positive) a duplicate token name surfaces as 400 with its message", async () => {
    const app = await makeOpenApp();
    const { CsError } = await import("../../../../v3/services/csManagement.service.js");
    mockCs.createManagementToken.mockRejectedValue(
      new (CsError as any)(
        400,
        "A management token named 'eu-marketing-import' already exists on this stack."
      )
    );

    const res = await request(app)
      .post("/destination/management-tokens")
      .send({ stackApiKey: "blt1", name: "eu-marketing-import" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already exists on this stack/);
  });

  // Negative — taxonomy #7 (conflict, contrast): a unique token name returns 201.
  it("(management-token collision, negative) a unique token name returns 201", async () => {
    const app = await makeOpenApp();
    mockCs.createManagementToken.mockResolvedValue({
      uid: "tok2",
      name: "eu-marketing-import-2",
      secret: "cs-secret",
    });

    const res = await request(app)
      .post("/destination/management-tokens")
      .send({ stackApiKey: "blt1", name: "eu-marketing-import-2" });

    expect(res.status).toBe(201);
  });
});

describe("v3 destination routes — stack stats (API-5)", () => {
  it("(stats, positive) an empty destination stack reports isEmpty true with no stat tiles", async () => {
    const app = await makeOpenApp();
    mockCs.getStackStats.mockResolvedValue({ isEmpty: true, stats: [] });

    const res = await request(app).get("/destination/stacks/blt-new/stats");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isEmpty: true, stats: [] });
  });

  // Negative — taxonomy #6 (dependency failure): an unknown stack surfaces as 404
  // rather than an empty-looking 200.
  it("(stats, negative) an unknown stack surfaces as 404, not an empty 200", async () => {
    const app = await makeOpenApp();
    const { CsError } = await import("../../../../v3/services/csManagement.service.js");
    mockCs.getStackStats.mockRejectedValue(new (CsError as any)(404, "Stack not found."));

    const res = await request(app).get("/destination/stacks/nope/stats");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe("Stack not found.");
  });
});

describe("v3 destination routes — persist / read (API-1, API-2)", () => {
  it("(persist, positive) a valid destination is saved and echoed back", async () => {
    const app = await makeOpenApp();
    const dest = validDestination();
    mockUpsertV3Destination.mockResolvedValue(dest);

    const res = await request(app).put("/org/O1/project/P1/destination").send(dest);

    expect(res.status).toBe(200);
    expect(res.body.destination).toMatchObject({ region: "NA", orgId: "o1" });
    expect(mockUpsertV3Destination).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #2 (invalid shape): an unrecognised importAuth.method is
  // rejected 400 and nothing is written.
  it("(persist, negative) an unrecognised importAuth.method is rejected 400 and writes nothing", async () => {
    const app = await makeOpenApp();
    const bad = { ...validDestination(), importAuth: { method: "sso-magic" } };

    const res = await request(app).put("/org/O1/project/P1/destination").send(bad);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/'management' or 'authToken'/);
    expect(mockUpsertV3Destination).not.toHaveBeenCalled();
  });

  it("(read, positive) a persisted destination is returned 200", async () => {
    const app = await makeOpenApp();
    mockGetV3Project.mockResolvedValue({ id: "P1", destination: validDestination() });

    const res = await request(app).get("/org/O1/project/P1/destination");

    expect(res.status).toBe(200);
    expect(res.body.destination).toMatchObject({ region: "NA" });
  });

  // Negative — taxonomy #1 (missing data): no persisted destination yet → 404, which
  // the UI treats as the normal first-visit state.
  it("(read, negative) a project with no persisted destination returns 404", async () => {
    const app = await makeOpenApp();
    mockGetV3Project.mockResolvedValue({ id: "P1" });

    const res = await request(app).get("/org/O1/project/P1/destination");

    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/No destination selection found/);
  });
});
