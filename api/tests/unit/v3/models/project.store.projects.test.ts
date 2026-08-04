import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — v3 project.store project CRUD: listV3Projects, createV3Project, and the
 * three-way-scoped getV3Project.
 *
 * Backs TC_PD_094–098 (record shape, optional description, no stored status, no
 * organization field, required fields on every creation path), TC_PD_099 (the
 * three-way list scope), TC_PD_100–103 (the scoped single read and its
 * information-disclosure property), TC_PD_104 (pre-existing unscoped records stay
 * invisible).
 *
 * feature.md FR-9.1–FR-9.14, AC-1.3, AC-1.4, AC-3.7, AC-3.8, EC-8, EC-9.
 * trd.md TR-2, TR-3, TR-4.
 *
 * The client-side counterparts — TC_PD_021/024/025, which assert how many CARDS
 * render — live in the projects page tests, not here.
 *
 * Revised 2026-08-05: the scope is three-way (region, owner, not-deleted). A
 * project is no longer organization-specific, so `getV3ProjectByOwner` — which
 * existed only because one route carried no organization segment — is gone, and
 * the old field-naming pair is replaced by TC_PD_097 asserting that no
 * organization field exists at all.
 *
 * Isolation: the store reads its data dir from V3_DATA_DIR; each test points it at
 * a fresh temp dir and re-imports the module.
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

/**
 * The caller's scope. Both dimensions come from the verified token; there is no
 * organization dimension, because a project is not organization-specific (FR-9.6).
 */
const SCOPE = { region: "NA", owner: "U1" };

/** Writes records straight to the store file, bypassing the create path. */
const seed = (projects: any[]) => {
  fs.writeFileSync(
    path.join(tmpDir, "projects.json"),
    JSON.stringify({ projects }, null, 2)
  );
};

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

