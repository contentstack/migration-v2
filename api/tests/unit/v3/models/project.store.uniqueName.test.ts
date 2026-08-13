import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-project-lifecycle, Phase 1 tranche 1b: unique project names.
 *
 * Covers TC_PL_072–082 (the uniqueness rule), TC_PL_088–089 (scope isolation),
 * TC_PL_091–094 (deleted names released) and TC_PL_108–115 (existing data), against
 * `feature.md` FR-3.1, FR-3.2, FR-3.3, FR-3.5, FR-3.6, FR-3.7 and EC-13/14/15.
 *
 * TC_PL_083 (client bypass) and TC_PL_090 (409 response body) are asserted in the
 * ROUTE tranche instead: both are statements about the HTTP surface rather than the
 * store, and asserting them here would test the wrong layer.
 *
 * Real store against a temp dir, following the neighbouring `project.store.*.test.ts`
 * files. The malformed-record tests seed `projects.json` directly, because the
 * condition being tested — a record the store's own writers could not produce — can
 * only be created by writing the file.
 */
let dataDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SCOPE = { region: "NA", owner: "U1" };
const OTHER_OWNER = { region: "NA", owner: "U2" };
const OTHER_REGION = { region: "EU", owner: "U1" };

let seq = 0;
const create = (s: any, name: string, scope = SCOPE) =>
  s.createV3Project(scope, { name }, { id: `P${++seq}`, nowIso: "t0" });

/** Writes projects.json directly, for records the store's writers cannot produce. */
const seedRaw = (projects: unknown[]) => {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "projects.json"), JSON.stringify({ projects }));
};

const record = (over: Record<string, unknown> = {}) => ({
  id: "R1", name: "Seeded", region: "NA", owner: "U1",
  isDeleted: false, created_at: "t0", updated_at: "t0", ...over,
});

const status = (p: Promise<unknown>) => p.then(() => 0, (e: any) => e?.status);

