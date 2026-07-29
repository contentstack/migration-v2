import { describe, it, expect } from "vitest";

import {
  resolveRegionCredential,
  RegionAuthError,
} from "../../../../v3/utils/region-credential.util.js";

/**
 * TDD — resolveRegionCredential. Backs the cross-region source-auth gate: a
 * region other than the session's home region requires a completed
 * region-login (regionUserId); otherwise the request is rejected (401) rather
 * than silently falling back to the session credential for the wrong region.
 */
const HOME = { region: "NA", user_id: "u1", is_sso: false };

describe("resolveRegionCredential", () => {
  it("(positive) no region requested falls back to the home credential", () => {
    expect(resolveRegionCredential(HOME, undefined, undefined)).toEqual(HOME);
  });

  // Negative — taxonomy #1 (missing/empty): no home credential at all → empty object, not a throw.
  it("(negative) no region and no home credential returns an empty credential, not a throw", () => {
    expect(resolveRegionCredential(undefined, undefined, undefined)).toEqual({});
  });

  it("(positive) requesting the home region returns the home credential unchanged", () => {
    expect(resolveRegionCredential(HOME, "NA", undefined)).toEqual(HOME);
  });

  // Negative — taxonomy #4 (forbidden state): a different region without regionUserId is rejected, not silently allowed.
  it("(negative) a different region without regionUserId throws RegionAuthError (401)", () => {
    expect(() => resolveRegionCredential(HOME, "EU", undefined)).toThrow(RegionAuthError);
    try {
      resolveRegionCredential(HOME, "EU", undefined);
      expect.unreachable();
    } catch (e) {
      expect((e as RegionAuthError).status).toBe(401);
    }
  });

  it("(positive) a different region WITH regionUserId returns a fresh non-SSO credential for it", () => {
    expect(resolveRegionCredential(HOME, "EU", "u2")).toEqual({
      region: "EU",
      user_id: "u2",
      is_sso: false,
    });
  });

  // Negative — contrast: the returned credential is scoped to the new region, not the home one.
  it("(negative) the resolved credential does not carry over the home region's user_id", () => {
    const resolved = resolveRegionCredential(HOME, "EU", "u2");
    expect(resolved.user_id).not.toBe(HOME.user_id);
  });
});
