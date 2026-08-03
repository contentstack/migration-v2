import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";

/**
 * TDD — v3 bundleWriter.service folder writers (writeStackBundleFolder /
 * writeUploadedBundleFolder). Unlike buildStackBundleZip (a pure zip-in-memory
 * builder), these write a REAL folder to disk — the same on-disk shape
 * `cmsMigrationData/<stackId>` already uses — and download every asset's
 * actual bytes (not just its URL). The one real network boundary
 * (downloadAssetBinary) is mocked; everything else is real filesystem I/O
 * against a throwaway temp directory.
 */
const { mockDownloadAsset } = vi.hoisted(() => ({
  mockDownloadAsset: vi.fn(() => Promise.resolve(Buffer.from("binary-bytes"))),
}));
vi.mock("../../../../v3/utils/assetDownload.util.js", () => ({
  downloadAssetBinary: mockDownloadAsset,
}));

import { writeStackBundleFolder, writeUploadedBundleFolder } from "../../../../v3/services/bundleWriter.service.js";

const TMP = path.join(os.tmpdir(), `v3-bundle-folder-test-${process.pid}`);
const readJsonFile = (p: string): any => JSON.parse(fs.readFileSync(p, "utf8"));

beforeEach(() => {
  mockDownloadAsset.mockReset();
  mockDownloadAsset.mockResolvedValue(Buffer.from("binary-bytes"));
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("v3 bundleWriter.service — writeStackBundleFolder", () => {
  it("(positive) writes a real folder with every module's data and downloads each asset's real bytes", async () => {
    const destDir = path.join(TMP, "blt1");
    const result = await writeStackBundleFolder({
      contentTypes: [{ uid: "blog", title: "Blog Post", schema: [] }],
      globalFields: [{ uid: "seo", title: "SEO" }],
      assets: [{ uid: "a1", filename: "hero.png", url: "https://cdn.example/hero.png" }],
      entriesByContentType: [{ ctUid: "blog", entries: [{ uid: "e1", title: "Welcome Post" }] }],
      destDir,
    });

    expect(result.destDir).toBe(destDir);
    expect(result.failedAssets).toEqual([]);
    expect(mockDownloadAsset).toHaveBeenCalledWith("https://cdn.example/hero.png");

    expect(readJsonFile(path.join(destDir, "content_types/schema.json"))).toEqual([
      { uid: "blog", title: "Blog Post", schema: [] },
    ]);
    expect(readJsonFile(path.join(destDir, "content_types/blog.json"))).toEqual({
      uid: "blog", title: "Blog Post", schema: [],
    });
    expect(readJsonFile(path.join(destDir, "global_fields/globalfields.json"))).toEqual([
      { uid: "seo", title: "SEO" },
    ]);
    expect(readJsonFile(path.join(destDir, "assets/index.json"))).toEqual({
      a1: { uid: "a1", filename: "hero.png", url: "https://cdn.example/hero.png" },
    });
    // The real downloaded binary, not just metadata.
    expect(fs.readFileSync(path.join(destDir, "assets/files/a1/hero.png"))).toEqual(Buffer.from("binary-bytes"));
    expect(readJsonFile(path.join(destDir, "assets/logs/assets/cs_failed.json"))).toEqual({});
    expect(readJsonFile(path.join(destDir, "entries/blog/en-us/en-us.json"))).toEqual({
      e1: { uid: "e1", title: "Welcome Post" },
    });
    expect(readJsonFile(path.join(destDir, "locales/locales.json"))).toEqual({});
    expect(readJsonFile(path.join(destDir, "taxonomies/taxonomies.json"))).toEqual({});
    expect(readJsonFile(path.join(destDir, "export-info.json")).contentVersion).toBe(2);
  });

  // Negative — taxonomy #6 (dependency failure): one asset's download fails —
  // it must be skipped and recorded, not crash the whole export.
  it("(negative) an asset download failure is skipped and recorded, not thrown", async () => {
    mockDownloadAsset.mockRejectedValueOnce(new Error("network error"));
    const destDir = path.join(TMP, "blt2");

    const result = await writeStackBundleFolder({
      contentTypes: [],
      globalFields: [],
      assets: [{ uid: "a1", filename: "broken.png", url: "https://cdn.example/broken.png" }],
      entriesByContentType: [],
      destDir,
    });

    expect(result.failedAssets).toEqual(["a1"]);
    expect(fs.existsSync(path.join(destDir, "assets/files/a1/broken.png"))).toBe(false);
    expect(readJsonFile(path.join(destDir, "assets/logs/assets/cs_failed.json"))).toEqual({
      a1: "Failed to download asset binary",
    });
  });

  // A re-export must not leave stale files from a previous, differently
  // shaped export sitting alongside the new ones.
  it("(negative) a re-export clears any previous contents of destDir first", async () => {
    const destDir = path.join(TMP, "blt3");
    fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, "stale-leftover.json"), "{}");

    await writeStackBundleFolder({ contentTypes: [], globalFields: [], assets: [], entriesByContentType: [], destDir });

    expect(fs.existsSync(path.join(destDir, "stale-leftover.json"))).toBe(false);
  });
});

describe("v3 bundleWriter.service — writeUploadedBundleFolder", () => {
  const zipWith = (entries: Record<string, string>): Buffer => {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(entries)) zip.addFile(name, Buffer.from(content));
    return zip.toBuffer();
  };

  it("(positive) extracts a real uploaded bundle to disk and downloads its assets' real bytes", async () => {
    const buf = zipWith({
      "export-info.json": JSON.stringify({ contentVersion: 2 }),
      "content_types/schema.json": JSON.stringify([{ uid: "blog", title: "Blog" }]),
      "assets/index.json": JSON.stringify({ a1: { uid: "a1", filename: "hero.png", url: "https://cdn.example/hero.png" } }),
    });
    const destDir = path.join(TMP, "uploaded1");

    const result = await writeUploadedBundleFolder(buf, destDir);

    expect(result.failedAssets).toEqual([]);
    expect(readJsonFile(path.join(destDir, "content_types/schema.json"))).toEqual([{ uid: "blog", title: "Blog" }]);
    expect(fs.readFileSync(path.join(destDir, "assets/files/a1/hero.png"))).toEqual(Buffer.from("binary-bytes"));
    // Missing locales/taxonomies files are backfilled with a valid empty default.
    expect(readJsonFile(path.join(destDir, "locales/locales.json"))).toEqual({});
    expect(readJsonFile(path.join(destDir, "taxonomies/taxonomies.json"))).toEqual({});
  });

  // Negative — taxonomy #1 (missing/empty): a bundle with no assets/index.json
  // at all still succeeds (nothing to download), rather than throwing.
  it("(negative) a bundle with no assets section still extracts successfully", async () => {
    const buf = zipWith({ "content_types/schema.json": JSON.stringify([]) });
    const destDir = path.join(TMP, "uploaded2");

    const result = await writeUploadedBundleFolder(buf, destDir);

    expect(result.failedAssets).toEqual([]);
    expect(mockDownloadAsset).not.toHaveBeenCalled();
  });
});
