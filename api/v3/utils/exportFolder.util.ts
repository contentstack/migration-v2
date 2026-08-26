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
 *
 * ⚠️ Reads BOTH export shapes, and must keep doing so — see
 * `docs/plans/cli-v1-to-v2-migration.md` §4.1 and §4.3:
 *
 *   - CLI v1 nests modules under `<branch>/` and writes aggregate summary files
 *     (`content_types/schema.json`, `global_fields/globalfields.json`).
 *   - CLI v2 is flat and writes one file per item, with no aggregates at all.
 *   - Assets live in `assets/` OR in `spaces/<space-uid>/assets/`. Which one is
 *     decided by the ORG PLAN, not the CLI version, so neither shape ever goes
 *     away and it cannot be known before the export runs. Never both at once.
 *
 * Reading only one shape does not fail loudly: a missing aggregate reads as zero,
 * so the export looks successful and empty. That is the bug class this guards.
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
  // v2 only, and where the assets go for an asset-spaces org — so an export that
  // has it must still be recognised as a module root.
  "spaces",
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

/**
 * Files inside a module folder that are bookkeeping rather than content.
 *
 * The recurring bug in this area is a manifest counted as data, so the exclusions
 * are explicit rather than pattern-guessed: `schema.json` and `globalfields.json`
 * are v1's aggregates, `index.json` and `metadata.json` are chunk manifests.
 */
const NON_ITEM_FILES = new Set([
  "index.json",
  "schema.json",
  "globalfields.json",
  "metadata.json",
  "folders.json",
]);

/** Counts one-file-per-item modules, the only shape v2 writes. */
const countItemFiles = (dir: string): number => {
  if (!isDir(dir)) return 0;
  let total = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json") || NON_ITEM_FILES.has(file)) continue;
    total++;
  }
  return total;
};

/**
 * Where this export actually keeps its assets.
 *
 * `assets/` for a classic org, `spaces/<space-uid>/assets/` for one whose plan has
 * asset spaces. Returns undefined when there are none — a legitimate answer for a
 * stack with no assets, and for a mid-export folder that has not reached them yet.
 *
 * Requiring the nested `assets` directory is what keeps `spaces/fields/` and
 * `spaces/asset_types/` from being mistaken for an asset store: both sit beside the
 * space folders and both contain a chunk index that would otherwise count as 1.
 */
export const resolveAssetDir = (root: string): string | undefined => {
  const classic = path.join(root, "assets");
  if (isDir(classic)) return classic;

  const spaces = path.join(root, "spaces");
  if (!isDir(spaces)) return undefined;
  for (const entry of fs.readdirSync(spaces, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(spaces, entry.name, "assets");
    if (isDir(candidate)) return candidate;
  }
  return undefined;
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

  /*
    Per-item files first, aggregate second — in that order, and never summed.

    v1 writes the aggregate AND per-item content-type files, so summing would report
    46 for a 23-type export. v1 writes ONLY the aggregate for global fields (verified:
    the reference export has `globalfields.json` with 14 entries and zero per-field
    files), while v2 writes ONLY per-item files. So each needs both readers, with the
    per-item count taking precedence when it finds anything.
  */
  const contentTypes =
    countItemFiles(path.join(root, "content_types")) ||
    countOf(readJson(path.join(root, "content_types", "schema.json")));

  const globalFields =
    countItemFiles(path.join(root, "global_fields")) ||
    countOf(readJson(path.join(root, "global_fields", "globalfields.json")));

  /*
    Assets are counted from the CHUNK files, not from `assets.json`.

    `assets/assets.json` is an INDEX of chunk filenames — `{"1": "<uuid>-assets.json"}`
    — so counting it yields the number of chunks (1) rather than of assets (80).
    Verified against a real CLI export; the first version of this function got it
    wrong precisely because the fixture invented a shape the CLI never produces.
  */
  const assetDir = resolveAssetDir(root);
  const assets = assetDir ? sumChunkFiles(assetDir, "-assets.json") : 0;

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
  const root = resolveExportRoot(dir);

  // v1's aggregate is preferred where it exists: it is one read instead of N, and it
  // is the exact array the pre-CLI exporter used to return.
  const parsed = readJson(path.join(root, "content_types", "schema.json"));
  if (Array.isArray(parsed)) return parsed;

  /*
    v2 has no aggregate, so the types are reassembled from the per-item files. Returned
    in directory order; the graph builder keys on uid, so order carries no meaning.
  */
  const dirPath = path.join(root, "content_types");
  if (!isDir(dirPath)) return [];
  const out: any[] = [];
  for (const file of fs.readdirSync(dirPath)) {
    if (!file.endsWith(".json") || NON_ITEM_FILES.has(file)) continue;
    const ct = readJson(path.join(dirPath, file));
    // A single unreadable file must not cost the whole graph.
    if (ct && typeof ct === "object" && !Array.isArray(ct)) out.push(ct);
  }
  return out;
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
