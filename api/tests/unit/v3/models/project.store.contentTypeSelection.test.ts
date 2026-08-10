import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-content-type-selection, Phase 1 tranche 1b: the selection on the
 * project record.
 *
 * Backs TC_CTS_103–106, TC_CTS_112, TC_CTS_113
 * (feature.md FR-9.3, FR-9.4, FR-9.9; trd.md DM-2, TR-21, TRR-1).
 *
 * Isolation follows the existing store tests: V3_DATA_DIR points at a fresh temp
 * dir per test and the module is re-imported, so lowdb reads a clean file.
 *
 * TC_CTS_105 is the one that matters most. The project record also holds the
 * destination's encrypted management-token secret, which cannot be re-read from
 * Contentstack once lost — so a selection write that replaces the whole record
 * destroys a live credential permanently (trd.md TRR-1). The audit feature hit
 * exactly this trap, which is why the field-level setter pattern exists.
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SCOPE = { region: "NA", owner: "U1" };

/*
  Two shapes below follow this store's existing conventions rather than anything
  this feature invented: a refusal carries `status`, not `statusCode`
  (`requireProject`), and every scoped read takes `(projectId, scope)` in that
  order (`getV3Project`, `getV3AuditDecisions`). The behaviour asserted — a 404
  refusal that creates nothing, and an out-of-scope read that is indistinguishable
  from a miss — is unchanged.
*/

const seed = (projects: any[]) => {
  fs.writeFileSync(
    path.join(tmpDir, "projects.json"),
    JSON.stringify({ projects }, null, 2)
  );
};

const readFile = (): any =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, "projects.json"), "utf8"));

const record = (over: Record<string, unknown> = {}) => ({
  id: "P1",
  name: "Marketing stack sync",
  region: "NA",
  owner: "U1",
  isDeleted: false,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
  ...over,
});

/** A selection carrying one conflict-free type and one conflicting type. */
const SELECTION = {
  contentTypes: {
    blog_article: {},
    landing_page: { conflictMode: "merge" },
  },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-cts-store-"));
  process.env.V3_DATA_DIR = tmpDir;
});

