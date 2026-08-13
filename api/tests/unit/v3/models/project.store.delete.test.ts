import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-project-lifecycle, Phase 1 tranche 1a: deleting a project.
 *
 * Covers TC_PL_013–020 (record state), TC_PL_021–031 (export folder),
 * TC_PL_032–038 (writer guards) and TC_PL_116–117 (reliability), against
 * `docs/features/cs-project-lifecycle/feature.md` FR-1.2, FR-1.3, FR-1.4, FR-1.7,
 * FR-1.9, FR-1.10 and NFR-4.
 *
 * Real filesystem against temp dirs, deliberately. The subject of half of these
 * tests IS the filesystem effect — whether a directory and its contents are gone —
 * so mocking `fs` would assert that we called a mock, not that data was removed.
 * `V3_DATA_DIR` isolates the record store and `V3_MIGRATION_DATA_DIR` the export
 * tree, following the pattern the neighbouring `project.store.*.test.ts` files use.
 */
let dataDir: string;
let exportRoot: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SCOPE = { region: "NA", owner: "U1" };
const OTHER_SCOPE = { region: "EU", owner: "U2" };

const seedProject = async (s: any, id = "P1", scope = SCOPE, name?: string) =>
  s.createV3Project(scope, { name: name ?? `Project ${id}` }, { id, nowIso: "t0" });

/** Writes a realistic export tree for a project and returns its total byte size. */
const seedExport = (projectId: string, stackId = "blt1"): number => {
  const base = path.join(exportRoot, projectId, stackId, "main");
  const files: Array<[string, string]> = [
    ["export-info.json", JSON.stringify({ contentVersion: 2, exportedAt: "2026-08-12T00:00:00.000Z" })],
    ["content_types/schema.json", JSON.stringify([{ uid: "blog" }])],
    ["entries/blog/en-us/uuid-entries.json", JSON.stringify({ e1: { uid: "e1" } })],
    ["assets/uuid-assets.json", JSON.stringify({ a1: { uid: "a1" } })],
    ["assets/files/a1/hero.png", "binary-ish-content"],
  ];
  let total = 0;
  for (const [rel, body] of files) {
    const p = path.join(base, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    total += Buffer.byteLength(body);
  }
  // The audit findings cache sits beside the branch folder, inside the project dir.
  const cache = path.join(exportRoot, projectId, stackId, "audit.json");
  const cacheBody = JSON.stringify({ cacheKey: "2026-08-12T00:00:00.000Z", checks: [], totals: {} });
  fs.writeFileSync(cache, cacheBody);
  return total + Buffer.byteLength(cacheBody);
};

const projectDir = (projectId: string) => path.join(exportRoot, projectId);

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-pl-data-"));
  exportRoot = fs.mkdtempSync(path.join(os.tmpdir(), "v3-pl-export-"));
  vi.stubEnv("V3_DATA_DIR", dataDir);
  vi.stubEnv("V3_MIGRATION_DATA_DIR", exportRoot);
});

afterEach(() => {
  /*
    Restore FIRST. Several tests below spy on `fs.rmSync` to simulate a removal
    failure; if the awaited call throws before the test's own restore runs, the mock is
    still installed when this hook tries to clean up — and the cleanup then fails with
    the very error the test injected. Restoring here makes that impossible regardless
    of what any individual test managed to reach.
  */
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(dataDir, { recursive: true, force: true });
  fs.rmSync(exportRoot, { recursive: true, force: true });
});

/** Runs `fn` with `fs` spies guaranteed to be restored, even if `fn` throws. */
const withSpies = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } finally {
    vi.restoreAllMocks();
  }
};

// ───────────────────────── record state ─────────────────────────

