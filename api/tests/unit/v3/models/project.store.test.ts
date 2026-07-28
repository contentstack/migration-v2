import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — v3 project.store (getV3Project / upsertV3Source / setV3Graph).
 * Backs TC_SRC_016 (selection persisted to project), TC_SRC_036 (survives a
 * reload), TC_SRC_047 (persist returns the source; server-owned graph preserved
 * across a re-persist). feature.md FR-5.2 / AC-1.4 / AC-4.1.
 *
 * Isolation: the store reads its data dir from V3_DATA_DIR; each test points it
 * at a fresh temp dir and re-imports the module (simulating a reload).
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/project.store.js");
};

const SOURCE = {
  mode: "stack" as const,
  stack: {
    region: "NA",
    orgId: "O1",
    stackApiKey: "blt1",
    branch: "main",
    scope: "whole" as const,
    selectedModules: [],
  },
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3store-"));
  vi.stubEnv("V3_DATA_DIR", tmpDir);
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 project.store", () => {
  it("TC_SRC_016 (positive): upsertV3Source creates a project record retrievable by id", async () => {
    const s = await importStore();
    const saved = await s.upsertV3Source("O1", "P1", SOURCE as any, "t1");
    expect(saved.mode).toBe("stack");

    const proj = await s.getV3Project("P1");
    expect(proj).toMatchObject({ id: "P1", org_id: "O1" });
    expect(proj?.source?.stack?.stackApiKey).toBe("blt1");
  });

  // Negative — taxonomy #1 (missing input): unknown id → undefined, not a crash.
  it("TC_SRC_016 (negative): getV3Project for an unknown id returns undefined", async () => {
    const s = await importStore();
    expect(await s.getV3Project("nope")).toBeUndefined();
  });

  it("TC_SRC_036 (positive): a persisted source survives a reload (fresh store instance reads from disk)", async () => {
    const s1 = await importStore();
    await s1.upsertV3Source("O1", "P1", SOURCE as any, "t1");

    const s2 = await importStore(); // reload — new module instance, same V3_DATA_DIR
    const proj = await s2.getV3Project("P1");
    expect(proj?.source).toMatchObject(SOURCE);
  });

  // Negative — taxonomy #7 (conflict/duplication): re-persist replaces in place, no duplicate row.
  it("TC_SRC_036 (negative): re-persisting the same project replaces the selection in place (no duplicate)", async () => {
    const s = await importStore();
    await s.upsertV3Source("O1", "P1", SOURCE as any, "t1");
    const SOURCE2 = {
      mode: "file",
      file: { sourceId: "sid", fileName: "x.zip", sizeBytes: 1, scope: "all", selectedModules: [] },
    };
    await s.upsertV3Source("O1", "P1", SOURCE2 as any, "t2");

    const proj = await s.getV3Project("P1");
    expect(proj?.source?.mode).toBe("file");

    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, "projects.json"), "utf8"));
    expect(onDisk.projects).toHaveLength(1);
  });

  it("TC_SRC_047 (positive): upsert returns the source and preserves a server-set graph across re-persist", async () => {
    const s = await importStore();
    await s.upsertV3Source("O1", "P1", SOURCE as any, "t1");

    const graph = {
      counts: { contentTypes: 2, assets: 0, entries: 0, globalFields: 0, references: 1 },
      nodes: [],
      edges: [],
    };
    await s.setV3Graph("P1", graph as any, { jobId: "j1", status: "succeeded" }, "t2");

    const returned = await s.upsertV3Source(
      "O1",
      "P1",
      { mode: "stack", stack: { ...SOURCE.stack, scope: "specific", selectedModules: ["contentTypes"] } } as any,
      "t3"
    );
    expect(returned.stack?.scope).toBe("specific"); // new selection applied
    expect(returned.graph).toEqual(graph); // server-owned graph preserved

    const proj = await s.getV3Project("P1");
    expect(proj?.source?.graph).toEqual(graph);
  });

  // Negative — taxonomy #4 (forbidden state): can't attach a graph to a non-existent project.
  it("TC_SRC_047 (negative): setV3Graph on a non-existent project is rejected", async () => {
    const s = await importStore();
    await expect(
      s.setV3Graph(
        "missing",
        { counts: {}, nodes: [], edges: [] } as any,
        { jobId: "j", status: "x" },
        "t"
      )
    ).rejects.toThrow(/No v3 project\/source found/);
  });
});