beforeEach(() => {
  seq = 0;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-pl-name-"));
  vi.stubEnv("V3_DATA_DIR", dataDir);
  vi.stubEnv("V3_MIGRATION_DATA_DIR", fs.mkdtempSync(path.join(os.tmpdir(), "v3-pl-nexp-")));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

// ───────────────────────── the rule ─────────────────────────

describe("cs-project-lifecycle — unique names: the rule", () => {
  it("TC_PL_072 (positive): refuses a name an existing live project already uses", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "Migration Test"))).toBe(409);
  });

  /*
    Negative — taxonomy #7 (conflict) inverted: a name nothing uses must be accepted.
    Without this pair a rule that refused every create would pass the positive test.
  */
  it("TC_PL_072 (negative): accepts a name no existing project uses", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    const created = await create(s, "Completely Different");
    expect(created.name).toBe("Completely Different");
  });

  it("TC_PL_073 (positive): creates no record when refusing a duplicate", async () => {
    const s = await importStore();
    await create(s, "Migration Test");
    const before = (await s.listV3Projects(SCOPE)).length;

    await status(create(s, "Migration Test"));

    expect((await s.listV3Projects(SCOPE)).length).toBe(before);
  });

  /*
    Negative — taxonomy #2 (invalid shape): the refusal must not leave a partial
    record behind either. Asserts the raw file, because a record written and then
    filtered from the list would be invisible to a list-based check.
  */
  it("TC_PL_073 (negative): writes nothing to the store file when refusing", async () => {
    const s = await importStore();
    await create(s, "Migration Test");
    const before = fs.readFileSync(path.join(dataDir, "projects.json"), "utf8");

    await status(create(s, "Migration Test"));

    expect(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).toBe(before);
  });

  it("TC_PL_074 (positive): refuses a name differing only by letter case", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "migration test"))).toBe(409);
  });

  /*
    Negative — taxonomy #3 (boundary): case-insensitivity must not collapse genuinely
    different names. 'Migration Best' differs by one letter, not by case, and must be
    accepted — otherwise the normalisation is over-reaching.
  */
  it("TC_PL_074 (negative): accepts a name differing by an actual letter, not just case", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "Migration Best"))).toBe(0);
  });

  it("TC_PL_075 (positive): refuses an all-caps variant of an existing name", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "MIGRATION TEST"))).toBe(409);
  });

  /*
    Negative — the comparison must be symmetric. Creating the lowercase name first and
    the mixed-case one second must refuse too; a rule that only folded one side would
    pass the positive and fail here.
  */
  it("TC_PL_075 (negative): refuses in the reverse order too, lowercase first", async () => {
    const s = await importStore();
    await create(s, "migration test");

    expect(await status(create(s, "Migration Test"))).toBe(409);
  });

  it("TC_PL_076 (positive): refuses a name differing only by surrounding whitespace", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "Migration Test   "))).toBe(409);
  });

  /*
    Negative — taxonomy #3 (boundary): trimming applies to the ENDS only. A name whose
    difference is inner whitespace is a different name, and collapsing it would refuse
    a create the operator is entitled to make.
  */
  it("TC_PL_076 (negative): accepts a name differing by inner whitespace", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "Migration  Test"))).toBe(0);
  });

  it("TC_PL_077 (positive): accepts a clearly distinct name", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    const created = await create(s, "Migration Test 2");
    expect(created.name).toBe("Migration Test 2");
  });

  /*
    Negative — taxonomy #7: a name that is a PREFIX of an existing one is distinct.
    A substring comparison instead of an equality comparison would wrongly refuse it.
  */
  it("TC_PL_077 (negative): accepts a name that is only a prefix of an existing one", async () => {
    const s = await importStore();
    await create(s, "Migration Test 2");

    expect(await status(create(s, "Migration Test"))).toBe(0);
  });

  it("TC_PL_078 (positive): treats inner whitespace as part of the name", async () => {
    const s = await importStore();
    await create(s, "Migration  Test");

    const created = await create(s, "Migration Test");
    expect(created.name).toBe("Migration Test");
  });

  /*
    Negative — the same two names in reverse creation order must also coexist, proving
    the distinction is a property of the comparison rather than of insertion order.
  */
  it("TC_PL_078 (negative): the two inner-whitespace variants coexist in either order", async () => {
    const s = await importStore();
    await create(s, "Migration Test");
    await create(s, "Migration  Test");

    expect((await s.listV3Projects(SCOPE)).length).toBe(2);
  });

  it("TC_PL_079 (positive): stores the name the caller supplied, not a normalised copy", async () => {
    const s = await importStore();

    const created = await create(s, "Migration Test");

    expect(created.name).toBe("Migration Test");
    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects[0].name).toBe("Migration Test");
  });

  /*
    Negative — taxonomy #2 (invalid shape): normalisation is for COMPARISON only. The
    stored value must not be lowercased, which would visibly rename the operator's
    project.
  */
  it("TC_PL_079 (negative): does not lowercase or otherwise rewrite the stored name", async () => {
    const s = await importStore();

    const created = await create(s, "MiGrAtIoN TeSt");

    expect(created.name).toBe("MiGrAtIoN TeSt");
  });

  it("TC_PL_080 (positive): stores a non-ASCII name unmangled", async () => {
    const s = await importStore();

    const created = await create(s, "Ünïqué Nâme");

    expect(created.name).toBe("Ünïqué Nâme");
  });

  /*
    Negative — taxonomy #2: the comparison must not strip characters to normalise.
    A rule that removed diacritics would treat 'Unique Name' as a duplicate of
    'Ünïqué Nâme' and refuse a legitimately different name (feature.md R-5).
  */
  it("TC_PL_080 (negative): does not treat a de-accented name as a duplicate", async () => {
    const s = await importStore();
    await create(s, "Ünïqué Nâme");

    expect(await status(create(s, "Unique Name"))).toBe(0);
  });

  it("TC_PL_081 (positive): refuses a non-ASCII name differing only by case", async () => {
    const s = await importStore();
    await create(s, "Ünïqué Nâme");

    expect(await status(create(s, "ünïqué nâme"))).toBe(409);
  });

  /*
    Negative — taxonomy #3: two genuinely different non-ASCII names must coexist, so
    the case-fold is not quietly collapsing distinct characters.
  */
  it("TC_PL_081 (negative): accepts a different non-ASCII name", async () => {
    const s = await importStore();
    await create(s, "Ünïqué Nâme");

    expect(await status(create(s, "Ödd Nâme"))).toBe(0);
  });

  it("TC_PL_082 (positive): refuses a duplicate at the 200-character length limit", async () => {
    const s = await importStore();
    const long = "x".repeat(200);
    await create(s, long);

    expect(await status(create(s, long))).toBe(409);
  });

  /*
    Negative — taxonomy #3 (boundary): two 200-character names differing in their LAST
    character must both be accepted. A comparison that truncated before comparing
    would refuse the second.
  */
  it("TC_PL_082 (negative): accepts two 200-character names differing in the final character", async () => {
    const s = await importStore();
    await create(s, "x".repeat(199) + "a");

    expect(await status(create(s, "x".repeat(199) + "b"))).toBe(0);
  });
});

