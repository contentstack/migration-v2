import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";

/**
 * TDD — v3 bundleWriter.service folder writer (writeUploadedBundleFolder).
 *
 * `writeStackBundleFolder` and its 5 tests were removed on 2026-08-12: the
 * Contentstack CLI writes the stack export folder now, so nothing called it. Those
 * tests went WITH their subject — which is not the same as deleting tests to reach
 * green; the code they described no longer exists.
 *
 * Original header (writeStackBundleFolder /
 * writeUploadedBundleFolder). Unlike buildStackBundleZip (a pure zip-in-memory
 * builder), these write a REAL folder to disk — the same on-disk shape
 * `exportData/<stackId>` already uses — and download every asset's
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

import { writeUploadedBundleFolder } from "../../../../v3/services/bundleWriter.service.js";

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