describe("cs-project-lifecycle — delete: record state", () => {
  it("TC_PL_013 (positive): sets isDeleted to true on the project record", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await s.deleteV3Project("P1");

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").isDeleted).toBe(true);
  });

  /*
    Negative — taxonomy #1 (missing input): an id with no matching record.
    Must reject with the store's 404 convention rather than creating a record or
    silently succeeding, so a mistyped id is never mistaken for a completed delete.
  */
  it("TC_PL_013 (negative): rejects with 404 for an id that has no record", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await expect(s.deleteV3Project("nope")).rejects.toMatchObject({ status: 404 });

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").isDeleted).toBe(false);
  });

  it("TC_PL_014 (positive): keeps the record in the store rather than removing the row", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    const before = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.length;

    await s.deleteV3Project("P1");

    const after = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.length;
    expect(after).toBe(before);
  });

  /*
    Negative — taxonomy #4 (forbidden state): deleting an already-deleted project.
    A second delete must not succeed, because reporting success for a project this
    call did not delete is a false confirmation the operator would act on.
  */
  it("TC_PL_014 (negative): rejects a second delete of the same project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await expect(s.deleteV3Project("P1")).rejects.toMatchObject({ status: 404 });
  });

  it("TC_PL_015 (positive): refreshes updated_at on the deleted record", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await s.deleteV3Project("P1", "2026-08-12T10:00:00.000Z");

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").updated_at).toBe("2026-08-12T10:00:00.000Z");
  });

  /*
    Negative — taxonomy #4: a rejected delete must not touch updated_at either.
    A refreshed timestamp on a project nothing happened to would misreport when the
    record last genuinely changed.
  */
  it("TC_PL_015 (negative): leaves updated_at untouched when the delete is rejected", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1", "2026-08-12T10:00:00.000Z");

    await expect(s.deleteV3Project("P1", "2026-08-12T11:00:00.000Z")).rejects.toMatchObject({ status: 404 });

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").updated_at).toBe("2026-08-12T10:00:00.000Z");
  });

  it("TC_PL_016 (positive): removes the project from the scoped list", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");

    await s.deleteV3Project("P1");

    const listed = (await s.listV3Projects(SCOPE)).map((p: any) => p.id);
    expect(listed).toEqual(["P2"]);
  });

  /*
    Negative — the contrast that makes the assertion above mean something: a project
    that was NOT deleted must remain listed. A list that dropped everything would
    satisfy the positive test alone.
  */
  it("TC_PL_016 (negative): leaves an undeleted project in the scoped list", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");

    await s.deleteV3Project("P1");

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toContain("P2");
  });

  it("TC_PL_017 (positive): makes a single read of the deleted project return undefined", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await s.deleteV3Project("P1");

    expect(await s.getV3Project("P1", SCOPE)).toBeUndefined();
  });

  /*
    Negative — taxonomy #5 (permission/scope): reading a LIVE project in scope must
    still work. Paired with the above so "returns undefined" cannot be satisfied by a
    read that stopped working entirely.
  */
  it("TC_PL_017 (negative): still returns a live project from a single read", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");

    await s.deleteV3Project("P1");

    expect((await s.getV3Project("P2", SCOPE))?.id).toBe("P2");
  });

  /*
    ⚠️ The highest-consequence assertion in this file (feature.md R-2 / trd.md TRR-2).

    `destinationToken.secretEncrypted` is write-only — nothing reads it back — so if a
    spread over the project record drops it, the loss is silent and permanent. Writing
    `{...project, isDeleted: true}` is the natural way to implement this and is exactly
    the mistake; two existing setters in this store document the same hazard.
  */
  it("TC_PL_018 (positive): preserves the write-only encrypted destination token", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.setV3DestinationToken("P1", { uid: "mt1", secretEncrypted: "enc:iv:tag:cipher" } as any, "t1");

    await s.deleteV3Project("P1");

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").destinationToken.secretEncrypted).toBe(
      "enc:iv:tag:cipher"
    );
  });

  /*
    Negative — taxonomy #2 (invalid shape): the deletion must not replace the record
    with a partial object. Asserts the fields a wholesale rewrite would drop are all
    still present, which a single-field check could miss.
  */
  it("TC_PL_018 (negative): does not replace the record with a partial object", async () => {
    const s = await importStore();
    await seedProject(s, "P1", SCOPE, "Keep My Name");

    await s.deleteV3Project("P1");

    const rec = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === "P1"
    );
    for (const field of ["id", "name", "region", "owner", "created_at"]) {
      expect(rec, `deleting dropped ${field}`).toHaveProperty(field);
    }
    expect(rec.name).toBe("Keep My Name");
  });

  it("TC_PL_019 (positive): changes only isDeleted and updated_at on the record", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.upsertV3Source("P1", {
      mode: "stack",
      stack: { region: "NA", orgId: "O1", stackApiKey: "blt1", branch: "main", scope: "whole", selectedModules: [] },
    } as any, "t1");
    const before = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === "P1"
    );

    await s.deleteV3Project("P1", "t2");

    const after = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === "P1"
    );
    const differing = Object.keys({ ...before, ...after }).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    expect(differing.sort()).toEqual(["isDeleted", "updated_at"]);
  });

  /*
    Negative — taxonomy #6 (dependency failure contrast): a rejected delete changes
    NOTHING at all, not even the two fields a successful one changes.
  */
  it("TC_PL_019 (negative): changes no field at all when the delete is rejected", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    const before = fs.readFileSync(path.join(dataDir, "projects.json"), "utf8");

    await expect(s.deleteV3Project("missing")).rejects.toMatchObject({ status: 404 });

    expect(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).toBe(before);
  });

  it("TC_PL_020 (positive): leaves another project's record untouched", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");

    await s.deleteV3Project("P1");

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P2").isDeleted).toBe(false);
  });

  /*
    Negative — taxonomy #7 (conflict): two projects sharing a NAME must be deleted
    independently. Real condition, not hypothetical — the live store holds two
    projects both named "Chirag Sample", and deleting by name rather than by id would
    take both.
  */
  it("TC_PL_020 (negative): deleting one of two same-named projects leaves the other live", async () => {
    /*
      Seeded by writing the file directly: as of this feature `createV3Project` refuses
      the second "Chirag Sample", so the duplicate state can no longer be produced
      through the store's own writer. It exists in the live store from before the rule
      (EC-13), which is exactly why deleting by id rather than by name matters.
    */
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, "projects.json"),
      JSON.stringify({
        projects: ["P1", "P2"].map((id) => ({
          id, name: "Chirag Sample", region: "NA", owner: "U1",
          isDeleted: false, created_at: "t0", updated_at: "t0",
        })),
      })
    );
    const s = await importStore();

    await s.deleteV3Project("P1");

    const listed = (await s.listV3Projects(SCOPE)).map((p: any) => p.id);
    expect(listed).toEqual(["P2"]);
  });
});

