import { describe, it, expect } from "vitest";
import { normalizeContentstackAuthorizeUrl } from "../../../src/utils/contentstack-oauth-url.utils.js";

describe("contentstack-oauth-url.utils", () => {
  it("rewrites hash SPA authorize URL to path-style", () => {
    expect(
      normalizeContentstackAuthorizeUrl(
        "https://app.contentstack.com/#!/apps/appUid123/authorize?response_type=code&client_id=c"
      )
    ).toBe(
      "https://app.contentstack.com/apps/appUid123/authorize?response_type=code&client_id=c"
    );
  });

  it("leaves path-style URLs unchanged", () => {
    const u =
      "https://eu-app.contentstack.com/apps/x/authorize?response_type=code&client_id=c";
    expect(normalizeContentstackAuthorizeUrl(u)).toBe(u);
  });

  it("returns empty or non-string input unchanged", () => {
    expect(normalizeContentstackAuthorizeUrl("")).toBe("");
    expect(normalizeContentstackAuthorizeUrl(undefined as unknown as string)).toBe(
      undefined
    );
    expect(normalizeContentstackAuthorizeUrl(null as unknown as string)).toBe(null);
  });
});
