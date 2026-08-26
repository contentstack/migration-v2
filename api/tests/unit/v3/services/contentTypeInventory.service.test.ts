import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1a: the inventory and the
 * reference graph.
 *
 * Backs TC_CTS_001 … TC_CTS_023
 * (feature.md FR-1.1 … FR-1.6, FR-2.1 … FR-2.4; trd.md TR-1 … TR-5).
 *
 * Real filesystem I/O against a throwaway temp directory, following the audit
 * reader's precedent: the export on disk IS this unit's subject, so mocking the
 * filesystem would test nothing. The ONE real boundary is the Contentstack
 * Management API read of the destination's content types — that is mocked,
 * because it is network (trd.md INT-5).
 *
 * The distinction FR-1.1 draws is load-bearing and easy to lose: the inventory
 * comes from the export on DISK, never from the source stack over the network.
 * TC_CTS_001/002 pin that by asserting the source stack is never called at all.
 */
const { mockListDestinationContentTypes } = vi.hoisted(() => ({
  mockListDestinationContentTypes: vi.fn(),
}));

/*
  Mocks the ONE network boundary (trd.md INT-5).

  `getDestinationContentTypes` is new. Every existing destination read in
  `csManagement` authenticates with the signed-in user's authtoken plus a stack
  api key (`getContentTypes`, `getStackStats`, `listStacks`). feature.md FR-2.1
  requires this read to use the stored destination MANAGEMENT token instead, and
  no such path exists yet — so TR-3 is new work rather than a reuse. Recorded in
  the report; the seam is mocked here at the shape it will be built to.
*/
vi.mock("../../../../v3/services/csManagement.service.js", () => ({
  csManagement: {
    getDestinationContentTypes: mockListDestinationContentTypes,
  },
}));

import {
  buildContentTypeInventory,
} from "../../../../v3/services/contentTypeInventory.service.js";

const TMP = path.join(os.tmpdir(), `v3-cts-inventory-${process.pid}`);