const raw = () =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, "projects.json"), "utf8"));

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3projects-"));
  vi.stubEnv("V3_DATA_DIR", tmpDir);
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 project.store — createV3Project", () => {
  it("TC_PD_094 (positive): a created record carries the name, region, owner, unset delete marker and both timestamps", async () => {
    const s = await importStore();

    const created = await s.createV3Project(
      SCOPE,
      { name: "EU region migration" },
      { id: "P9", nowIso: "2026-08-05T10:00:00.000Z" }
    );

    expect(created).toMatchObject({
      id: "P9",
      name: "EU region migration",
      region: "NA",
      owner: "U1",
      isDeleted: false,
      created_at: "2026-08-05T10:00:00.000Z",
      updated_at: "2026-08-05T10:00:00.000Z",
    });
  });

  // Negative — taxonomy #1 (missing input): the required fields have no default, so a
  // creation attempt without a name is refused rather than producing a record the
  // list can never surface (FR-9.10).
  it("TC_PD_094 (negative): creating without a name is rejected with a specific error and writes nothing", async () => {
    const s = await importStore();

    await expect(
      s.createV3Project(SCOPE, { name: "" }, { id: "P9", nowIso: "t" })
    ).rejects.toThrow("Project name is required");

    expect(await s.listV3Projects(SCOPE)).toHaveLength(0);
  });

  it("TC_PD_095 (positive): a record created without a description is valid and omits the field", async () => {
    const s = await importStore();

    const created = await s.createV3Project(
      SCOPE,
      { name: "Docs stack copy" },
      { id: "P2", nowIso: "t1" }
    );

    expect(created.name).toBe("Docs stack copy");
    expect(created.description).toBeUndefined();
  });

  // Negative — taxonomy #2 (invalid shape): a supplied description must actually be
  // stored, so "optional" cannot be implemented by discarding it.
  it("TC_PD_095 (negative): a supplied description is persisted rather than discarded", async () => {
    const s = await importStore();

    await s.createV3Project(
      SCOPE,
      { name: "Docs stack copy", description: "Quarterly refresh" },
      { id: "P2", nowIso: "t1" }
    );

    const [found] = await s.listV3Projects(SCOPE);
    expect(found.description).toBe("Quarterly refresh");
  });

  it("TC_PD_096 (positive): a created record carries no stored status field", async () => {
    const s = await importStore();

    const created = await s.createV3Project(
      SCOPE,
      { name: "Blog content move" },
      { id: "P3", nowIso: "t1" }
    );

    expect(created).not.toHaveProperty("status");
  });

  // Negative — taxonomy #4 (forbidden state): a status supplied by a caller must not
  // be accepted onto the record either — status is derived, never stored (FR-9.8).
  it("TC_PD_096 (negative): a caller-supplied status is not written onto the record", async () => {
    const s = await importStore();

    await s.createV3Project(
      SCOPE,
      { name: "Blog content move", status: "Completed" } as any,
      { id: "P3", nowIso: "t1" }
    );

    const [found] = await s.listV3Projects(SCOPE);
    expect(found).not.toHaveProperty("status");
  });

  it("TC_PD_097 (positive): a created record carries no organization field under any name", async () => {
    const s = await importStore();
    await s.createV3Project(SCOPE, { name: "Global rollout" }, { id: "P5", nowIso: "t1" });

    expect(raw().projects[0]).not.toHaveProperty("orgId");
    expect(raw().projects[0]).not.toHaveProperty("org_id");
    expect(raw().projects[0]).not.toHaveProperty("organization");
  });

  // Negative — taxonomy #4 (forbidden state): an organization supplied by a caller
  // must not be written onto the record either. Accepting it would reintroduce a
  // field nothing validates and every future reader would assume is meaningful
  // (FR-9.7).
  it("TC_PD_097 (negative): an organization supplied by a caller is not written onto the record", async () => {
    const s = await importStore();

    await s.createV3Project(
      SCOPE,
      { name: "Global rollout", orgId: "O1", org_id: "O1" } as any,
      { id: "P5", nowIso: "t1" }
    );

    expect(raw().projects[0]).not.toHaveProperty("orgId");
    expect(raw().projects[0]).not.toHaveProperty("org_id");
  });

  it("TC_PD_098 (positive): persisting a source for an unknown project id creates no project record", async () => {
    const s = await importStore();

    await expect(
      s.upsertV3Source("ghost", { mode: "stack" } as any, "t1")
    ).rejects.toThrow("Project ghost does not exist");

    expect(await s.listV3Projects(SCOPE)).toHaveLength(0);
  });

  // Negative — taxonomy #4 (forbidden state, contrast): the same source write against
  // a project that DOES exist succeeds, proving the refusal above is the
  // missing-project guard and not a broken write path.
  it("TC_PD_098 (negative): the same source write succeeds against an existing project", async () => {
    const s = await importStore();
    await s.createV3Project(SCOPE, { name: "Sandbox refresh" }, { id: "P4", nowIso: "t1" });

    await s.upsertV3Source("P4", { mode: "stack" } as any, "t2");

    const found = await s.getV3Project("P4", SCOPE);
    expect(found?.source).toMatchObject({ mode: "stack" });
  });
});

describe("v3 project.store — listV3Projects", () => {
  it("TC_PD_099 (positive): the list applies all three scope dimensions together", async () => {
    const s = await importStore();
    seed([
      record({ id: "MATCH" }),
      record({ id: "WRONG_REGION", region: "EU" }),
      record({ id: "WRONG_OWNER", owner: "U2" }),
      record({ id: "DELETED", isDeleted: true }),
    ]);

    const found = await s.listV3Projects(SCOPE);

    expect(found.map((p: any) => p.id)).toEqual(["MATCH"]);
  });

  // Negative — taxonomy #5 (permission denial): failing exactly one dimension is
  // enough to exclude a record. A filter built from OR instead of AND would let each
  // of these through, and this is the assertion that catches it.
  it("TC_PD_099 (negative): failing a single scope dimension is enough to exclude a record", async () => {
    const s = await importStore();
    seed([
      record({ id: "WRONG_REGION", region: "EU" }),
      record({ id: "WRONG_OWNER", owner: "U2" }),
      record({ id: "DELETED", isDeleted: true }),
    ]);

    expect(await s.listV3Projects(SCOPE)).toEqual([]);
  });
});