// ───────────────────────── scope isolation ─────────────────────────

describe("cs-project-lifecycle — unique names: scope isolation", () => {
  it("TC_PL_088 (positive): accepts a name another OWNER already uses", async () => {
    const s = await importStore();
    await create(s, "Migration Test", OTHER_OWNER);

    expect(await status(create(s, "Migration Test", SCOPE))).toBe(0);
  });

  /*
    Negative — taxonomy #5 (permission/scope): within ONE owner's scope the same name
    is still refused. Paired so "accepts across scopes" cannot be satisfied by a rule
    that stopped checking altogether.
  */
  it("TC_PL_088 (negative): still refuses the duplicate within the same owner's scope", async () => {
    const s = await importStore();
    await create(s, "Migration Test", SCOPE);

    expect(await status(create(s, "Migration Test", SCOPE))).toBe(409);
  });

  it("TC_PL_089 (positive): accepts a name the same owner uses in another REGION", async () => {
    const s = await importStore();
    await create(s, "Migration Test", OTHER_REGION);

    expect(await status(create(s, "Migration Test", SCOPE))).toBe(0);
  });

  /*
    Negative — taxonomy #5: both records survive and each is visible only in its own
    scope. Asserting the counts proves the accept above did not simply overwrite the
    other scope's project.
  */
  it("TC_PL_089 (negative): each region sees only its own project of that name", async () => {
    const s = await importStore();
    await create(s, "Migration Test", OTHER_REGION);
    await create(s, "Migration Test", SCOPE);

    expect((await s.listV3Projects(SCOPE)).length).toBe(1);
    expect((await s.listV3Projects(OTHER_REGION)).length).toBe(1);
  });
});

// ───────────────────────── deleted names released ─────────────────────────

describe("cs-project-lifecycle — unique names: deleted projects release their name", () => {
  it("TC_PL_091 (positive): accepts the name of a deleted project", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);

    const again = await create(s, "Migration Test");
    expect(again.name).toBe("Migration Test");
    expect(again.id).not.toBe(first.id);
  });

  /*
    Negative — taxonomy #4 (forbidden state): while the project is still LIVE the name
    remains taken. Paired so "deleted names are free" cannot be satisfied by dropping
    the rule entirely.
  */
  it("TC_PL_091 (negative): still refuses the name while the project is live", async () => {
    const s = await importStore();
    await create(s, "Migration Test");

    expect(await status(create(s, "Migration Test"))).toBe(409);
  });

  it("TC_PL_092 (positive): lists exactly one project of that name after reuse", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);
    await create(s, "Migration Test");

    const matching = (await s.listV3Projects(SCOPE)).filter((p: any) => p.name === "Migration Test");
    expect(matching).toHaveLength(1);
  });

  /*
    Negative — taxonomy #4: the reused name must not resurrect the deleted project.
    The listed one has to be the NEW record, not the old one brought back into view.
  */
  it("TC_PL_092 (negative): the listed project is the new record, not the deleted one", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);
    const again = await create(s, "Migration Test");

    const ids = (await s.listV3Projects(SCOPE)).map((p: any) => p.id);
    expect(ids).toEqual([again.id]);
  });

  it("TC_PL_093 (positive): leaves the deleted record's name in place", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);
    await create(s, "Migration Test");

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    const old = raw.projects.find((p: any) => p.id === first.id);
    expect(old.name).toBe("Migration Test");
    expect(old.isDeleted).toBe(true);
  });

  /*
    Negative — taxonomy #7 (conflict): reusing the name must not rewrite the deleted
    record. Two records now carry the same name, and only the live one may be visible.
  */
  it("TC_PL_093 (negative): does not modify the deleted record when its name is reused", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);
    const before = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === first.id
    );

    await create(s, "Migration Test");

    const after = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === first.id
    );
    expect(after).toEqual(before);
  });

  it("TC_PL_094 (positive): a deleted project reserves its name under no case or whitespace variant", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await s.deleteV3Project(first.id);

    expect(await status(create(s, "migration test  "))).toBe(0);
  });

  /*
    Negative — taxonomy #4: with TWO live projects and only one deleted, the name is
    still taken. This is the case a naive "any deleted record frees the name"
    implementation would get wrong.
  */
  it("TC_PL_094 (negative): a name is still taken when another live project uses it", async () => {
    const s = await importStore();
    const first = await create(s, "Migration Test");
    await create(s, "Migration Test 2");
    await s.deleteV3Project(first.id);
    await create(s, "Migration Test");

    expect(await status(create(s, "migration test"))).toBe(409);
  });
});