// ───────────────────────── export folder ─────────────────────────

describe("cs-project-lifecycle — delete: export folder", () => {
  it("TC_PL_021 (positive): removes the project's export folder", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    expect(fs.existsSync(projectDir("P1"))).toBe(true);

    await s.deleteV3Project("P1");

    expect(fs.existsSync(projectDir("P1"))).toBe(false);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a rejected delete must remove nothing.
    Without this, an implementation that removed the folder before validating the id
    would pass the positive test while destroying data on a mistyped id.
  */
  it("TC_PL_021 (negative): removes no folder when the delete is rejected", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");

    await expect(s.deleteV3Project("nope")).rejects.toMatchObject({ status: 404 });

    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  it("TC_PL_022 (positive): removes the whole nested export tree, not just the top level", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");

    await s.deleteV3Project("P1");

    for (const rel of [
      "blt1/main/content_types/schema.json",
      "blt1/main/entries/blog/en-us/uuid-entries.json",
      "blt1/main/assets/files/a1/hero.png",
    ]) {
      expect(fs.existsSync(path.join(projectDir("P1"), rel)), `${rel} survived`).toBe(false);
    }
  });

  /*
    Negative — taxonomy #3 (boundary): removal must stop at the project directory.
    Deleting one level too high would take every project's export at once, which is
    the worst outcome this feature could produce.
  */
  it("TC_PL_022 (negative): leaves the exportData root itself in place", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");

    await s.deleteV3Project("P1");

    expect(fs.existsSync(exportRoot)).toBe(true);
    expect(fs.statSync(exportRoot).isDirectory()).toBe(true);
  });

  it("TC_PL_023 (positive): removes the audit findings cache along with the folder", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    expect(fs.existsSync(path.join(projectDir("P1"), "blt1", "audit.json"))).toBe(true);

    await s.deleteV3Project("P1");

    expect(fs.existsSync(path.join(projectDir("P1"), "blt1", "audit.json"))).toBe(false);
  });

  /*
    Negative — taxonomy #7 (conflict): another project's audit cache must survive.
    The cache is per-project only because the export folder is; a removal keyed on the
    stack rather than the project would take a second project's cache with it.
  */
  it("TC_PL_023 (negative): leaves another project's audit cache intact", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");
    seedExport("P1");
    seedExport("P2");

    await s.deleteV3Project("P1");

    expect(fs.existsSync(path.join(projectDir("P2"), "blt1", "audit.json"))).toBe(true);
  });

  it("TC_PL_024 (positive): succeeds for a project that was never exported", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    expect(fs.existsSync(projectDir("P1"))).toBe(false);

    await expect(s.deleteV3Project("P1")).resolves.toMatchObject({ folderRemoved: false });

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").isDeleted).toBe(true);
  });

  /*
    Negative — taxonomy #1 (missing input) paired with the above: when a folder DOES
    exist the result must say so. Reporting `folderRemoved: false` in both cases would
    make the flag useless and would misreport reclaimed disk in the log line.
  */
  it("TC_PL_024 (negative): reports folderRemoved true when a folder did exist", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");

    await expect(s.deleteV3Project("P1")).resolves.toMatchObject({ folderRemoved: true });
  });

  it("TC_PL_025 (positive): leaves another project's export folder fully intact", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");
    seedExport("P1");
    const p2Bytes = seedExport("P2");

    await s.deleteV3Project("P1");

    expect(fs.existsSync(projectDir("P2"))).toBe(true);
    const surviving = fs
      .readdirSync(path.join(projectDir("P2"), "blt1", "main"), { recursive: true } as any)
      .length;
    expect(surviving).toBeGreaterThan(0);
    expect(p2Bytes).toBeGreaterThan(0);
  });

  /*
    Negative — taxonomy #7 (conflict): two projects exporting the SAME stack must not
    share a folder. This is why the export tree is keyed by project id; before that
    change they did share one, and deleting either would have destroyed the other's
    export.
  */
  it("TC_PL_025 (negative): two projects on the same stack do not share an export folder", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await seedProject(s, "P2");
    seedExport("P1", "blt-shared");
    seedExport("P2", "blt-shared");

    await s.deleteV3Project("P1");

    expect(fs.existsSync(path.join(projectDir("P2"), "blt-shared", "main", "export-info.json"))).toBe(true);
  });

  /*
    A folder-removal failure must not lose the deletion. The record is already marked
    by the time the filesystem is touched (FR-1.3), so the project is gone from the
    operator's view even though disk was not reclaimed.
  */
  it("TC_PL_026 (positive): marks the record deleted even when folder removal fails", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    await withSpies(async () => {
      await s.deleteV3Project("P1").catch(() => undefined);
    });

    const raw = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
    expect(raw.projects.find((p: any) => p.id === "P1").isDeleted).toBe(true);
  });

  /*
    Negative — taxonomy #6 (dependency failure): a removal failure is REPORTED, not
    thrown. The API contract returns 200 with folderRemoved false, because the delete
    has succeeded from the operator's point of view — only the disk reclaim did not.
  */
  it("TC_PL_026 (negative): reports folderRemoved false rather than rejecting when removal fails", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    let result: any;
    await withSpies(async () => {
      result = await s.deleteV3Project("P1");
    });

    expect(result.folderRemoved).toBe(false);
  });

  /*
    TC_PL_027 — ORDERING (FR-1.3). The record write must complete BEFORE the folder is
    touched. The reverse leaves a LIVE project whose data is already gone, which is
    unrecoverable from the operator's point of view: every later step reads an empty
    folder with nothing to explain why.
  */
  it("TC_PL_027 (positive): writes the record before touching the filesystem", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    /*
      Ordering is asserted by OBSERVABLE STATE rather than by intercepting the write.
      lowdb writes through steno, which imports `node:fs/promises` directly, so a spy on
      `fs.writeFileSync` never sees it — an earlier version of this test spied there and
      proved nothing. Reading the record from disk at the moment the removal happens is
      mechanism-independent and a stronger statement of the requirement: by the time the
      folder goes, the record must ALREADY be flagged.
    */
    let flaggedWhenFolderRemoved: boolean | undefined;
    const realRm = fs.rmSync.bind(fs);
    vi.spyOn(fs, "rmSync").mockImplementation(((f: any, ...rest: any[]) => {
      const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8"));
      flaggedWhenFolderRemoved = onDisk.projects.find((p: any) => p.id === "P1")?.isDeleted;
      return (realRm as any)(f, ...rest);
    }) as any);

    await withSpies(async () => {
      await s.deleteV3Project("P1");
    });

    expect(flaggedWhenFolderRemoved).toBe(true);
  });

  // Negative — taxonomy #6: if the record write fails, nothing is removed from disk.
  it("TC_PL_027 (negative): removes no files when the record write fails", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    /*
      The record write is made to fail by making its directory read-only — a real I/O
      failure, rather than a spy on a function lowdb does not call (it writes via steno
      and `node:fs/promises`).

      The precondition is asserted explicitly: if the write somehow SUCCEEDED, this test
      fails rather than passing vacuously, which is what a conditional skip would do.
    */
    const rmSpy = vi.spyOn(fs, "rmSync");
    fs.chmodSync(dataDir, 0o555);
    let rejected = false;
    try {
      await s.deleteV3Project("P1").catch(() => {
        rejected = true;
      });
    } finally {
      fs.chmodSync(dataDir, 0o755);
      vi.restoreAllMocks();
    }

    expect(rejected, "the record write did not fail, so this scenario was not exercised").toBe(true);
    expect(rmSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  /*
    Path containment (FR-1.7, TRR-1) — the highest-impact risk in the feature, because
    the removal is recursive. A project id arriving as a URL path segment must not be
    able to escape the export root, whatever it contains.
  */
  it("TC_PL_028 (positive): a traversal-shaped project id cannot delete outside the export root", async () => {
    const s = await importStore();
    const outside = path.join(path.dirname(exportRoot), "must-survive");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "keep.txt"), "keep");
    await seedProject(s, "../../must-survive");

    await s.deleteV3Project("../../must-survive").catch(() => undefined);

    expect(fs.existsSync(path.join(outside, "keep.txt"))).toBe(true);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a traversal id must also not take a
    legitimate project's folder as collateral. It resolves to a sanitised segment that
    simply does not exist, so nothing real is removed.
  */
  it("TC_PL_028 (negative): a traversal-shaped id does not remove a real project's folder", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    await seedProject(s, "../../P1");

    await s.deleteV3Project("../../P1").catch(() => undefined);

    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  /*
    TC_PL_029 — an id that is only dots must not resolve to the export root, which
    would delete every project's export in a single call.
  */
  it("TC_PL_029 (positive): a dots-only project id does not resolve to the export root", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    await seedProject(s, "..");

    await s.deleteV3Project("..").catch(() => undefined);

    expect(fs.existsSync(exportRoot)).toBe(true);
    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  /*
    Negative — taxonomy #1 (empty input): an empty id must not resolve to the root
    either. `path.join(root, "")` yields the root itself, so this is the one traversal
    shape that needs no separators at all to be dangerous.
  */
  it("TC_PL_029 (negative): an empty project id does not resolve to the export root", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    await seedProject(s, "");

    await s.deleteV3Project("").catch(() => undefined);

    expect(fs.existsSync(exportRoot)).toBe(true);
    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  it("TC_PL_030 (positive): removes only the target project's directory from the root", async () => {
    const s = await importStore();
    for (const id of ["P1", "P2", "P3"]) {
      await seedProject(s, id);
      seedExport(id);
    }

    await s.deleteV3Project("P2");

    expect(fs.readdirSync(exportRoot).sort()).toEqual(["P1", "P3"]);
  });

  /*
    Negative — taxonomy #3 (boundary): an unrelated directory sitting in the export
    root must survive. The removal is scoped to one entry, not "everything that is not
    the survivor".
  */
  it("TC_PL_030 (negative): leaves an unrelated directory in the export root alone", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    fs.mkdirSync(path.join(exportRoot, "not-a-project"), { recursive: true });

    await s.deleteV3Project("P1");

    expect(fs.existsSync(path.join(exportRoot, "not-a-project"))).toBe(true);
  });

  /*
    NOTE: the `bytesReclaimed` assertions for this store call live with TC_PL_067 /
    TC_PL_068 in the observability tranche, because the matrix scopes reclaimed bytes
    to the log line the operator reads rather than to the store's return value.
  */

  it("TC_PL_031 (positive): makes no Contentstack call while deleting", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockImplementation(() => {
      throw new Error("no network call expected during a delete");
    });

    await withSpies(async () => {
      await s.deleteV3Project("P1");
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /*
    Negative — taxonomy #4: deletion must not reach into the SOURCE stack. Asserts the
    stored source record still names the stack, proving we removed our own copy rather
    than anything belonging to Contentstack.
  */
  it("TC_PL_031 (negative): leaves the recorded source stack reference on the deleted record", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.upsertV3Source("P1", {
      mode: "stack",
      stack: { region: "NA", orgId: "O1", stackApiKey: "blt-source", branch: "main", scope: "whole", selectedModules: [] },
    } as any, "t1");

    await s.deleteV3Project("P1");

    const rec = JSON.parse(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).projects.find(
      (p: any) => p.id === "P1"
    );
    expect(rec.source.stack.stackApiKey).toBe("blt-source");
  });
});

// ───────────────────────── writer guards (FR-1.10) ─────────────────────────

describe("cs-project-lifecycle — delete: writers refuse a deleted project", () => {
  const SOURCE = {
    mode: "stack" as const,
    stack: {
      region: "NA", orgId: "O1", stackApiKey: "blt1", branch: "main",
      scope: "whole" as const, selectedModules: [],
    },
  };
  const GRAPH = { counts: { contentTypes: 1, assets: 0, entries: 0, globalFields: 0, references: 0 }, nodes: [], edges: [] };
  const DECISIONS = { categories: {}, itemOverrides: {} };
  const SELECTION = { contentTypes: ["blog"], conflictModes: {} };

  it("TC_PL_032 (positive): upsertV3Source rejects a deleted project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await expect(s.upsertV3Source("P1", SOURCE as any, "t1")).rejects.toMatchObject({ status: 404 });
  });

  // Negative — taxonomy #4 contrast: the same write must still succeed on a LIVE project.
  it("TC_PL_032 (negative): upsertV3Source still succeeds on a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await expect(s.upsertV3Source("P1", SOURCE as any, "t1")).resolves.toBeDefined();
  });

  it("TC_PL_033 (positive): setV3Graph rejects a deleted project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    // setV3Graph writes into project.source, so a source must exist first.
    await s.upsertV3Source("P1", SOURCE as any, "t1");
    await s.deleteV3Project("P1");

    await expect(
      s.setV3Graph("P1", GRAPH as any, { jobId: "j1", status: "succeeded", startedAt: "t0", finishedAt: "t1" } as any, "t1")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("TC_PL_033 (negative): setV3Graph still succeeds on a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.upsertV3Source("P1", SOURCE as any, "t1");

    await expect(
      s.setV3Graph("P1", GRAPH as any, { jobId: "j1", status: "succeeded", startedAt: "t0", finishedAt: "t1" } as any, "t1")
    ).resolves.toBeUndefined();
  });

  it("TC_PL_034 (positive): setV3AuditDecisions rejects a deleted project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await expect(s.setV3AuditDecisions("P1", DECISIONS as any, "t1")).rejects.toMatchObject({ status: 404 });
  });

  it("TC_PL_034 (negative): setV3AuditDecisions still succeeds on a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await expect(s.setV3AuditDecisions("P1", DECISIONS as any, "t1")).resolves.toBeUndefined();
  });

  it("TC_PL_035 (positive): setV3DestinationToken rejects a deleted project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await expect(
      s.setV3DestinationToken("P1", { uid: "mt", secretEncrypted: "enc:a:b:c" } as any, "t1")
    ).rejects.toMatchObject({ status: 404 });
  });

  it("TC_PL_035 (negative): setV3DestinationToken still succeeds on a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await expect(
      s.setV3DestinationToken("P1", { uid: "mt", secretEncrypted: "enc:a:b:c" } as any, "t1")
    ).resolves.toBeUndefined();
  });

  /*
    Pre-existing guard, asserted here as a regression check. This one already refused
    deleted projects before the feature existed — it is the precedent the other four
    now follow.
  */
  it("TC_PL_036 (positive): setV3ContentTypeSelection rejects a deleted project with 404", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await expect(s.setV3ContentTypeSelection("P1", SELECTION as any, "t1")).rejects.toMatchObject({ status: 404 });
  });

  it("TC_PL_036 (negative): setV3ContentTypeSelection still succeeds on a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await expect(s.setV3ContentTypeSelection("P1", SELECTION as any, "t1")).resolves.toBeUndefined();
  });

  it("TC_PL_037 (positive): a rejected write leaves the deleted project's stored state unchanged", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");
    const before = fs.readFileSync(path.join(dataDir, "projects.json"), "utf8");

    await s.setV3AuditDecisions("P1", DECISIONS as any, "t9").catch(() => undefined);

    expect(fs.readFileSync(path.join(dataDir, "projects.json"), "utf8")).toBe(before);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a rejected write must not resurrect the
    project into the list. The guard exists precisely so a later write cannot undo a
    deletion, which is the reasoning the pre-existing guard records.
  */
  it("TC_PL_037 (negative): a rejected write does not return the project to the list", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.deleteV3Project("P1");

    await s.upsertV3Source("P1", SOURCE as any, "t9").catch(() => undefined);

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).not.toContain("P1");
  });

  it("TC_PL_038 (positive): all five writers succeed against a live project", async () => {
    const s = await importStore();
    await seedProject(s, "P1");

    await s.upsertV3Source("P1", SOURCE as any, "t1");  // must precede setV3Graph
    await s.setV3Graph("P1", GRAPH as any, { jobId: "j", status: "succeeded", startedAt: "t0", finishedAt: "t1" } as any, "t1");
    await s.setV3AuditDecisions("P1", DECISIONS as any, "t1");
    await s.setV3DestinationToken("P1", { uid: "mt", secretEncrypted: "enc:a:b:c" } as any, "t1");
    await s.setV3ContentTypeSelection("P1", SELECTION as any, "t1");

    expect((await s.getV3Project("P1", SCOPE))?.id).toBe("P1");
  });

  /*
    Negative — taxonomy #4: after deletion all five refuse. Asserted as a set so a
    guard added to four of the five cannot pass.
  */
  it("TC_PL_038 (negative): all five writers refuse once the project is deleted", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    await s.upsertV3Source("P1", SOURCE as any, "t1");
    await s.deleteV3Project("P1");

    const statuses = await Promise.all([
      s.upsertV3Source("P1", SOURCE as any, "t1").then(() => 0, (e: any) => e.status),
      s.setV3Graph("P1", GRAPH as any, { jobId: "j", status: "succeeded", startedAt: "t0", finishedAt: "t1" } as any, "t1").then(() => 0, (e: any) => e.status),
      s.setV3AuditDecisions("P1", DECISIONS as any, "t1").then(() => 0, (e: any) => e.status),
      s.setV3DestinationToken("P1", { uid: "mt", secretEncrypted: "enc:a:b:c" } as any, "t1").then(() => 0, (e: any) => e.status),
      s.setV3ContentTypeSelection("P1", SELECTION as any, "t1").then(() => 0, (e: any) => e.status),
    ]);
    expect(statuses).toEqual([404, 404, 404, 404, 404]);
  });
});

