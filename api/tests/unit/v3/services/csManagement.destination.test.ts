import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TDD — v3 csManagement.service, Destination additions:
 * `createStack` (trd.md TR-11 / API-4), `createManagementToken` (TR-13 / API-3)
 * and `getStackStats` (TR-14 / API-5).
 *
 * Supplementary paired coverage for the three new Contentstack calls the
 * Destination panel introduces — feature.md FR-1.5, FR-3.3, FR-10.2–10.4,
 * EC-3, EC-13, EC-14. Mocks the two real boundaries: axios (network) and the
 * shared auth store (credential lookup).
 */
const { mockGet, mockPost } = vi.hoisted(() => ({ mockGet: vi.fn(), mockPost: vi.fn() }));
vi.mock("axios", () => ({ default: { get: mockGet, post: mockPost } }));

const { mockGetAuthtoken, mockGetAccessToken } = vi.hoisted(() => ({
  mockGetAuthtoken: vi.fn(),
  mockGetAccessToken: vi.fn(),
}));
vi.mock("../../../../v3/models/auth.store.js", () => ({
  getAuthtoken: mockGetAuthtoken,
  getAccessToken: mockGetAccessToken,
}));

import { csManagement } from "../../../../v3/services/csManagement.service.js";

const TP = { region: "NA", user_id: "u1", is_sso: false };

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockGetAuthtoken.mockReset();
  mockGetAccessToken.mockReset();
  mockGetAuthtoken.mockResolvedValue("tok");
  vi.stubEnv("V3_RATE_LIMIT_BASE_DELAY_MS", "0");
});

describe("v3 csManagement.createStack", () => {
  it("(createStack, positive) posts to /stacks with the org header and maps the response to {apiKey,name}", async () => {
    mockPost.mockResolvedValue({
      data: { stack: { api_key: "blt-new", name: "production-eu", description: "EU marketing" } },
    });

    const stack = await csManagement.createStack(TP, "org1", "production-eu", "EU marketing");

    expect(stack).toEqual({
      apiKey: "blt-new",
      name: "production-eu",
      description: "EU marketing",
    });
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("/v3/stacks"),
      { stack: { name: "production-eu", description: "EU marketing" } },
      expect.objectContaining({
        headers: expect.objectContaining({ authtoken: "tok", organization_uid: "org1" }),
      })
    );
  });

  // Negative — taxonomy #7 (conflict): a Contentstack duplicate-name rejection is
  // surfaced as a 400-carrying error with Contentstack's own message (EC-3), not
  // swallowed and not retried into a second stack.
  it("(createStack, negative) a duplicate-name rejection surfaces as an error carrying status 400", async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { error_message: "A stack named 'production-eu' already exists." },
      },
    });

    await expect(
      csManagement.createStack(TP, "org1", "production-eu")
    ).rejects.toMatchObject({
      status: 400,
      message: "A stack named 'production-eu' already exists.",
    });
    expect(mockPost).toHaveBeenCalledOnce();
  });
});

describe("v3 csManagement.createManagementToken", () => {
  it("(createManagementToken, positive) creates a read+write token on the stack and returns its uid, name and one-time secret", async () => {
    mockPost.mockResolvedValue({
      data: { token: { uid: "tok1", name: "eu-marketing-import", token: "cs-secret-value" } },
    });

    const token = await csManagement.createManagementToken(TP, "blt1", "eu-marketing-import");

    expect(token).toEqual({
      uid: "tok1",
      name: "eu-marketing-import",
      secret: "cs-secret-value",
    });
    // Scoped read AND write on the destination stack (feature.md FR-3.3).
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("/v3/stacks/management_tokens"),
      expect.objectContaining({
        token: expect.objectContaining({
          name: "eu-marketing-import",
          scope: expect.arrayContaining([
            expect.objectContaining({ module: "content_type", acl: { read: true, write: true } }),
          ]),
        }),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ authtoken: "tok", api_key: "blt1" }),
      })
    );
  });

  // Negative — taxonomy #7 (conflict): a duplicate token name surfaces as a
  // 400-carrying error with Contentstack's message (EC-13); no token is minted.
  it("(createManagementToken, negative) a duplicate token name surfaces as an error carrying status 400", async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { error_message: "A management token named 'eu-marketing-import' already exists." },
      },
    });

    await expect(
      csManagement.createManagementToken(TP, "blt1", "eu-marketing-import")
    ).rejects.toMatchObject({
      status: 400,
      message: "A management token named 'eu-marketing-import' already exists.",
    });
  });
});

describe("v3 csManagement.listContentstackLocales", () => {
  it("(all-locales, positive) maps a normal array response to {code,name}[]", async () => {
    mockGet.mockResolvedValue({
      data: { locales: [{ code: "en-us", name: "English - United States" }] },
    });

    const locales = await csManagement.listContentstackLocales(TP);

    expect(locales).toEqual([{ code: "en-us", name: "English - United States" }]);
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/locales?include_all=true"),
      expect.objectContaining({ headers: expect.objectContaining({ authtoken: "tok" }) })
    );
  });

  // Negative — taxonomy #2 (invalid shape): this is the shape Contentstack ACTUALLY
  // returns — an object whose KEYS are the locale codes and whose VALUES are plain
  // display-name strings (confirmed against v2's AddStack, which does
  // `Object.keys(res.data.locales).map(k => ({ value: k, label: locales[k] }))`).
  // Treating it as an array throws; treating it as an object of objects silently
  // yields `{code: undefined}` for every entry and an empty picker.
  it("(all-locales, negative) an object of code→name strings is mapped, not dropped", async () => {
    mockGet.mockResolvedValue({
      data: {
        locales: {
          "en-us": "English - United States",
          "fr-fr": "French - France",
        },
      },
    });

    const locales = await csManagement.listContentstackLocales(TP);

    expect(locales).toEqual([
      { code: "en-us", name: "English - United States" },
      { code: "fr-fr", name: "French - France" },
    ]);
  });
});

describe("v3 csManagement.getStackStats", () => {
  it("(getStackStats, positive) a stack with content reports isEmpty false and labelled stat tiles", async () => {
    // content_types → 12, global_fields → 4, assets count → 1180, locales → 6, branches → 3
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/content_types")) {
        return Promise.resolve({ data: { content_types: new Array(12).fill({ uid: "ct" }) } });
      }
      if (url.includes("/global_fields")) {
        return Promise.resolve({ data: { global_fields: new Array(4).fill({ uid: "gf" }) } });
      }
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 1180 } });
      if (url.includes("/locales")) {
        return Promise.resolve({ data: { locales: new Array(6).fill({ code: "en-us" }) } });
      }
      if (url.includes("/branches")) {
        return Promise.resolve({ data: { branches: new Array(3).fill({ uid: "main" }) } });
      }
      return Promise.resolve({ data: {} });
    });

    const stats = await csManagement.getStackStats(TP, "blt1");

    expect(stats.isEmpty).toBe(false);
    expect(stats.stats).toEqual(
      expect.arrayContaining([
        { label: "Content types", value: "12" },
        { label: "Global fields", value: "4" },
        { label: "Assets", value: "1,180" },
      ])
    );
  });

  // Negative — taxonomy #1 (empty data): a brand-new stack with nothing in it reports
  // isEmpty true, which is what drives the empty-state copy (AC-9.2).
  it("(getStackStats, negative) a stack with no content types reports isEmpty true", async () => {
    mockGet.mockResolvedValue({ data: { content_types: [], global_fields: [], count: 0, locales: [], branches: [] } });

    const stats = await csManagement.getStackStats(TP, "blt-new");

    expect(stats.isEmpty).toBe(true);
  });
});
