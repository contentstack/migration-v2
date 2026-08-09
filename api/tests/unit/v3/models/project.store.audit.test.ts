import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-audit-report, Phase 1 tranche 2b: audit decisions on the project record.
 *
 * Backs TC_AR_119–121, 126, 127, 179 and 188
 * (feature.md FR-7.5, FR-7.6, FR-7.9, NFR-6, NFR-10; trd.md TR-10, DM-2, TRR-7).
 *
 * Isolation follows the existing store tests: V3_DATA_DIR points at a fresh temp
 * dir per test and the module is re-imported, so lowdb reads a clean file.
 *
 * The single most consequential case here is TC_AR_179. The project record now
 * also holds the destination's encrypted management-token secret, which cannot be
 * re-read from Contentstack once lost — so a decisions write that replaces the
 * whole record destroys a live credential permanently (trd.md TRR-7).
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SCOPE = { region: "NA", owner: "U1" };

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

const DECISIONS = {
  categories: { unusedAssets: "exclude" },
  itemOverrides: { "asset:blt4973c80": "include" },
  updatedAt: "2026-08-05T12:00:00.000Z",
};

/** The encrypted destination token this store already holds — see TRR-7. */
const TOKEN = {
  uid: "tok1",
  name: "eu-marketing-import",
  stackApiKey: "blt-dest",
  secretEncrypted: "enc:aa:bb:cc",
  createdAt: "2026-08-05T10:00:00.000Z",
};