const writeSchema = (dir: string, contentTypes: unknown[]): void => {
  const p = path.join(dir, "content_types", "schema.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(contentTypes, null, 2));
};

/** A content type with an explicit field list. */
const ct = (uid: string, title: string, schema: unknown[] = []) => ({
  uid,
  title,
  schema,
});

const textField = (uid: string) => ({ uid, data_type: "text" });
const refField = (uid: string, to: string[]) => ({
  uid,
  data_type: "reference",
  reference_to: to,
});
const group = (uid: string, schema: unknown[], multiple = false) => ({
  uid,
  data_type: "group",
  multiple,
  schema,
});
const blocks = (uid: string, blockDefs: { uid: string; schema: unknown[] }[]) => ({
  uid,
  data_type: "blocks",
  multiple: true,
  blocks: blockDefs,
});
const globalField = (uid: string, schema: unknown[]) => ({
  uid,
  data_type: "global_field",
  schema,
});

let dir: string;

beforeEach(() => {
  dir = path.join(TMP, `case-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  mockListDestinationContentTypes.mockReset();
  mockListDestinationContentTypes.mockResolvedValue([]);
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

/*
  Edges for one content type, as the confirmation logic consumes them.

  Throws rather than defaulting to `[]` when the content type is absent. With a
  `?? []` fallback, "this type has no references" and "this type was never built"
  are the same assertion — which made every edge test pass against an empty
  inventory. Anchoring here means each edge assertion also proves the row exists.
*/
const edgesOf = (inv: Awaited<ReturnType<typeof buildContentTypeInventory>>, uid: string) => {
  const row = inv.contentTypes.find((c) => c.uid === uid);
  if (!row) throw new Error(`content type "${uid}" is absent from the inventory`);
  return row.references;
};

const rowFor = (inv: Awaited<ReturnType<typeof buildContentTypeInventory>>, uid: string) =>
  inv.contentTypes.find((c) => c.uid === uid);

// ───────────────────────── inventory source (FR-1.1, FR-1.2) ─────────────────────────

describe("v3 content type inventory — where the list comes from", () => {
  it("TC_CTS_001 (positive): builds the list from the export on disk without contacting the source stack", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article"), ct("person", "Person")]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes.map((c) => c.uid)).toEqual(["blog_article", "person"]);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the source stack is not a
    collaborator of this unit at all. FR-1.1 says the inventory is read from disk;
    the only way to prove that is to show no source-stack call is ever made. A
    version that quietly fetched would still return the right list here, so
    asserting the list alone would not catch it.
  */
  it("TC_CTS_002 (negative): makes no source-stack call while building the inventory", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const inv = await buildContentTypeInventory({ exportDir: dir });

    // Anchored: the inventory really was built, so "no calls" is not merely
    // "nothing ran".
    expect(inv.contentTypes.map((c) => c.uid)).toEqual(["blog_article"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockListDestinationContentTypes).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  /*
    Negative — taxonomy #1 (missing input): an export directory with no content
    type data is a failure state, not an empty stack. Returning an empty list
    would render as "this stack has no content types", which EC-1 and EC-3
    explicitly require to be distinguishable.
  */
  it("TC_CTS_001 (negative): reports a missing export rather than returning an empty list", async () => {
    const empty = path.join(TMP, "no-export-here");
    fs.mkdirSync(empty, { recursive: true });

    await expect(buildContentTypeInventory({ exportDir: empty })).rejects.toMatchObject({
      code: "export_unreadable",
    });
  });

  it("TC_CTS_002 (positive): makes exactly one outbound call — the destination read — when a destination is configured", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockResolvedValue([]);

    await buildContentTypeInventory({
      exportDir: dir,
      destination: { region: "na", stackApiKey: "blt_dest", token: "cs_tok", branch: "main" },
    });

    expect(mockListDestinationContentTypes).toHaveBeenCalledTimes(1);
  });

  it("TC_CTS_003 (positive): exposes both the uid and the display title for each content type", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(rowFor(inv, "blog_article")).toMatchObject({
      uid: "blog_article",
      title: "Blog Article",
    });
  });

  /*
    Negative — taxonomy #1 (missing input): a content type with no `title` must
    still be listed and identifiable. Dropping it, or surfacing `undefined` as a
    display name, would leave a row the operator cannot recognise (FR-1.2).
  */
  it("TC_CTS_003 (negative): falls back to the uid when a content type carries no title", async () => {
    writeSchema(dir, [{ uid: "orphan_type", schema: [] }]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(rowFor(inv, "orphan_type")).toMatchObject({
      uid: "orphan_type",
      title: "orphan_type",
    });
  });
});

// ───────────────────────── reference graph (FR-1.3 … FR-1.6) ─────────────────────────

describe("v3 content type inventory — the reference graph", () => {
  it("TC_CTS_004 (positive): records an edge for a top-level reference field", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [refField("author", ["person"])]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a non-reference field must produce no
    edge. Without this, a graph builder that indiscriminately reads
    `reference_to` — or that treats every field as an edge — would pass every
    positive above while inventing dependencies that do not exist, and the
    untick confirmation would fire on content types nothing references.
  */
  it("TC_CTS_004 (negative): records no edge for a field that is not a reference", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [textField("title"), textField("body")]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual([]);
  });

  it("TC_CTS_005 (positive): finds a reference nested inside a group", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        group("byline", [textField("role"), refField("writer", ["person"])]),
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  /*
    Negative — taxonomy #3 (boundary): the recursion must not stop at one level.
    A group inside a group inside a group is the boundary case that separates a
    real walk from a single `.schema` peek (FR-1.4).
  */
  it("TC_CTS_005 (negative): finds a reference three group levels deep, not just one", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        group("outer", [group("middle", [group("inner", [refField("writer", ["person"])])])]),
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  it("TC_CTS_006 (positive): finds a reference nested inside a modular block type", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        blocks("page_sections", [
          { uid: "hero", schema: [textField("heading")] },
          { uid: "product_card", schema: [refField("product", ["product"])] },
        ]),
      ]),
      ct("product", "Product"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["product"]);
  });

  /*
    Negative — taxonomy #1 (missing input): a modular block field whose `blocks`
    array is absent or empty must contribute nothing and must not throw. Real
    exports contain block fields that were never given a block type.
  */
  it("TC_CTS_006 (negative): contributes no edge for a modular block field with no block types", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        { uid: "page_sections", data_type: "blocks", multiple: true },
      ]),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual([]);
  });

  it("TC_CTS_007 (positive): finds a reference nested inside a global field's schema", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        globalField("seo", [textField("meta_title"), refField("owner", ["person"])]),
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  /*
    Negative — taxonomy #1 (missing input): a global field reference whose schema
    is not inlined in the export contributes nothing rather than throwing. The
    exporter does not always inline global field schemas, so this is the shape a
    real export produces (feature.md DEP-2).
  */
  it("TC_CTS_007 (negative): contributes no edge for a global field with no inlined schema", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        { uid: "seo", data_type: "global_field", reference_to: "seo_global" },
      ]),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual([]);
  });

  it("TC_CTS_008 (positive): records one edge per target when a reference names three content types", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        refField("related", ["person", "product", "category"]),
      ]),
      ct("person", "Person"),
      ct("product", "Product"),
      ct("category", "Category"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article").sort()).toEqual(["category", "person", "product"]);
  });

  /*
    Negative — taxonomy #7 (conflict/duplicate): two reference fields pointing at
    the same content type are one dependency, not two. A duplicated edge would
    make the confirmation dialog name "Blog Article" twice (FR-6.3).
  */
  it("TC_CTS_008 (negative): records a single edge when two fields reference the same content type", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        refField("author", ["person"]),
        refField("reviewer", ["person"]),
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  it("TC_CTS_009 (positive): excludes a content type's self-reference from its edges", async () => {
    writeSchema(dir, [
      ct("person", "Person", [refField("mentor", ["person"])]),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "person")).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): excluding the self-edge must not
    also discard genuine edges from the same content type. A naive "drop every
    edge on a self-referencing type" would satisfy TC_CTS_009's positive and
    silently lose the dependency the confirmation exists to protect.
  */
  it("TC_CTS_009 (negative): keeps other edges on a content type that also references itself", async () => {
    writeSchema(dir, [
      ct("person", "Person", [
        refField("mentor", ["person"]),
        refField("employer", ["company"]),
      ]),
      ct("company", "Company"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "person")).toEqual(["company"]);
  });

  it("TC_CTS_010 (positive): ignores a reference naming a content type absent from the export", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [refField("author", ["deleted_type"])]),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual([]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): `reference_to` appears in real
    exports as a bare string as well as an array. Neither form may throw, and
    both must resolve when the target exists.
  */
  it("TC_CTS_010 (negative): accepts a reference_to given as a bare string rather than an array", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        { uid: "author", data_type: "reference", reference_to: "person" },
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  it("TC_CTS_011 (positive): reflects the current export when the schema changes between builds", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [refField("author", ["person"])]),
      ct("person", "Person"),
    ]);
    const first = await buildContentTypeInventory({ exportDir: dir });
    expect(edgesOf(first, "blog_article")).toEqual(["person"]);

    writeSchema(dir, [
      ct("blog_article", "Blog Article", [refField("owner", ["company"])]),
      ct("company", "Company"),
    ]);
    const second = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(second, "blog_article")).toEqual(["company"]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a content type removed from the
    export must disappear from the inventory entirely, not linger from a cached
    earlier build. FR-9.6's pruning depends on the inventory being the current
    truth.
  */
  it("TC_CTS_011 (negative): drops a content type that the new export no longer contains", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article"), ct("retired_type", "Retired")]);
    await buildContentTypeInventory({ exportDir: dir });

    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    const second = await buildContentTypeInventory({ exportDir: dir });

    // Anchored on the surviving content type: an empty inventory would satisfy
    // the absence assertion on its own.
    expect(second.contentTypes.map((c) => c.uid)).toEqual(["blog_article"]);
    expect(rowFor(second, "retired_type")).toBeUndefined();
  });

  it("TC_CTS_012 (positive): completes without error on an unrecognised field container type", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article", [
        { uid: "mystery", data_type: "some_future_type", schema: [refField("r", ["person"])] },
        refField("author", ["person"]),
      ]),
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(edgesOf(inv, "blog_article")).toEqual(["person"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a content type whose `schema` is not
    an array at all — null, or an object — must not abort the whole build. One
    malformed content type in a 200-type export must not cost the operator the
    other 199.
  */
  it("TC_CTS_012 (negative): still returns other content types when one has a malformed schema", async () => {
    writeSchema(dir, [
      { uid: "broken", title: "Broken", schema: null },
      ct("person", "Person", [refField("employer", ["company"])]),
      ct("company", "Company"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes.map((c) => c.uid).sort()).toEqual(["broken", "company", "person"]);
    expect(edgesOf(inv, "person")).toEqual(["company"]);
  });
});

// ───────────────────────── destination match (FR-2.1 … FR-2.4) ─────────────────────────

describe("v3 content type inventory — matching against the destination", () => {
  const destArgs = {
    exportDir: "",
    destination: { region: "na", stackApiKey: "blt_dest", token: "cs_tok", branch: "main" },
  };

  const withDest = (over: Record<string, unknown> = {}) => ({
    ...destArgs,
    ...over,
    exportDir: dir,
  });

  it("TC_CTS_013 (positive): reads the destination content types using the supplied token", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "blog_article" }]);

    await buildContentTypeInventory(withDest());

    expect(mockListDestinationContentTypes).toHaveBeenCalledWith(
      expect.objectContaining({ token: "cs_tok", stackApiKey: "blt_dest" })
    );
  });

  /*
    Negative — taxonomy #1 (missing input): with no destination supplied the read
    must be skipped entirely rather than attempted with an empty credential. An
    attempted call with no token is a guaranteed 401 that would be reported to
    the operator as "the destination could not be checked" — a misleading
    diagnosis of a state that is not an error (FR-2.4, EC-5).
  */
  it("TC_CTS_013 (negative): attempts no destination read when no destination is supplied", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes).toHaveLength(1);
    expect(mockListDestinationContentTypes).not.toHaveBeenCalled();
  });

  it("TC_CTS_014 (positive): marks a source content type whose uid exists in the destination", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(true);
  });

  /*
    Negative — taxonomy #4 (forbidden state): marking must be per content type,
    not global. A single destination match must not flag every source row —
    which is exactly what a truthy "destination has content types" check would do.
  */
  it("TC_CTS_014 (negative): leaves other source content types unmarked when only one matches", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page"), ct("press_release", "Press Release")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "press_release")?.existsInDestination).toBe(false);
  });

  it("TC_CTS_015 (positive): does not match uids that differ only by case", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "Landing_Page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(false);
  });

  /*
    Negative — taxonomy #3 (boundary): the exact same uid, same case, must match.
    Without this pair TC_CTS_015 is satisfied by a comparison that never matches
    anything at all.
  */
  it("TC_CTS_015 (negative): matches a uid that is identical in case", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(true);
  });

  it("TC_CTS_016 (positive): does not match a destination uid that merely extends the source uid", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page_v2" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(false);
  });

  /*
    Negative — taxonomy #3 (boundary): the reverse direction of the same trap —
    a destination uid that is a strict PREFIX of the source uid must also not
    match. A `startsWith` in either direction passes one of these and fails the
    other.
  */
  it("TC_CTS_016 (negative): does not match a destination uid that is a prefix of the source uid", async () => {
    writeSchema(dir, [ct("landing_page_v2", "Landing Page V2")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page_v2")?.existsInDestination).toBe(false);
  });

  it("TC_CTS_017 (positive): leaves a content type with no destination counterpart unmarked", async () => {
    writeSchema(dir, [ct("press_release", "Press Release")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "blog_article" }, { uid: "person" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "press_release")?.existsInDestination).toBe(false);
  });

  /*
    Negative — taxonomy #1 (missing/empty input): an entirely empty destination
    stack must leave every row unmarked, and must be treated as a successful
    read rather than as a failure. An empty destination is the ordinary case for
    a first migration, not an error (FR-2.4 must not fire here).
  */
  it("TC_CTS_017 (negative): reports a successful read with nothing marked when the destination is empty", async () => {
    writeSchema(dir, [ct("press_release", "Press Release")]);
    mockListDestinationContentTypes.mockResolvedValue([]);

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.destinationRead).toBe(true);
    expect(rowFor(inv, "press_release")?.existsInDestination).toBe(false);
  });

  it("TC_CTS_018 (positive): matches on uid even when the two schemas differ entirely", async () => {
    writeSchema(dir, [ct("category", "Category", [textField("title"), textField("slug")])]);
    mockListDestinationContentTypes.mockResolvedValue([
      { uid: "category", schema: [{ uid: "completely_different", data_type: "number" }] },
    ]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "category")?.existsInDestination).toBe(true);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the title is not part of the match.
    Same title, different uid, must NOT be marked — this is the behaviour
    feature.md Q-2 keeps open, so it is pinned explicitly rather than left to
    whichever comparison the implementation reaches for.
  */
  it("TC_CTS_018 (negative): does not match on display title when the uids differ", async () => {
    writeSchema(dir, [ct("category_v2", "Category")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "category", title: "Category" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "category_v2")?.existsInDestination).toBe(false);
  });

  it("TC_CTS_019 (positive): still returns the full source list when the destination read fails", async () => {
    writeSchema(dir, [
      ct("blog_article", "Blog Article"),
      ct("person", "Person"),
      ct("product", "Product"),
    ]);
    mockListDestinationContentTypes.mockRejectedValue(new Error("ECONNREFUSED"));

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.contentTypes.map((c) => c.uid)).toEqual(["blog_article", "person", "product"]);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the failure must not be
    swallowed into a silent success. If `destinationRead` came back true after a
    rejection, the panel would render "nothing conflicts" for a destination it
    never managed to read — the exact false reassurance FR-2.4 exists to prevent.
  */
  it("TC_CTS_019 (negative): reports the destination as unread rather than as successfully empty", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockRejectedValue(new Error("ECONNREFUSED"));

    const inv = await buildContentTypeInventory(withDest());

    // Anchored: a never-attempted read also reports `destinationRead: false`, so
    // the classification is what distinguishes a failure from "not configured".
    expect(mockListDestinationContentTypes).toHaveBeenCalledTimes(1);
    expect(inv.destinationRead).toBe(false);
    expect(inv.destinationReadFailure).toBe("network");
  });

  it("TC_CTS_020 (positive): marks no content type as present when the destination read fails", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page"), ct("category", "Category")]);
    mockListDestinationContentTypes.mockRejectedValue(new Error("ECONNREFUSED"));

    const inv = await buildContentTypeInventory(withDest());

    // Anchored on the row count first: `every` over an empty array is true.
    expect(inv.contentTypes).toHaveLength(2);
    expect(inv.contentTypes.every((c) => c.existsInDestination === false)).toBe(true);
  });

  /*
    Negative — taxonomy #6 (dependency failure): a read that succeeds must not be
    reported as failed. Pairs with the positive so that "mark nothing" cannot be
    achieved by treating every read as a failure.
  */
  it("TC_CTS_020 (negative): marks matches normally when the destination read succeeds", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page"), ct("category", "Category")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "landing_page" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(true);
    expect(rowFor(inv, "category")?.existsInDestination).toBe(false);
  });

  it("TC_CTS_021 (positive): classifies a network failure so the operator can be told", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockRejectedValue(new Error("ECONNREFUSED"));

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.destinationReadFailure).toBe("network");
  });

  /*
    Negative — taxonomy #6 (dependency failure): a successful read must carry no
    failure classification at all. A residual classification would have the panel
    telling the operator the destination could not be checked while showing them
    correctly matched rows.
  */
  it("TC_CTS_021 (negative): carries no failure classification when the read succeeds", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockResolvedValue([{ uid: "blog_article" }]);

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.destinationRead).toBe(true);
    expect(inv.destinationReadFailure).toBeUndefined();
  });

  it("TC_CTS_022 (positive): treats an absent destination token exactly as an unread destination", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);

    const inv = await buildContentTypeInventory({
      exportDir: dir,
      destination: { region: "na", stackApiKey: "blt_dest", token: "", branch: "main" },
    });

    expect(inv.destinationRead).toBe(false);
    expect(rowFor(inv, "landing_page")?.existsInDestination).toBe(false);
  });

  /*
    Negative — taxonomy #1 (missing input): an absent token is a configuration
    state, not a runtime failure, so no CMA call may be attempted. Attempting one
    burns a request and produces a 401 that would be misclassified as
    "unauthorized" when the truth is "never configured".
  */
  it("TC_CTS_022 (negative): issues no destination request at all when the token is absent", async () => {
    writeSchema(dir, [ct("landing_page", "Landing Page")]);

    const inv = await buildContentTypeInventory({
      exportDir: dir,
      destination: { region: "na", stackApiKey: "blt_dest", token: "", branch: "main" },
    });

    expect(inv.contentTypes).toHaveLength(1);
    expect(mockListDestinationContentTypes).not.toHaveBeenCalled();
  });

  it("TC_CTS_023 (positive): classifies an authorization failure distinctly from a network failure", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401 })
    );

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.destinationReadFailure).toBe("unauthorized");
    expect(inv.destinationRead).toBe(false);
  });

  /*
    Negative — taxonomy #5 (permission denial): a 403 — a token that authenticates
    but lacks content-type scope — must classify as unauthorized too, not fall
    through to the generic bucket. The two are the same remedy for the operator:
    the token needs fixing.
  */
  it("TC_CTS_023 (negative): classifies a forbidden response as unauthorized, not as unexpected", async () => {
    writeSchema(dir, [ct("blog_article", "Blog Article")]);
    mockListDestinationContentTypes.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { status: 403 })
    );

    const inv = await buildContentTypeInventory(withDest());

    expect(inv.destinationReadFailure).toBe("unauthorized");
  });
});

// ───── reading a v2-shaped export (cli-v1-to-v2-migration.md §4.1 — Step 1) ─────

/**
 * CLI v2 writes no `content_types/schema.json` — only one `<uid>.json` per type.
 * Content mapping reads this inventory, so without a per-item path a v2 export
 * produces `export_unreadable` and the mapping step is simply unusable.
 *
 * Shape measured from a real v2 export (`~/Documents/demo cli v2`): 23 files, each
 * `{ title, uid, schema }`, and no aggregate.
 */
const writePerItemTypes = (dir: string, contentTypes: Record<string, any>[]): void => {
  const d = path.join(dir, "content_types");
  fs.mkdirSync(d, { recursive: true });
  for (const c of contentTypes) {
    fs.writeFileSync(path.join(d, `${c.uid}.json`), JSON.stringify(c, null, 2));
  }
};

describe("v3 content type inventory — a v2-shaped export", () => {
  it("builds the inventory from per-item files when there is no aggregate", async () => {
    writePerItemTypes(dir, [ct("blog_article", "Blog Article"), ct("person", "Person")]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes.map((c) => c.uid).sort()).toEqual(["blog_article", "person"]);
    expect(inv.contentTypes.find((c) => c.uid === "person")?.title).toBe("Person");
  });

  /*
    Negative — taxonomy #1 (missing input): an export with no content-type data at all is
    still a failure, not an empty stack. Paired so "read the per-item files" cannot be
    satisfied by code that stops distinguishing a broken export from an empty one — the
    distinction EC-1 and EC-3 require.
  */
  it("still reports an unreadable export when there is no content_types folder", async () => {
    const empty = path.join(TMP, `no-cts-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(empty, { recursive: true });

    await expect(buildContentTypeInventory({ exportDir: empty })).rejects.toMatchObject({
      code: "export_unreadable",
    });
  });

  it("resolves references between content types read from per-item files", async () => {
    writePerItemTypes(dir, [
      {
        uid: "blog_article",
        title: "Blog Article",
        schema: [{ data_type: "reference", uid: "author", reference_to: ["person"] }],
      },
      ct("person", "Person"),
    ]);

    const inv = await buildContentTypeInventory({ exportDir: dir });

    expect(inv.contentTypes.find((c) => c.uid === "blog_article")?.references).toEqual(["person"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): an aggregate that EXISTS but cannot be parsed
    must still fail loudly rather than falling through to the per-item files and reporting
    an empty stack. A corrupt v1 export reading as "no content types" is precisely the
    silent-zero failure this whole migration is meant to avoid.
  */
  it("reports an unreadable export when the aggregate exists but is corrupt", async () => {
    const d = path.join(dir, "content_types");
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, "schema.json"), "{ this is not json");
    // A per-item file is present too, so falling through would look like success.
    fs.writeFileSync(path.join(d, "person.json"), JSON.stringify(ct("person", "Person")));

    await expect(buildContentTypeInventory({ exportDir: dir })).rejects.toMatchObject({
      code: "export_unreadable",
    });
  });
});