describe("v3 project.store — getV3Project scope", () => {
  it("TC_PD_100 (positive): a project owned by another user is not readable by its id", async () => {
    const s = await importStore();
    seed([record({ id: "P4", owner: "U2" })]);

    expect(await s.getV3Project("P4", SCOPE)).toBeUndefined();
  });

  // Negative — taxonomy #5 (permission denial, contrast): the same record IS readable
  // by its real owner, so the refusal above is the scope and not a broken read.
  it("TC_PD_100 (negative): the same project is readable by its real owner", async () => {
    const s = await importStore();
    seed([record({ id: "P4", owner: "U2" })]);

    const found = await s.getV3Project("P4", { ...SCOPE, owner: "U2" });

    expect(found?.id).toBe("P4");
  });

  it("TC_PD_101 (positive): a project created in another region is not readable by its id", async () => {
    const s = await importStore();
    seed([record({ id: "P5", region: "EU" })]);

    expect(await s.getV3Project("P5", SCOPE)).toBeUndefined();
  });

  // Negative — taxonomy #5 (permission denial, contrast): readable from the region it
  // belongs to.
  it("TC_PD_101 (negative): the same project is readable from its own region", async () => {
    const s = await importStore();
    seed([record({ id: "P5", region: "EU" })]);

    const found = await s.getV3Project("P5", { ...SCOPE, region: "EU" });

    expect(found?.id).toBe("P5");
  });

  it("TC_PD_102 (positive): a soft-deleted project is not readable by its id", async () => {
    const s = await importStore();
    seed([record({ id: "P6", isDeleted: true })]);

    expect(await s.getV3Project("P6", SCOPE)).toBeUndefined();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): the same project with an unset
  // marker is readable, so the refusal is the marker.
  it("TC_PD_102 (negative): the same project with an unset delete marker is readable", async () => {
    const s = await importStore();
    seed([record({ id: "P6", isDeleted: false })]);

    expect((await s.getV3Project("P6", SCOPE))?.id).toBe("P6");
  });

  it("TC_PD_103 (positive): a scope miss and a genuinely absent id are indistinguishable", async () => {
    const s = await importStore();
    seed([record({ id: "EXISTS_BUT_FOREIGN", owner: "U2" })]);

    const foreign = await s.getV3Project("EXISTS_BUT_FOREIGN", SCOPE);
    const absent = await s.getV3Project("NEVER_EXISTED", SCOPE);

    expect(foreign).toBeUndefined();
    expect(absent).toBeUndefined();
    expect(foreign).toEqual(absent);
  });

  // Negative — taxonomy #5 (permission denial): the read must not signal denial.
  // Throwing a forbidden-style error would confirm the project exists, which is
  // precisely what FR-9.12 forbids.
  it("TC_PD_103 (negative): a scope miss does not raise a permission error that would confirm existence", async () => {
    const s = await importStore();
    seed([record({ id: "EXISTS_BUT_FOREIGN", owner: "U2" })]);

    await expect(s.getV3Project("EXISTS_BUT_FOREIGN", SCOPE)).resolves.toBeUndefined();
  });

  it("TC_PD_104 (positive): a record predating this feature, with no name, region or owner, is absent from the list", async () => {
    const s = await importStore();
    // Exactly the shape of the one record already in the store: an id, an
    // organization under the old field name, and nothing else (FR-9.14).
    seed([
      {
        id: "demo-project",
        org_id: "O1",
        source: { mode: "stack" },
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    ]);

    expect(await s.listV3Projects(SCOPE)).toEqual([]);
  });

  // Negative — taxonomy #5 (permission denial): the scope must not be relaxed to
  // rescue such a record. No caller scope makes it visible, and it is not readable by
  // its id either.
  it("TC_PD_104 (negative): no caller scope makes a legacy record visible or readable", async () => {
    const s = await importStore();
    seed([
      {
        id: "demo-project",
        org_id: "O1",
        source: { mode: "stack" },
        created_at: "t",
        updated_at: "t",
      },
    ]);

    for (const scope of [SCOPE, { region: "EU", owner: "U1" }, { region: "NA", owner: "U2" }]) {
      expect(await s.listV3Projects(scope)).toEqual([]);
      expect(await s.getV3Project("demo-project", scope)).toBeUndefined();
    }
  });
});