const SOURCE = {
  mode: "stack",
  stack: { region: "NA", orgId: "o1", stackApiKey: "blt-src", branch: "main", scope: "whole", selectedModules: [] },
  lastExport: { jobId: "j1", status: "succeeded" },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3-store-audit-"));
  vi.stubEnv("V3_DATA_DIR", tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 project.store — audit decisions round trip", () => {
  it("TC_AR_119 (positive): decisions written to a project are read back unchanged", async () => {
    seed([record()]);
    const { setV3AuditDecisions, getV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    expect(await getV3AuditDecisions("P1", SCOPE)).toEqual(DECISIONS);
  });

  /*
    Negative — taxonomy #1 (missing input): the project does not exist. It throws
    404 rather than creating one, matching the rule every other write in this store
    follows — creation has exactly one entry point (FR-9.9/FR-9.10 of the dashboard
    spec), and recording an audit decision must not be a second one.
  */
  it("TC_AR_119 (negative): writing decisions for an unknown project throws 404 and creates nothing", async () => {
    seed([record()]);
    const { setV3AuditDecisions } = await importStore();

    await expect(
      setV3AuditDecisions("does-not-exist", DECISIONS as any, "2026-08-05T12:00:00.000Z")
    ).rejects.toMatchObject({ status: 404 });

    expect(readFile().projects).toHaveLength(1);
    expect(readFile().projects[0].audit).toBeUndefined();
  });

  it("TC_AR_121 (positive): a category state and a per-item override both survive the round trip", async () => {
    seed([record()]);
    const { setV3AuditDecisions, getV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");
    const back = await getV3AuditDecisions("P1", SCOPE);

    // AC-7.1's data half: the switch state AND the single re-inclusion must both
    // come back, or the panel reopens showing something the user did not choose.
    expect(back?.categories).toEqual({ unusedAssets: "exclude" });
    expect(back?.itemOverrides).toEqual({ "asset:blt4973c80": "include" });
  });

  /*
    Negative — taxonomy #5 (permission denial): a caller outside the project's
    region or ownership reads `undefined`, exactly as every other scoped read in
    this store does — not the decisions, and not a distinguishable "forbidden" that
    would confirm the project exists (NFR-6, EC-16).
  */
  it("TC_AR_121 (negative): a caller in another region or another owner reads no decisions", async () => {
    seed([record({ audit: DECISIONS })]);
    const { getV3AuditDecisions } = await importStore();

    expect(await getV3AuditDecisions("P1", { region: "EU", owner: "U1" })).toBeUndefined();
    expect(await getV3AuditDecisions("P1", { region: "NA", owner: "U2" })).toBeUndefined();
    expect(await getV3AuditDecisions("P1", SCOPE)).toEqual(DECISIONS);
  });

  it("TC_AR_188 (positive): decisions persisted before a restart are present on a fresh store read", async () => {
    seed([record()]);
    const first = await importStore();
    await first.setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    // A fresh import is this suite's stand-in for a reload: lowdb re-reads the file
    // rather than serving anything from memory (NFR-10).
    const second = await importStore();

    expect(await second.getV3AuditDecisions("P1", SCOPE)).toEqual(DECISIONS);
  });

  /*
    Negative — taxonomy #1 (missing input): a project that has never been audited
    reads `undefined` rather than an empty decision set.

    Undefined and `{categories:{},itemOverrides:{}}` resolve to the same thing
    today — everything included — but they are different claims, and the panel uses
    the difference to know whether it is showing defaults or the user's choices.
  */
  it("TC_AR_188 (negative): a project with no decisions reads undefined, not an empty decision set", async () => {
    seed([record()]);
    const { getV3AuditDecisions } = await importStore();

    expect(await getV3AuditDecisions("P1", SCOPE)).toBeUndefined();
  });
});

describe("v3 project.store — a decisions write must not damage the rest of the record", () => {
  /*
    TC_AR_179 — the case this file exists for.

    The record holds `destinationToken.secretEncrypted`, a permanent Contentstack
    write credential that cannot be re-read once lost. A decisions write
    implemented as `{...project, audit}` — the obvious, convenient spread — passes
    every other test in this file and destroys that credential.
  */
  it("TC_AR_179 (positive): the encrypted destination token secret survives a decisions write", async () => {
    seed([record({ destinationToken: TOKEN })]);
    const { setV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    expect(readFile().projects[0].destinationToken).toEqual(TOKEN);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the same protection for the source and
    destination sub-documents. A decisions write touches one field; anything else it
    changes is collateral damage, and the source document in particular carries the
    export status the wizard's whole gate depends on.
  */
  it("TC_AR_179 (negative): source and destination sub-documents are untouched by a decisions write", async () => {
    const destination = { region: "EU", orgId: "o1", stack: { apiKey: "blt-dest", name: "Prod", wasCreated: false } };
    seed([record({ source: SOURCE, destination, destinationToken: TOKEN })]);
    const { setV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    const after = readFile().projects[0];
    expect(after.source).toEqual(SOURCE);
    expect(after.destination).toEqual(destination);
    expect(after.audit).toEqual(DECISIONS);
  });

  it("TC_AR_120 (positive): decisions survive a re-export, which only rewrites the source document", async () => {
    seed([record({ source: SOURCE, audit: DECISIONS })]);
    const { upsertV3Source, getV3AuditDecisions } = await importStore();

    // A re-export writes `source`. The audit decisions must outlive it (FR-7.6) —
    // this is the whole reason decisions live on the record while findings live in
    // the export folder.
    await upsertV3Source(
      "P1",
      { ...SOURCE, lastExport: { jobId: "j2", status: "succeeded" } } as any,
      "2026-08-06T00:00:00.000Z"
    );

    expect(await getV3AuditDecisions("P1", SCOPE)).toEqual(DECISIONS);
  });

  /*
    Negative — taxonomy #4 (forbidden state): the reverse direction. Writing
    decisions must not resurrect, blank or otherwise alter `lastExport`, because the
    wizard's step gate reads it to decide whether the Audit step is reachable at
    all.
  */
  it("TC_AR_120 (negative): a decisions write leaves lastExport exactly as it was", async () => {
    seed([record({ source: SOURCE })]);
    const { setV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    expect(readFile().projects[0].source.lastExport).toEqual({ jobId: "j1", status: "succeeded" });
  });
});

describe("v3 project.store — findings never enter the project record", () => {
  /*
    Negative — taxonomy #4 (forbidden state): the stored record carries the user's
    decisions and nothing derived from the scan.

    FR-7.9's reason is concrete: `listV3Projects` returns whole records to the
    browser and lowdb rewrites the entire file on every write, so a findings blob
    here would be sent on every project-list request and rewritten on every
    unrelated save.
  */
  it("TC_AR_126 (negative): a written record holds decisions only, with no findings inventory", async () => {
    seed([record()]);
    const { setV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:00:00.000Z");

    const stored = readFile().projects[0];
    expect(Object.keys(stored.audit).sort()).toEqual([
      "categories",
      "itemOverrides",
      "updatedAt",
    ]);
    expect(stored).not.toHaveProperty("auditFindings");
    expect(stored).not.toHaveProperty("findings");
    expect(JSON.stringify(stored)).not.toContain("unpublishedEntries");
  });

  /*
    Negative — taxonomy #5 (information disclosure): the project listing carries the
    decisions — which are small and the user's own — but must never grow a findings
    payload. Asserted on the listing because that is the response that reaches the
    browser.
  */
  it("TC_AR_127 (negative): the project listing carries decisions but no findings payload", async () => {
    seed([record({ audit: DECISIONS, destinationToken: TOKEN })]);
    const { listV3Projects } = await importStore();

    const [project] = await listV3Projects(SCOPE);

    expect((project as any).audit).toEqual(DECISIONS);
    expect(project).not.toHaveProperty("auditFindings");
    // And the pre-existing guarantee still holds: the token secret is stripped from
    // the listing even though the record now carries an extra field beside it.
    expect(project).not.toHaveProperty("destinationToken");
  });

  it("TC_AR_126 (positive): decisions are stored under a single dedicated field on the record", async () => {
    seed([record()]);
    const { setV3AuditDecisions } = await importStore();

    await setV3AuditDecisions("P1", DECISIONS as any, "2026-08-05T12:34:56.000Z");

    const stored = readFile().projects[0];
    expect(stored.audit).toEqual(DECISIONS);
    // The write also stamps the record's own updated_at, as every other write does.
    expect(stored.updated_at).toBe("2026-08-05T12:34:56.000Z");
  });

  it("TC_AR_127 (positive): a second write replaces the decision set rather than merging into it", async () => {
    seed([record({ audit: DECISIONS })]);
    const { setV3AuditDecisions, getV3AuditDecisions } = await importStore();

    const replacement = {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: {},
      updatedAt: "2026-08-06T00:00:00.000Z",
    };
    await setV3AuditDecisions("P1", replacement as any, "2026-08-06T00:00:00.000Z");

    // A full replace, per API-5's contract. Merging would make "Include everything"
    // impossible to express — the cleared overrides would survive the write.
    expect(await getV3AuditDecisions("P1", SCOPE)).toEqual(replacement);
  });
});