// ───────────────────────── reliability (NFR-4) ─────────────────────────

describe("cs-project-lifecycle — delete: reliability", () => {
  /*
    NFR-4's guarantee, stated as the state that must never exist: a project still
    visible in the list whose export folder has been removed. Every downstream step
    reads that folder, so this combination hands the operator a project that looks
    usable and is not.
  */
  it("TC_PL_116 (positive): never leaves a listed project whose export folder is gone", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("EACCES");
    });

    await withSpies(async () => {
      await s.deleteV3Project("P1").catch(() => undefined);
    });

    const listed = (await s.listV3Projects(SCOPE)).map((p: any) => p.id);
    const folderGone = !fs.existsSync(projectDir("P1"));
    expect(listed.includes("P1") && folderGone).toBe(false);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the tolerated end state after an
    interrupted delete is a HIDDEN project with an orphaned folder. Asserted
    explicitly so the ordering is not "fixed" later into the dangerous direction.
  */
  it("TC_PL_117 (positive): an interrupted delete leaves the project hidden with its folder still on disk", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    vi.spyOn(fs, "rmSync").mockImplementation(() => {
      throw new Error("EACCES");
    });

    await withSpies(async () => {
      await s.deleteV3Project("P1").catch(() => undefined);
    });

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).not.toContain("P1");
    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });

  it("TC_PL_117 (negative): a successful delete leaves neither the listing nor the folder", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");

    await s.deleteV3Project("P1");

    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).not.toContain("P1");
    expect(fs.existsSync(projectDir("P1"))).toBe(false);
  });

  /*
    Negative — taxonomy #6, the complementary half of atomicity: when the RECORD write
    fails, the project must remain both listed and backed by its folder. Together with
    the positive above this closes both directions — neither half-state is reachable.
  */
  it("TC_PL_116 (negative): a failed record write leaves the project listed with its folder intact", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedExport("P1");
    // Read-only data dir — see the note on TC_PL_027 (negative) for why a spy will not do.
    fs.chmodSync(dataDir, 0o555);
    let rejected = false;
    try {
      await s.deleteV3Project("P1").catch(() => {
        rejected = true;
      });
    } finally {
      fs.chmodSync(dataDir, 0o755);
    }

    expect(rejected, "the record write did not fail, so this scenario was not exercised").toBe(true);
    expect((await s.listV3Projects(SCOPE)).map((p: any) => p.id)).toContain("P1");
    expect(fs.existsSync(projectDir("P1"))).toBe(true);
  });
});

