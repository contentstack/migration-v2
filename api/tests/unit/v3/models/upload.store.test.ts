import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — v3 upload.store (saveUpload / getUploadMeta / getUploadZipPath).
 * Backs TC_SRC_040 (uploaded bundle + manifest persisted, retrievable). Infra
 * for the upload handler and the export file-path. Isolated via V3_DATA_DIR.
 */
let tmpDir: string;

const importStore = async () => {
  vi.resetModules();
  return await import("../../../../v3/models/upload.store.js");
};

const META = {
  sourceId: "s1",
  fileName: "x.zip",
  sizeBytes: 10,
  contentVersion: 2,
  modules: { contentTypes: 2 },
  manifest: [{ name: "Content Types", count: 2 }],
  createdAt: "t",
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "v3up-"));
  vi.stubEnv("V3_DATA_DIR", tmpDir);
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("v3 upload.store", () => {
  it("TC_SRC_040 (positive): saveUpload persists the bundle + meta, retrievable by sourceId", async () => {
    const s = await importStore();
    s.saveUpload("s1", Buffer.from("zip-bytes"), META as any);

    const meta = s.getUploadMeta("s1");
    expect(meta).toMatchObject({ sourceId: "s1", fileName: "x.zip" });
    expect(meta?.manifest[0]).toEqual({ name: "Content Types", count: 2 });
    expect(fs.existsSync(s.getUploadZipPath("s1"))).toBe(true);
  });

  // Negative — taxonomy #1 (missing input): unknown sourceId → null, not a throw.
  it("TC_SRC_040 (negative): getUploadMeta for an unknown sourceId returns null", async () => {
    const s = await importStore();
    expect(s.getUploadMeta("nope")).toBeNull();
  });
});
