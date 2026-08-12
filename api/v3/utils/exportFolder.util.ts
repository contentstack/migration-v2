import fs from "fs";
import path from "path";

/**
 * v3 export-folder reader — makes sense of what the Contentstack CLI wrote.
 *
 * Implements `docs/plans/source-export-revamp.md` Impact 2, Impact 6 and Q-1.
 *
 * The CLI writes its modules inside a `<branch>/` subfolder, so everything here
 * resolves that first. `auditReader.service.ts` and
 * `contentTypeInventory.service.ts` each carry their own copy of that same
 * one-level descent; consolidating all three onto this helper is worth doing but
 * is deliberately out of scope for this change (noted in the plan).
 */

/** Module directories the CLI produces, used to recognise a module root. */
const MODULE_DIRS = [
  "content_types",
  "global_fields",
  "assets",
  "entries",
  "locales",
  "taxonomies",
  "environments",
  "extensions",
  "webhooks",
  "workflows",
  "labels",
  "custom-roles",
  "marketplace_apps",
  "personalize",
];

const isDir = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const holdsAnyModule = (dir: string): boolean =>
  MODULE_DIRS.some((m) => isDir(path.join(dir, m)));

/**
 * The directory the modules actually live in: the given one, or the CLI's
 * `<branch>/` subfolder one level down.
 *
 * Falls back to the given directory when nothing matches, rather than guessing at
 * a subfolder — a broken export should look broken, not look valid but rooted
 * somewhere unexpected.
 */
export const resolveExportRoot = (dir: string): string => {
  if (holdsAnyModule(dir)) return dir;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return dir;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(dir, entry.name);
    if (holdsAnyModule(candidate)) return candidate;
  }
  return dir;
};

/** Parses JSON, returning undefined rather than throwing — one bad file must not
 *  cost the whole read. */
const readJson = (p: string): any => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
};

/**
 * Sums the records across a module's chunk files, ignoring the `index.json`
 * manifest and the `<module>.json` index beside them.
 */
const sumChunkFiles = (dir: string, suffix: string): number => {
  if (!isDir(dir)) return 0;
  let total = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(suffix)) continue;
    total += countOf(readJson(path.join(dir, file)));
  }
  return total;
};

const countOf = (value: unknown): number => {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
};

export interface ExportCounts {
  contentTypes: number;
  globalFields: number;
  assets: number;
  entries: number;
}

/**
 * Counts what has been exported so far.
 *
 * Safe to call MID-export: the counters update per completed module (Q-1), so
 * this runs against a folder holding only the modules finished to that point.
 * Every value defaults to 0 rather than undefined — the tiles render `undefined`
 * as blank and `NaN` as literal "NaN", both of which read as a bug.
 */
export const readExportCounts = (dir: string): ExportCounts => {
  const root = resolveExportRoot(dir);

  const contentTypes = countOf(readJson(path.join(root, "content_types", "schema.json")));
  const globalFields = countOf(readJson(path.join(root, "global_fields", "globalfields.json")));

  /*
    Assets are counted from the CHUNK files, not from `assets.json`.

    `assets/assets.json` is an INDEX of chunk filenames — `{"1": "<uuid>-assets.json"}`
    — so counting it yields the number of chunks (1) rather than of assets (80).
    Verified against a real CLI export; the first version of this function got it
    wrong precisely because the fixture invented a shape the CLI never produces.
  */
  const assets = sumChunkFiles(path.join(root, "assets"), "-assets.json");

  // Entries live at entries/<contentType>/<locale>/<uuid>-entries.json, so the
  // total is the sum across every locale file of every content type.
  let entries = 0;
  const entriesRoot = path.join(root, "entries");
  if (isDir(entriesRoot)) {
    for (const ct of fs.readdirSync(entriesRoot, { withFileTypes: true })) {
      if (!ct.isDirectory()) continue;
      const ctDir = path.join(entriesRoot, ct.name);
      for (const locale of fs.readdirSync(ctDir, { withFileTypes: true })) {
        if (!locale.isDirectory()) continue;
        const localeDir = path.join(ctDir, locale.name);
        // Same chunk-file rule as assets: `index.json` is a manifest, and the
        // real records live in `<uuid>-entries.json`.
        entries += sumChunkFiles(localeDir, "-entries.json");
      }
    }
  }

  return { contentTypes, globalFields, assets, entries };
};

/**
 * The exported content types, for the dependency graph (Impact 6).
 *
 * Replaces the in-memory array the pre-CLI exporter returned from its own API
 * calls. An empty list is a legitimate answer — someone exporting only webhooks
 * has no content types and an empty graph.
 */
export const readExportedContentTypes = (dir: string): any[] => {
  const parsed = readJson(path.join(resolveExportRoot(dir), "content_types", "schema.json"));
  return Array.isArray(parsed) ? parsed : [];
};

/**
 * Writes `exportedAt` into the export's own `export-info.json` (Impact 2).
 *
 * ⚠️ Load-bearing, and its absence fails SILENTLY. The Audit page's cache key is
 * `exportedAt` (`auditScan.service.ts` → `cacheKey: data.exportedAt`). The CLI
 * writes `{contentVersion, logsPath}` with no timestamp, so without this stamp a
 * stale `audit.json` is indistinguishable from a fresh one and the Audit page
 * keeps showing findings from a PREVIOUS export — no error, no visible symptom.
 *
 * Merges rather than replaces: `contentVersion` is what the IMPORT reads to
 * decide how to interpret the bundle, so overwriting the file would break the
 * other half of the migration.
 */
export const stampExportedAt = (dir: string, nowIso: string): void => {
  const root = resolveExportRoot(dir);
  const file = path.join(root, "export-info.json");
  // A malformed existing file must not abort the stamp, or the silent
  // stale-audit bug returns through the back door.
  const existing = readJson(file) ?? {};
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...existing, exportedAt: nowIso }, null, 2));
};
