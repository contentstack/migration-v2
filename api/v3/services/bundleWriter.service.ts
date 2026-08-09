import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import AdmZip from "adm-zip";

import { detectPrefix } from "./bundle.service.js";
import { downloadAssetBinary } from "../utils/assetDownload.util.js";

/**
 * Writes a REAL Contentstack export bundle zip — the same folder shape
 * bundle.service.ts already knows how to read back (chunk-pointer files +
 * the real per-module data), so a bundle we write here round-trips through
 * our own file-mode upload/parse path. Pure: no network, no filesystem.
 */
export interface BundleWriterInput {
  contentTypes: any[];
  globalFields: any[];
  assets: any[];
  entriesByContentType: { ctUid: string; entries: any[] }[];
  /** Defaults to "en-us" — the entries folder is per-locale in a real CS bundle. */
  locale?: string;
}

const toUidMap = (items: any[]): Record<string, any> => {
  const map: Record<string, any> = {};
  for (const item of items) {
    if (item?.uid) map[item.uid] = item;
  }
  return map;
};

const addJson = (zip: AdmZip, path: string, data: unknown): void => {
  zip.addFile(path, Buffer.from(JSON.stringify(data, null, 2)));
};

export const buildStackBundleZip = (input: BundleWriterInput): Buffer => {
  const zip = new AdmZip();
  const locale = input.locale ?? "en-us";

  addJson(zip, "content_types/schema.json", input.contentTypes);
  addJson(zip, "global_fields/globalfields.json", input.globalFields);

  // assets/assets.json is always just a chunk pointer in a real CS bundle;
  // the real per-asset data lives in assets/index.json.
  addJson(zip, "assets/assets.json", { "1": "index.json" });
  addJson(zip, "assets/index.json", toUidMap(input.assets));

  for (const { ctUid, entries } of input.entriesByContentType) {
    addJson(zip, `entries/${ctUid}/${locale}/index.json`, { "1": `${locale}.json` });
    addJson(zip, `entries/${ctUid}/${locale}/${locale}.json`, toUidMap(entries));
  }

  addJson(zip, "export-info.json", { contentVersion: 2, exportedAt: new Date().toISOString() });

  return zip.toBuffer();
};

/** How many asset binaries to download concurrently — bounded so a stack
 * with hundreds of assets doesn't burst open hundreds of sockets at once. */
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

/** One content type's entries for ONE locale — the unit the entries tree stores. */
export interface EntryGroup {
  ctUid: string;
  locale: string;
  entries: any[];
}

export interface BundleFolderInput {
  contentTypes: any[];
  globalFields: any[];
  assets: any[];
  /**
   * Keyed by content type AND locale (2026-08-05). Previously keyed by content
   * type alone, which forced every entry into a single locale folder and was how
   * non-master-locale content came to be dropped from exports entirely.
   */
  entryGroups: EntryGroup[];
  /** The stack's complete locale objects, from `csManagement.getAllLocales`. */
  locales: any[];
  /** Real, absolute destination directory — a folder under cmsMigrationData/. */
  destDir: string;
}

/**
 * Splits the locale list the way a real Contentstack export does: the master
 * locale (the one with no `fallback_locale`) goes to `master-locale.json`, every
 * other locale to `locales.json`. Verified against a CLI export — `locales.json`
 * held de and fr with `fallback_locale: "en-us"`, and `master-locale.json` held
 * en-us alone with `fallback_locale: null`.
 *
 * When no locale declares itself master, the first is promoted rather than
 * leaving `master-locale.json` empty. An empty master file is not a neutral
 * outcome: the import step reads it to decide where content lands, so an empty one
 * silently strands every entry.
 */
const splitLocales = (
  locales: any[]
): { master: any | undefined; others: any[] } => {
  const list = locales ?? [];
  const masterIndex = list.findIndex((l) => !l?.fallback_locale);
  const idx = masterIndex >= 0 ? masterIndex : list.length ? 0 : -1;
  return {
    master: idx >= 0 ? list[idx] : undefined,
    others: list.filter((_, i) => i !== idx),
  };
};

export interface BundleFolderResult {
  destDir: string;
  failedAssets: string[];
}

/**
 * Writes a REAL export as a genuine folder on disk (not a zip) at `destDir`
 * — the same on-disk shape `cmsMigrationData/<stackId>` already uses, which
 * the legacy migration engine's import step reads directly. Unlike
 * `buildStackBundleZip`, this actually downloads every asset's real bytes
 * (not just its URL) into `assets/files/<uid>/<filename>`, so the folder is
 * immediately import-ready with no separate "fetch the assets" step.
 */
export const writeStackBundleFolder = async (input: BundleFolderInput): Promise<BundleFolderResult> => {
  const { destDir } = input;

  // Start clean so a re-export never leaves stale files from a previous,
  // differently-shaped export sitting alongside the new ones.
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  writeJsonFile(path.join(destDir, "content_types", "schema.json"), input.contentTypes);
  for (const ct of input.contentTypes) {
    if (ct?.uid) writeJsonFile(path.join(destDir, "content_types", `${ct.uid}.json`), ct);
  }

  writeJsonFile(path.join(destDir, "global_fields", "globalfields.json"), input.globalFields);

  writeJsonFile(path.join(destDir, "assets", "assets.json"), { "1": "index.json" });
  writeJsonFile(path.join(destDir, "assets", "index.json"), toUidMap(input.assets));
  const failedAssets = await writeAssetFiles(input.assets, destDir);

  // One folder per content type AND locale — `entries/<ct>/<locale>/<locale>.json`,
  // the shape a real Contentstack export uses.
  for (const { ctUid, locale, entries } of input.entryGroups) {
    writeJsonFile(path.join(destDir, "entries", ctUid, locale, "index.json"), { "1": `${locale}.json` });
    writeJsonFile(path.join(destDir, "entries", ctUid, locale, `${locale}.json`), toUidMap(entries));
  }

  // The real locale objects, keyed by their real uids. Previously `locales.json`
  // was a hardcoded `{}` and `master-locale.json` was synthesised from a random
  // uid and whatever locale code the caller happened to pass — so the destination
  // panel's master-locale mapping had nothing true to read.
  const { master, others } = splitLocales(input.locales);
  writeJsonFile(path.join(destDir, "locales", "locales.json"), toUidMap(others));
  writeJsonFile(
    path.join(destDir, "locales", "master-locale.json"),
    master
      ? toUidMap([master])
      : // No locales at all: keep a valid, self-consistent master rather than an
        // empty file the import step would read as "nowhere to put content".
        {
          [randomUUID().replace(/-/g, "")]: {
            code: "en-us",
            fallback_locale: null,
            uid: "master",
            name: "en-us",
          },
        }
  );
  writeJsonFile(path.join(destDir, "taxonomies", "taxonomies.json"), {});

  writeJsonFile(path.join(destDir, "export-info.json"), { contentVersion: 2, exportedAt: new Date().toISOString() });

  return { destDir, failedAssets };
};

/**
 * File-mode equivalent: extracts an already-uploaded bundle zip straight
 * onto disk at `destDir` (real files, not re-zipped), then downloads every
 * asset's real bytes the same way the stack-mode writer does — so a file
 * import behaves identically whether its assets arrived as CDN links or
 * were already embedded in the zip.
 */
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
