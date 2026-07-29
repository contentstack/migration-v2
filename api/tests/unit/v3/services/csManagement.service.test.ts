import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TDD — v3 csManagement.service (listOrgs / listStacks / listBranches).
 * Backs TC_SRC_043 (listing endpoints return the expected shape), TC_SRC_049
 * (permission denial surfaced, not swallowed), TC_SRC_054 (zero orgs → empty).
 * feature.md FR-5.3, EC-1, EC-5. Mocks the two real boundaries: axios (network)
 * and the shared auth store (credential lookup).
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock("axios", () => ({ default: { get: mockGet } }));

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
  mockGetAuthtoken.mockReset();
  mockGetAccessToken.mockReset();
});

describe("v3 csManagement.service", () => {
  it("TC_SRC_043 (positive): listStacks maps the CS response to {apiKey,name}[] with org + auth headers", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({
      data: { stacks: [{ api_key: "blt1", name: "Stack 1" }, { api_key: "blt2", name: "Stack 2" }] },
    });

    const stacks = await csManagement.listStacks(TP, "org1");

    expect(stacks).toEqual([
      { apiKey: "blt1", name: "Stack 1" },
      { apiKey: "blt2", name: "Stack 2" },
    ]);
    // Host is environment-config (prod vs staging); assert the endpoint path + headers.
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/v3/stacks"),
      expect.objectContaining({
        headers: expect.objectContaining({ authtoken: "tok", organization_uid: "org1" }),
      })
    );
  });

  // Negative — taxonomy #6 (dependency failure): CS 500 surfaces as CsError 500.
  it("TC_SRC_043 (negative): a CS 500 is surfaced as an error carrying status 500", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockRejectedValue({ response: { status: 500, data: { error_message: "boom" } } });

    await expect(csManagement.listOrgs(TP)).rejects.toMatchObject({ status: 500, message: "boom" });
  });

  it("TC_SRC_049 (positive): a CS 401 is surfaced (not swallowed) with status 401", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockRejectedValue({ response: { status: 401, data: { error_message: "unauthorized" } } });

    await expect(csManagement.listOrgs(TP)).rejects.toMatchObject({ status: 401, message: "unauthorized" });
  });

  // Negative — taxonomy #5 (permission/credential): missing stored token → 401 before any CS call.
  it("TC_SRC_049 (negative): a missing stored credential is rejected 401 before any network call", async () => {
    mockGetAuthtoken.mockResolvedValue(null);

    await expect(csManagement.listOrgs(TP)).rejects.toMatchObject({ status: 401 });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("TC_SRC_054 (positive): zero organizations yields an empty list", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { user: { organizations: [] } } });

    expect(await csManagement.listOrgs(TP)).toEqual([]);
  });

  // Negative — taxonomy #2 (invalid/missing shape): no organizations field → [], not a crash.
  it("TC_SRC_054 (negative): a response missing the organizations field yields an empty list", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: {} });

    expect(await csManagement.listOrgs(TP)).toEqual([]);
  });
});

/**
 * Stack-scoped methods (getContentTypes / getStackModuleCounts) — back
 * TC_SRC_044 (stack-mode modules with counts). feature.md FR-5.4.
 */
describe("v3 csManagement.service — stack methods", () => {
  it("TC_SRC_044 (positive): getStackModuleCounts aggregates per-module counts from CS", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/entries")) {
        return Promise.resolve({ data: { count: url.includes("/a/") ? 3 : 2 } });
      }
      if (url.includes("/content_types")) {
        return Promise.resolve({ data: { content_types: [{ uid: "a" }, { uid: "b" }] } });
      }
      if (url.includes("/global_fields")) {
        return Promise.resolve({ data: { global_fields: [{ uid: "g" }] } });
      }
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 5 } });
      return Promise.resolve({ data: {} });
    });

    const counts = await csManagement.getStackModuleCounts(TP, "blt1", "main");
    expect(counts).toEqual({ contentTypes: 2, globalFields: 1, assets: 5, entries: 5 });
  });

  // Negative — taxonomy #6 (dependency failure): a failing count call degrades to 0, not a crash.
  it("TC_SRC_044 (negative): a failing assets count falls back to 0 while other counts stand", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/entries")) return Promise.resolve({ data: { count: 1 } });
      if (url.includes("/content_types")) return Promise.resolve({ data: { content_types: [{ uid: "a" }] } });
      if (url.includes("/global_fields")) return Promise.resolve({ data: { global_fields: [] } });
      if (url.includes("/assets")) return Promise.reject({ response: { status: 500 } });
      return Promise.resolve({ data: {} });
    });

    const counts = await csManagement.getStackModuleCounts(TP, "blt1");
    expect(counts.assets).toBe(0);
    expect(counts.contentTypes).toBe(1);
    expect(counts.entries).toBe(1);
  });

  it("TC_SRC_044 (positive): getContentTypes returns the CS content_types array with stack headers", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { content_types: [{ uid: "a" }, { uid: "b" }] } });

    const cts = await csManagement.getContentTypes(TP, "blt1", "main");
    expect(cts).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/content_types"),
      expect.objectContaining({
        headers: expect.objectContaining({ api_key: "blt1", branch: "main", authtoken: "tok" }),
      })
    );
  });

  // Negative — taxonomy #2 (invalid/missing shape): no content_types field → [], not a crash.
  it("TC_SRC_044 (negative): getContentTypes returns [] when the response has no content_types", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: {} });

    expect(await csManagement.getContentTypes(TP, "blt1")).toEqual([]);
  });
});
