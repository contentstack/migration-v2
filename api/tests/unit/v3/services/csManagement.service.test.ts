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
  // No real backoff delay in tests — retry timing itself isn't under test.
  vi.stubEnv("V3_RATE_LIMIT_BASE_DELAY_MS", "0");
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

  // Regression: a real export against a live stack hit "Rate limit exceeded"
  // (HTTP 429) from Contentstack after a burst of calls, and the export was
  // simply abandoned. A transient 429 must be retried with backoff, not
  // treated as a hard failure.
  it("(rate-limit, positive) a single 429 is retried with backoff and the call still succeeds", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet
      .mockRejectedValueOnce({ response: { status: 429, data: { error_message: "Rate limit exceeded" } } })
      .mockResolvedValueOnce({ data: { user: { organizations: [{ uid: "o1", name: "Org 1" }] } } });

    const orgs = await csManagement.listOrgs(TP);

    expect(orgs).toEqual([{ uid: "o1", name: "Org 1" }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  // Negative — contrast: persistent 429s eventually give up and surface the
  // same CsError(429, ...) shape as any other failure, rather than retrying forever.
  it("(rate-limit, negative) persistent 429s eventually give up and surface a 429 CsError", async () => {
    vi.stubEnv("V3_RATE_LIMIT_MAX_RETRIES", "2");
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockRejectedValue({ response: { status: 429, data: { error_message: "Rate limit exceeded" } } });

    await expect(csManagement.listOrgs(TP)).rejects.toMatchObject({
      status: 429,
      message: "Rate limit exceeded",
    });
    expect(mockGet).toHaveBeenCalledTimes(3); // 1 initial attempt + 2 retries
  });

  // Negative — contrast: a non-429 error (e.g. 500) is NOT retried at all.
  it("(rate-limit, negative) a non-429 error is not retried", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockRejectedValue({ response: { status: 500, data: { error_message: "boom" } } });

    await expect(csManagement.listOrgs(TP)).rejects.toMatchObject({ status: 500 });
    expect(mockGet).toHaveBeenCalledTimes(1);
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

  it("(onItem, positive) getStackModuleCounts reports real sampled item names via onItem as each call resolves", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/entries")) {
        return Promise.resolve({
          data: url.includes("/a/")
            ? { count: 1, entries: [{ uid: "e1", title: "Welcome Post" }] }
            : { count: 1, entries: [{ uid: "e2", title: "About Page" }] },
        });
      }
      if (url.includes("/content_types")) {
        return Promise.resolve({
          data: { content_types: [{ uid: "a", title: "Blog Post" }, { uid: "b", title: "Page" }] },
        });
      }
      if (url.includes("/global_fields")) {
        return Promise.resolve({ data: { global_fields: [{ uid: "seo", title: "SEO" }] } });
      }
      if (url.includes("/assets")) {
        return Promise.resolve({ data: { count: 1, assets: [{ uid: "a1", filename: "hero.png" }] } });
      }
      return Promise.resolve({ data: {} });
    });

    const events: any[] = [];
    const counts = await csManagement.getStackModuleCounts(TP, "blt1", "main", undefined, (e) =>
      events.push(e)
    );

    expect(counts).toEqual({ contentTypes: 2, globalFields: 1, assets: 1, entries: 2 });
    expect(events).toEqual(
      expect.arrayContaining([
        { type: "globalField", name: "SEO" },
        { type: "asset", name: "hero.png" },
        { type: "entry", name: "Welcome Post", ctTitle: "Blog Post" },
        { type: "entry", name: "About Page", ctTitle: "Page" },
      ])
    );
  });

  // Negative — taxonomy #1 (missing/empty): with no onItem callback supplied, nothing throws
  // and counts are unaffected (the callback is a pure additive hook).
  it("(onItem, negative) omitting the onItem callback does not throw and counts are unaffected", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/entries")) return Promise.resolve({ data: { count: 1, entries: [{ uid: "e1", title: "X" }] } });
      if (url.includes("/content_types")) return Promise.resolve({ data: { content_types: [{ uid: "a", title: "A" }] } });
      if (url.includes("/global_fields")) return Promise.resolve({ data: { global_fields: [] } });
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 0, assets: [] } });
      return Promise.resolve({ data: {} });
    });

    await expect(csManagement.getStackModuleCounts(TP, "blt1")).resolves.toEqual({
      contentTypes: 1,
      globalFields: 0,
      assets: 0,
      entries: 1,
    });
  });

  // Regression: "Specific module" scope was decorative — getStackModuleCounts
  // always fetched/counted every module regardless of what was selected, so a
  // user who unchecked Assets/Entries still saw the full stack's totals in the
  // resulting content graph. A selection list must actually gate which
  // endpoints get called AND zero out the unselected counts.
  it("(scope, positive) a selectedModules list skips network calls for unselected modules and reports them as 0", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    const calledUrls: string[] = [];
    mockGet.mockImplementation((url: string) => {
      calledUrls.push(url);
      if (url.includes("/global_fields")) return Promise.resolve({ data: { global_fields: [{ uid: "g" }] } });
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 999 } }); // would leak in if not gated
      if (url.includes("/entries")) return Promise.resolve({ data: { count: 999 } }); // would leak in if not gated
      return Promise.resolve({ data: {} });
    });

    const cts = [{ uid: "a", title: "A" }, { uid: "b", title: "B" }];
    const counts = await csManagement.getStackModuleCounts(
      TP,
      "blt1",
      "main",
      cts,
      undefined,
      ["contentTypes", "globalFields"]
    );

    expect(counts).toEqual({ contentTypes: 2, globalFields: 1, assets: 0, entries: 0 });
    // Prove the gating actually skipped the network calls, rather than fetching
    // and discarding the result — a failing count would otherwise degrade to 0
    // via the existing .catch(), masking a broken gate as a passing test.
    expect(calledUrls.some((u) => u.includes("/assets"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/entries"))).toBe(false);
  });

  // Negative — contrast: omitting the selection (as the module-listing caller
  // does, to show real totals for every module before the user picks a scope)
  // still fetches and counts everything, unaffected by the new parameter.
  it("(scope, negative) omitting selectedModules still fetches and counts every module", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/entries")) return Promise.resolve({ data: { count: 2 } });
      if (url.includes("/global_fields")) return Promise.resolve({ data: { global_fields: [{ uid: "g" }] } });
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 5 } });
      return Promise.resolve({ data: {} });
    });

    const counts = await csManagement.getStackModuleCounts(TP, "blt1", "main", [{ uid: "a" }]);
    expect(counts).toEqual({ contentTypes: 1, globalFields: 1, assets: 5, entries: 2 });
  });

  // Real full-data pagination (used by the actual export-to-disk bundle
  // writer, distinct from the sampled/counted preview above). Backs the
  // "genuine export" feature: content_types/schema.json, global_fields, and
  // entries/assets in a real bundle need EVERY item, not a 6-item sample.
  it("(export, positive) getAllAssets pages through the full asset list until exhausted", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `a${i}`, filename: `f${i}.png` }));
    const page2 = [{ uid: "a100", filename: "f100.png" }];
    mockGet.mockImplementation((url: string) => {
      if (url.includes("skip=0")) return Promise.resolve({ data: { count: 101, assets: page1 } });
      if (url.includes("skip=100")) return Promise.resolve({ data: { count: 101, assets: page2 } });
      throw new Error(`unexpected page requested: ${url}`);
    });

    const assets = await csManagement.getAllAssets(TP, "blt1", "main");
    expect(assets).toHaveLength(101);
    expect(assets[0]).toEqual({ uid: "a0", filename: "f0.png" });
    expect(assets[100]).toEqual({ uid: "a100", filename: "f100.png" });
  });

  // Negative — taxonomy #1 (missing/empty): zero assets → one call, empty result, no crash.
  it("(export, negative) getAllAssets returns an empty array for a stack with zero assets", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { count: 0, assets: [] } });

    const assets = await csManagement.getAllAssets(TP, "blt1");
    expect(assets).toEqual([]);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("(export, positive) getAllEntries pages through every entry for a content type", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    const page1 = Array.from({ length: 100 }, (_, i) => ({ uid: `e${i}`, title: `Entry ${i}` }));
    const page2 = [{ uid: "e100", title: "Entry 100" }];
    mockGet.mockImplementation((url: string) => {
      if (url.includes("skip=0")) return Promise.resolve({ data: { count: 101, entries: page1 } });
      if (url.includes("skip=100")) return Promise.resolve({ data: { count: 101, entries: page2 } });
      throw new Error(`unexpected page requested: ${url}`);
    });

    const entries = await csManagement.getAllEntries(TP, "blt1", "main", "blog");
    expect(entries).toHaveLength(101);
    expect(entries[100]).toEqual({ uid: "e100", title: "Entry 100" });
  });

  // Negative — a content type with zero entries returns [] after one call.
  it("(export, negative) getAllEntries returns an empty array for a content type with no entries", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { count: 0, entries: [] } });

    const entries = await csManagement.getAllEntries(TP, "blt1", "main", "blog");
    expect(entries).toEqual([]);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("locale=en-us"),
      expect.anything()
    );
  });

  /*
    2026-08-05 — publish state.

    The exported entries carried NO `publish_details` key at all (verified: 0 of
    65 entries across every file in both exported stacks), because Contentstack's
    CMA does not return it on the entries LIST endpoint unless asked. A reference
    export taken with the Contentstack CLI has it on every entry — empty array
    where the record is published nowhere, one row per environment+locale where it
    is. Without it the Audit step's "unpublished entries" check has no data.
  */
  it("(publish details, positive) getAllEntries asks Contentstack for publish_details", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { count: 0, entries: [] } });

    await csManagement.getAllEntries(TP, "blt1", "main", "blog");

    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("include_publish_details=true"),
      expect.anything()
    );
  });

  /*
    Negative — taxonomy #3 (boundary/default): the caller's locale reaches the URL
    instead of silently collapsing to the `en-us` default.

    This is the regression guard for the bug being fixed. The export pulled ONE
    locale, so a three-locale stack exported 10 of its 28 entries and the other 18
    were dropped with no error — a migration would have reported success while
    leaving 64% of the content behind. Asserting the NON-default locale is what
    catches a reintroduced default.
  */
  it("(publish details, negative) a non-default locale is requested verbatim, not collapsed to en-us", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({ data: { count: 0, entries: [] } });

    await csManagement.getAllEntries(TP, "blt1", "main", "blog", "de");

    const [url] = mockGet.mock.calls[0];
    expect(url).toContain("locale=de");
    expect(url).not.toContain("locale=en-us");
  });

  /*
    `getAllLocales` belongs to the `getAll*` export family (raw, complete objects
    for writing to disk), not the `list*` picker family — `listLocales` maps down
    to `{code, name}` for a dropdown, which is not enough to write a real
    `locales.json`: that needs `uid` and `fallback_locale` too, and
    `fallback_locale` is what identifies the master locale.
  */
  it("(getAllLocales, positive) returns the complete locale objects for the stack's branch", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({
      data: {
        locales: [
          { uid: "l1", code: "en-us", name: "English - United States", fallback_locale: null },
          { uid: "l2", code: "de", name: "German", fallback_locale: "en-us" },
        ],
      },
    });

    const locales = await csManagement.getAllLocales(TP, "blt1", "main");

    // Complete objects, not narrowed — `fallback_locale` is load-bearing.
    expect(locales).toEqual([
      { uid: "l1", code: "en-us", name: "English - United States", fallback_locale: null },
      { uid: "l2", code: "de", name: "German", fallback_locale: "en-us" },
    ]);
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining("/locales"),
      expect.objectContaining({
        headers: expect.objectContaining({ api_key: "blt1", branch: "main" }),
      })
    );
  });

  /*
    Negative — taxonomy #2 (invalid shape): Contentstack has already been observed
    returning locales as an OBJECT rather than an array (that exact response broke
    the create-stack locale picker with "((intermediate value) ?? []).map is not a
    function"). Treated as an array this throws; the object form must be
    normalised, because falling back to `[]` here would export zero locales and
    therefore zero entries.
  */
  it("(getAllLocales, negative) an object-keyed response is normalised rather than dropped", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({
      data: {
        locales: {
          l1: { uid: "l1", code: "en-us", fallback_locale: null },
          l2: { uid: "l2", code: "fr", fallback_locale: "en-us" },
        },
      },
    });

    const locales = await csManagement.getAllLocales(TP, "blt1", "main");

    expect(locales.map((l: any) => l.code)).toEqual(["en-us", "fr"]);
  });

  it("(export, positive) getAllGlobalFields returns the full real global field definitions", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    mockGet.mockResolvedValue({
      data: { global_fields: [{ uid: "seo", title: "SEO", schema: [{ uid: "meta" }] }] },
    });

    const fields = await csManagement.getAllGlobalFields(TP, "blt1", "main");
    expect(fields).toEqual([{ uid: "seo", title: "SEO", schema: [{ uid: "meta" }] }]);
  });

  // Regression: entries counting must be dispatched in PARALLEL across content
  // types, not one-at-a-time. A sequential loop would only call the 2nd
  // content type's entries endpoint after the 1st has resolved — for a stack
  // with many content types this made "Specific module" feel hung. Proven by
  // holding every entries call pending and asserting ALL were issued before
  // any of them resolves.
  it("(regression) getStackModuleCounts dispatches per-content-type entries calls in parallel, not sequentially", async () => {
    mockGetAuthtoken.mockResolvedValue("tok");
    const cts = [{ uid: "a" }, { uid: "b" }, { uid: "c" }];
    const deferred: Record<string, { resolve: (v: any) => void }> = {};
    const entriesCalledFor = new Set<string>();

    mockGet.mockImplementation((url: string) => {
      // Check /entries FIRST — an entries URL also contains "/content_types/"
      // as a substring and would otherwise be swallowed by that branch.
      if (url.includes("/entries")) {
        const ctUid = cts.find((c) => url.includes(`/${c.uid}/entries`))!.uid;
        entriesCalledFor.add(ctUid);
        return new Promise((resolve) => {
          deferred[ctUid] = { resolve };
        });
      }
      if (url.includes("/content_types")) {
        return Promise.resolve({ data: { content_types: cts } });
      }
      if (url.includes("/global_fields")) return Promise.resolve({ data: { global_fields: [] } });
      if (url.includes("/assets")) return Promise.resolve({ data: { count: 0 } });
      return Promise.resolve({ data: {} });
    });

    const resultPromise = csManagement.getStackModuleCounts(TP, "blt1");
    // Flush a macrotask so every pending microtask chain ahead of the entries
    // loop (auth lookup, content-types fetch, global-fields/assets Promise.all)
    // has fully drained, regardless of how many .then() hops it takes.
    await new Promise((r) => setTimeout(r, 0));

    // All three entries calls must have been ISSUED already, before any resolves.
    expect(entriesCalledFor).toEqual(new Set(["a", "b", "c"]));

    cts.forEach((c) => deferred[c.uid].resolve({ data: { count: 1 } }));
    const counts = await resultPromise;
    expect(counts.entries).toBe(3);
  });
});