// ───────────────────────── performance (NFR-1) ─────────────────────────

describe("cs-project-lifecycle — delete: performance", () => {
  /** Writes `count` small files across a nested tree, as a real export's shape does. */
  const seedManyFiles = (projectId: string, count: number) => {
    const base = path.join(exportRoot, projectId, "blt1", "main", "entries");
    for (let i = 0; i < count; i++) {
      const dir = path.join(base, `ct${i % 50}`, `locale${i % 4}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `chunk-${i}.json`), '{"e":1}');
    }
  };

  /*
    NFR-1 bounds deletion at 30 seconds for roughly 160 MB across roughly 10,000 files.

    ⚠️ DEVIATION, recorded rather than hidden: this test reproduces the FILE-COUNT
    dimension (10,000 files across a nested tree) but not the byte volume — the files
    are a few bytes each rather than totalling 160 MB. Recursive removal is bound by
    directory-entry count far more than by file size, so the count is the dimension
    that decides whether the bound holds; writing 160 MB per run would add minutes to
    the suite for no additional signal. The matrix already flags that no document
    specifies how this fixture should be produced.
  */
  it("TC_PL_071 (positive): deletes a 10,000-file export within the 30-second bound", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedManyFiles("P1", 10_000);

    const started = Date.now();
    await s.deleteV3Project("P1");
    const elapsed = Date.now() - started;

    expect(fs.existsSync(projectDir("P1"))).toBe(false);
    expect(elapsed).toBeLessThan(30_000);
  }, 60_000);

  /*
    Negative — taxonomy #3 (boundary): the removal must be a single recursive operation,
    not a per-file walk driven from our own code. A hand-rolled walk is what turns a
    large export from seconds into minutes, and it is the implementation this bound
    exists to rule out.
  */
  it("TC_PL_071 (negative): removes the tree with one recursive call, not one call per file", async () => {
    const s = await importStore();
    await seedProject(s, "P1");
    seedManyFiles("P1", 200);
    const realRm = fs.rmSync.bind(fs);
    const rmSpy = vi.spyOn(fs, "rmSync").mockImplementation(((f: any, ...rest: any[]) =>
      (realRm as any)(f, ...rest)) as any);

    await withSpies(async () => {
      await s.deleteV3Project("P1");
    });

    expect(rmSpy.mock.calls.length).toBeLessThan(5);
    expect(rmSpy).toHaveBeenCalledWith(expect.stringContaining("P1"), expect.objectContaining({ recursive: true }));
  });
});