// ───────────────────────── existing data ─────────────────────────

describe("cs-project-lifecycle — unique names: existing and malformed data", () => {
  /*
    A record carrying ONLY id and created_at exists in the live store today
    (`demo-project`). The uniqueness scan reads `name` off every record in scope, so an
    absent name would throw and break creation entirely — for every operator, not just
    for the malformed row.
  */
  it("TC_PL_108 (positive): creates normally alongside a record that has no name", async () => {
    seedRaw([{ id: "demo-project", created_at: "t0" }]);
    const s = await importStore();

    const created = await create(s, "Migration Test");
    expect(created.name).toBe("Migration Test");
  });

  /*
    Negative — taxonomy #2 (invalid shape): the malformed record must not itself be
    matchable. Creating a project whose name is the empty string is already refused by
    the presence rule, so the malformed row can never collide with anything.
  */
  it("TC_PL_108 (negative): a nameless record does not collide with any created name", async () => {
    seedRaw([{ id: "demo-project", created_at: "t0" }, record({ id: "R1", name: "Other" })]);
    const s = await importStore();

    expect(await status(create(s, "Migration Test"))).toBe(0);
    expect(await status(create(s, "Other"))).toBe(409);
  });

  it("TC_PL_109 (positive): keeps a malformed record out of the project list", async () => {
    seedRaw([{ id: "demo-project", created_at: "t0" }, record({ id: "R1", name: "Real" })]);
    const s = await importStore();

    const ids = (await s.listV3Projects(SCOPE)).map((p: any) => p.id);
    expect(ids).toEqual(["R1"]);
  });

  /*
    Negative — taxonomy #5 (scope): the malformed record is excluded because it has no
    region or owner, not because of any name check. Asserted by giving it a name and
    confirming it stays hidden.
  */
  it("TC_PL_109 (negative): a record with a name but no region or owner stays hidden", async () => {
    seedRaw([{ id: "orphan", name: "Has A Name", created_at: "t0" }]);
    const s = await importStore();

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toEqual([]);
  });

  it("TC_PL_110 (positive): treats a record with no isDeleted flag as live", async () => {
    seedRaw([{ id: "R1", name: "Legacy", region: "NA", owner: "U1", created_at: "t0", updated_at: "t0" }]);
    const s = await importStore();

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toEqual(["R1"]);
    expect(await status(create(s, "Legacy"))).toBe(409);
  });

  /*
    Negative — taxonomy #1 (missing value): an absent flag must be treated as live, NOT
    as deleted. The distinction matters because `isDeleted !== true` is the store's
    existing predicate; a check written as `isDeleted === false` would silently hide
    every legacy record.
  */
  it("TC_PL_110 (negative): a record with isDeleted explicitly true stays hidden and frees its name", async () => {
    seedRaw([{ id: "R1", name: "Gone", region: "NA", owner: "U1", isDeleted: true, created_at: "t0", updated_at: "t0" }]);
    const s = await importStore();

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toEqual([]);
    expect(await status(create(s, "Gone"))).toBe(0);
  });

  it("TC_PL_111 (positive): lists both of two pre-existing projects sharing a name", async () => {
    seedRaw([record({ id: "A", name: "Chirag Sample" }), record({ id: "B", name: "Chirag Sample" })]);
    const s = await importStore();

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id).sort()).toEqual(["A", "B"]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the pre-existing duplicates must remain
    individually readable. A rule that de-duplicated the list would hide one of the
    operator's real projects — the grandfathering in EC-13 is explicit that neither is
    touched.
  */
  it("TC_PL_111 (negative): each pre-existing duplicate is still readable by its own id", async () => {
    seedRaw([record({ id: "A", name: "Chirag Sample" }), record({ id: "B", name: "Chirag Sample" })]);
    const s = await importStore();

    expect((await s.getV3Project("A", SCOPE))?.id).toBe("A");
    expect((await s.getV3Project("B", SCOPE))?.id).toBe("B");
  });

  it("TC_PL_112 (positive): refuses a third project with an already-duplicated name", async () => {
    seedRaw([record({ id: "A", name: "Chirag Sample" }), record({ id: "B", name: "Chirag Sample" })]);
    const s = await importStore();

    expect(await status(create(s, "Chirag Sample"))).toBe(409);
  });

  /*
    Negative — taxonomy #7: the presence of duplicates must not block UNRELATED
    creates. A rule that refused everything once it found duplicate data would be
    worse than the problem it is solving.
  */
  it("TC_PL_112 (negative): still accepts an unrelated name when duplicates already exist", async () => {
    seedRaw([record({ id: "A", name: "Chirag Sample" }), record({ id: "B", name: "Chirag Sample" })]);
    const s = await importStore();

    expect(await status(create(s, "Something Else"))).toBe(0);
  });

  it("TC_PL_113 (positive): a pre-feature record reserves its name and is deletable", async () => {
    seedRaw([record({ id: "A", name: "Older Project" })]);
    const s = await importStore();

    expect(await status(create(s, "Older Project"))).toBe(409);
    await s.deleteV3Project("A");
    expect(await status(create(s, "Older Project"))).toBe(0);
  });

  /*
    Negative — taxonomy #4: before deletion the name is NOT available. Splitting this
    from the positive proves the release is caused by the deletion rather than by the
    record being a legacy one.
  */
  it("TC_PL_113 (negative): the pre-feature record's name is unavailable until it is deleted", async () => {
    seedRaw([record({ id: "A", name: "Older Project" })]);
    const s = await importStore();

    expect(await status(create(s, "older project"))).toBe(409);
    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toEqual(["A"]);
  });

  it("TC_PL_114 (positive): leaves an untouched project's record byte-identical", async () => {
    seedRaw([record({ id: "A", name: "Untouched" })]);
    const s = await importStore();
    const before = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects[0];

    await create(s, "A Brand New Project");

    const after = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === "A"
    );
    expect(after).toEqual(before);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a REFUSED create must also leave the record
    untouched. The refusal path runs before any write, so nothing may change.
  */
  it("TC_PL_114 (negative): leaves the record untouched when a create is refused", async () => {
    seedRaw([record({ id: "A", name: "Untouched" })]);
    const s = await importStore();
    const before = fs.readFileSync(path.join(dataDir, "projects.json"), "utf8");

    await status(create(s, "Untouched"));

    expect(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).toBe(before);
  });

  it("TC_PL_115 (positive): returns every pre-existing project in the scope", async () => {
    const many = Array.from({ length: 17 }, (_, i) => record({ id: `E${i}`, name: `Existing ${i}` }));
    seedRaw(many);
    const s = await importStore();

    expect((await s.listV3Projects(SCOPE))).toHaveLength(17);
  });

  /*
    Negative — taxonomy #5 (scope): a malformed record among them is still excluded, so
    the count is 17 of 18 rather than everything the file happens to contain.
  */
  it("TC_PL_115 (negative): excludes the malformed record from that count", async () => {
    const many = Array.from({ length: 17 }, (_, i) => record({ id: `E${i}`, name: `Existing ${i}` }));
    seedRaw([...many, { id: "demo-project", created_at: "t0" }]);
    const s = await importStore();

    const listed = await s.listV3Projects(SCOPE);
    expect(listed).toHaveLength(17);
    expect(listed.map((p: any) => p.id)).not.toContain("demo-project");
  });
});
