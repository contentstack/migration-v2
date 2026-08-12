import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";

import { detectPrefix } from "./bundle.service.js";
import { downloadAssetBinary } from "../utils/assetDownload.util.js";

/**
 * Unpacks an UPLOADED Contentstack export zip into a real folder on disk, with every
 * asset's actual bytes downloaded — so the file-upload path produces the same
 * import-ready layout a live export does.
 *
 * Scope note: this file used to also BUILD exports (as a zip, and as a folder from
 * data we fetched ourselves). Both were removed on 2026-08-12 — the Contentstack CLI
 * writes the stack export now (`cliExport.service.ts`), and the zip builder had no
 * caller at all. What remains serves only the upload path, where the zip the operator
 * supplies is already a real export and just needs unpacking.
 */
const ASSET_DOWNLOAD_CONCURRENCY = Number(process.env.V3_ASSET_DOWNLOAD_CONCURRENCY) || 5;

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) await fn(items[i]);
  });
  await Promise.all(workers);
}

const writeJsonFile = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

/**
 * Downloads every real asset binary (not just its metadata/URL) into
 * `assets/files/<uid>/<filename>` under `destDir`. A single asset's download
 * failure is recorded in `assets/logs/assets/cs_failed.json` (the same file
 * a real CS export uses for per-item failures) and does not abort the rest.
 */
async function writeAssetFiles(assets: any[], destDir: string): Promise<string[]> {
  const failed: string[] = [];
  await mapWithConcurrency(assets, ASSET_DOWNLOAD_CONCURRENCY, async (asset) => {
    if (!asset?.uid || !asset?.url) return;
    try {
      const bytes = await downloadAssetBinary(asset.url);
      const filename = asset.filename ?? asset.uid;
      const assetPath = path.join(destDir, "assets", "files", asset.uid, filename);
      fs.mkdirSync(path.dirname(assetPath), { recursive: true });
      fs.writeFileSync(assetPath, bytes);
    } catch {
      failed.push(asset.uid);
    }
  });

  writeJsonFile(
    path.join(destDir, "assets", "logs", "assets", "cs_failed.json"),
    Object.fromEntries(failed.map((uid) => [uid, "Failed to download asset binary"]))
  );
  return failed;
}
export interface BundleFolderResult {
  destDir: string;
  failedAssets: string[];
}
export const writeUploadedBundleFolder = async (buffer: Buffer, destDir: string): Promise<BundleFolderResult> => {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const names = entries.map((e) => e.entryName.replace(/\\/g, "/"));
  const prefix = detectPrefix(names);

  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  for (const e of entries) {
    const rel = e.entryName.replace(/\\/g, "/").slice(prefix.length);
    if (!rel) continue;
    const outPath = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, e.getData());
  }

  let assetIndex: Record<string, any> = {};
  try {
    assetIndex = JSON.parse(fs.readFileSync(path.join(destDir, "assets", "index.json"), "utf8"));
  } catch {
    /* no assets in this bundle — nothing to download */
  }
  const failedAssets = await writeAssetFiles(Object.values(assetIndex), destDir);

  for (const rel of ["locales/locales.json", "taxonomies/taxonomies.json"]) {
    const p = path.join(destDir, rel);
    if (!fs.existsSync(p)) writeJsonFile(p, {});
  }

  return { destDir, failedAssets };
};
