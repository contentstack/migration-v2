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