afterEach(() => {
  delete process.env.V3_DATA_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 project store — content type selection", () => {
  it("TC_CTS_103 (positive): stores each selected uid and the conflict mode for the conflicting one", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T00:00:00.000Z");

    const stored = readFile().projects[0].contentTypeSelection;
    expect(Object.keys(stored.contentTypes).sort()).toEqual(["blog_article", "landing_page"]);
    expect(stored.contentTypes.landing_page.conflictMode).toBe("merge");
  });

  /*
    Negative — taxonomy #2 (invalid shape): a conflict-free content type must be
    stored WITHOUT a conflict mode, not with a default one. A stored
    `conflictMode: "source"` on a content type that does not exist in the
    destination would tell a downstream reader to replace a schema that is not
    there — and feature.md FR-5.4 forbids offering the choice at all in that case.
  */
  it("TC_CTS_104 (negative): stores no conflict mode for a content type that has none", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T00:00:00.000Z");

    const stored = readFile().projects[0].contentTypeSelection;
    expect(stored.contentTypes.blog_article.conflictMode).toBeUndefined();
    // Anchored: the record really was written, so the absence is meaningful.
    expect(stored.contentTypes.landing_page.conflictMode).toBe("merge");
  });

  /*
    Negative — taxonomy #1 (missing/empty input): an empty selection must persist
    AS an empty selection, not as an absent field. FR-9.5 hydrates the working
    selection from the record, and "the operator deselected everything" has to be
    distinguishable from "nothing was ever saved" — otherwise clearing a
    selection and revisiting silently restores the old one.
  */
  it("TC_CTS_103 (negative): persists an emptied selection rather than removing the field", async () => {
    seed([record({ contentTypeSelection: { ...SELECTION, updatedAt: "t0" } })]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", { contentTypes: {} } as any, "t1");

    const stored = readFile().projects[0].contentTypeSelection;
    expect(stored).toBeDefined();
    expect(stored.contentTypes).toEqual({});
  });

  it("TC_CTS_104 (positive): stores the conflict mode for a content type that has one", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection(
      "P1",
      { contentTypes: { landing_page: { conflictMode: "dest" } } } as any,
      "t1"
    );

    expect(
      readFile().projects[0].contentTypeSelection.contentTypes.landing_page.conflictMode
    ).toBe("dest");
  });

  it("TC_CTS_105 (positive): preserves the encrypted destination token secret across the write", async () => {
    const token = {
      uid: "cs_mt_uid",
      secretEncrypted: "enc:iv:tag:cipher",
      createdAt: "2026-08-01T00:00:00.000Z",
    };
    seed([record({ destinationToken: token })]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T00:00:00.000Z");

    expect(readFile().projects[0].destinationToken).toEqual(token);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the same trap from the other side.
    A second write must not erode the credential either — a bug that spreads the
    record on every save would leave the first write intact and destroy the token
    on the second, which is far harder to spot.
  */
  it("TC_CTS_105 (negative): still preserves the token secret after a second, different write", async () => {
    const token = { uid: "cs_mt_uid", secretEncrypted: "enc:iv:tag:cipher" };
    seed([record({ destinationToken: token })]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "t1");
    await s.setV3ContentTypeSelection("P1", { contentTypes: { person: {} } } as any, "t2");

    expect(readFile().projects[0].destinationToken).toEqual(token);
  });

  it("TC_CTS_106 (positive): changes only the selection and the updated timestamp", async () => {
    const original = record({
      source: { stack: { stackApiKey: "blt_src" } },
      audit: { categories: { unusedAssets: "exclude" }, itemOverrides: {} },
      destination: { stackApiKey: "blt_dest" },
    });
    seed([original]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T00:00:00.000Z");

    const after = readFile().projects[0];
    const { contentTypeSelection, updated_at, ...untouched } = after;
    const { updated_at: _oldTs, ...originalRest } = original as any;
    expect(untouched).toEqual(originalRest);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the audit's decisions live on the
    same record and are the input this very step consumes downstream. A write
    that dropped them would silently undo the operator's audit exclusions —
    a failure with no error and no visible symptom until Content mapping shows
    items that were excluded.
  */
  it("TC_CTS_106 (negative): leaves a previously stored audit decision set untouched", async () => {
    const audit = { categories: { unusedAssets: "exclude" }, itemOverrides: { "asset:a1": "exclude" } };
    seed([record({ audit })]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T00:00:00.000Z");

    expect(readFile().projects[0].audit).toEqual(audit);
  });

  it("TC_CTS_112 (positive): rejects a write for an unknown project instead of creating one", async () => {
    seed([record()]);
    const s = await importStore();

    await expect(
      s.setV3ContentTypeSelection("UNKNOWN", SELECTION as any, "t1")
    ).rejects.toMatchObject({ status: 404 });

    expect(readFile().projects).toHaveLength(1);
  });

  /*
    Negative — taxonomy #5 (permission denial): a project that exists but is soft
    deleted must be refused too, and refused the same way — recording a selection
    against a deleted project would resurrect it as a live migration target.
  */
  it("TC_CTS_112 (negative): refuses a write against a soft-deleted project", async () => {
    seed([record({ isDeleted: true })]);
    const s = await importStore();

    await expect(
      s.setV3ContentTypeSelection("P1", SELECTION as any, "t1")
    ).rejects.toMatchObject({ status: 404 });

    expect(readFile().projects[0].contentTypeSelection).toBeUndefined();
  });

  it("TC_CTS_113 (positive): stamps the supplied server timestamp onto the stored selection", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", SELECTION as any, "2026-08-10T09:30:00.000Z");

    expect(readFile().projects[0].contentTypeSelection.updatedAt).toBe(
      "2026-08-10T09:30:00.000Z"
    );
  });

  /*
    Negative — taxonomy #2 (invalid shape): a client-supplied timestamp must not
    survive into the record. If it did, a client could backdate a selection and
    any later "which is newer" comparison — the natural fix for EC-9's
    last-write-wins — would be decided by the client rather than the server.
  */
  it("TC_CTS_113 (negative): ignores a client-supplied updatedAt in favour of the server's", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection(
      "P1",
      { ...SELECTION, updatedAt: "1999-01-01T00:00:00.000Z" } as any,
      "2026-08-10T09:30:00.000Z"
    );

    expect(readFile().projects[0].contentTypeSelection.updatedAt).toBe(
      "2026-08-10T09:30:00.000Z"
    );
  });
});

describe("v3 project store — reading the content type selection", () => {
  it("TC_CTS_131 (positive): a later write fully replaces the earlier selection", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection(
      "P1",
      { contentTypes: { a: {}, b: {}, c: {}, d: {}, e: {} } } as any,
      "t1"
    );
    await s.setV3ContentTypeSelection("P1", { contentTypes: { a: {}, b: {} } } as any, "t2");

    expect(Object.keys(readFile().projects[0].contentTypeSelection.contentTypes).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  /*
    Negative — taxonomy #7 (conflict): replacement must be total, including
    conflict modes. A merge-style write would leave the earlier mode attached to
    a content type the operator has since set differently, so the record would
    disagree with what they last saw.
  */
  it("TC_CTS_131 (negative): does not retain a conflict mode from the replaced selection", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection(
      "P1",
      { contentTypes: { landing_page: { conflictMode: "merge" } } } as any,
      "t1"
    );
    await s.setV3ContentTypeSelection(
      "P1",
      { contentTypes: { landing_page: { conflictMode: "dest" } } } as any,
      "t2"
    );

    expect(
      readFile().projects[0].contentTypeSelection.contentTypes.landing_page.conflictMode
    ).toBe("dest");
  });

  it("TC_CTS_132 (positive): the last of two sequential writes wins", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", { contentTypes: { tab_one: {} } } as any, "t1");
    await s.setV3ContentTypeSelection("P1", { contentTypes: { tab_two: {} } } as any, "t2");

    expect(Object.keys(readFile().projects[0].contentTypeSelection.contentTypes)).toEqual([
      "tab_two",
    ]);
  });

  /*
    Negative — taxonomy #7 (conflict): documents what EC-9 leaves open. The
    second write is NOT merged with the first and raises no conflict signal. This
    asserts the current contract rather than endorsing it — feature.md Q-5 and
    trd.md TQ-3 are still open, and if a precondition is added later this test is
    the one that must change deliberately.
  */
  it("TC_CTS_132 (negative): silently discards the first write rather than merging or reporting a conflict", async () => {
    seed([record()]);
    const s = await importStore();

    await s.setV3ContentTypeSelection("P1", { contentTypes: { tab_one: {} } } as any, "t1");
    const second = await s.setV3ContentTypeSelection(
      "P1",
      { contentTypes: { tab_two: {} } } as any,
      "t2"
    );

    expect(second).toBeUndefined();
    expect(
      readFile().projects[0].contentTypeSelection.contentTypes.tab_one
    ).toBeUndefined();
  });

  it("TC_CTS_135 (positive): reads back a stored selection for a caller in scope", async () => {
    seed([record({ contentTypeSelection: { ...SELECTION, updatedAt: "t1" } })]);
    const s = await importStore();

    const got = await s.getV3ContentTypeSelection("P1", SCOPE);

    expect(Object.keys(got!.contentTypes).sort()).toEqual(["blog_article", "landing_page"]);
  });

  /*
    Negative — taxonomy #5 (permission denial): a project in another caller's
    scope must read as undefined, indistinguishable from one that was never
    audited. Returning a distinguishable error would confirm the project exists
    to a caller who may not know that (NFR-4).
  */
  it("TC_CTS_135 (negative): returns undefined for a project outside the caller's scope", async () => {
    seed([record({ owner: "SOMEONE_ELSE", contentTypeSelection: { ...SELECTION, updatedAt: "t1" } })]);
    const s = await importStore();

    const got = await s.getV3ContentTypeSelection("P1", SCOPE);

    expect(got).toBeUndefined();
  });
});
